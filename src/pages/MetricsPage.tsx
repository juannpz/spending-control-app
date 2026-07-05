import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, Chip, CircularProgress, Paper, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import TrendingFlatIcon from "@mui/icons-material/TrendingFlat";
import type {
    Currency,
    ExpenseCategory,
    IncomeCategory,
    MetricsProjection,
    MonthlyMetrics,
} from "@/types";
import { useSheets } from "@/contexts/SheetsContext";
import { useAuth } from "@/contexts/AuthContext";
import * as sheetsService from "@/services/googleSheets";
import { is401Error } from "@/services/googleAuth";
import { formatCurrency, formatMonthLabel } from "@/utils";
import { CATEGORY_LABELS, INCOME_CATEGORY_LABELS } from "@/constants";
import { PieChart, type PieSlice } from "@/components/metrics/PieChart";

/** Parse "YYYY-MM" sheet name to {year, month} */
const parseSheetName = (name: string): { year: number; month: number } | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(name);
    if (!m) return null;
    const year = Number(m[1]);
    const month = Number(m[2]);
    if (month < 1 || month > 12) return null;
    return { year, month };
};

/** Build monthKey for sorting/comparison */
const monthKey = (y: number, m: number) => y * 100 + m;

/** Simple linear regression slope for trend detection */
const calculateTrend = (values: number[]): "up" | "down" | "stable" => {
    if (values.length < 2) return "stable";
    const n = values.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += values[i];
        sumXY += i * values[i];
        sumX2 += i * i;
    }
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    // Normalize slope relative to average value
    const avg = sumY / n;
    if (avg === 0) return "stable";
    const normalizedSlope = slope / avg;
    if (normalizedSlope > 0.05) return "up";
    if (normalizedSlope < -0.05) return "down";
    return "stable";
};

// ── Color palettes for pie/donut charts ──

const EXPENSE_COLORS = [
    "#ef4444", // red-500
    "#f97316", // orange-500
    "#eab308", // yellow-500
    "#dc2626", // red-600
    "#ea580c", // orange-600
    "#ca8a04", // yellow-600
    "#b91c1c", // red-700
    "#c2410c", // orange-700
    "#a16207", // yellow-700
    "#991b1b", // red-800
];

const INCOME_COLORS = [
    "#22c55e", // green-500
    "#14b8a6", // teal-500
    "#10b981", // emerald-500
    "#16a34a", // green-600
    "#0d9488", // teal-600
    "#059669", // emerald-600
    "#15803d", // green-700
    "#0f766e", // teal-700
    "#047857", // emerald-700
    "#166534", // green-800
];

/** Donut chart + legend for a category breakdown */
const CategoryDonut = ({
    categories,
    grandTotal,
    colorPalette,
    getLabel,
}: {
    /** Top N categories to show explicitly */
    categories: { category: string; total: number; currency: Currency }[];
    /** Real total across ALL categories (including those not in the top N) */
    grandTotal: number;
    colorPalette: string[];
    getLabel: (key: string) => string;
}) => {
    const topSum = categories.reduce((s, c) => s + c.total, 0);
    const others = grandTotal - topSum;

    const slices: PieSlice[] = [
        ...categories.map((cat, i) => ({
            label: getLabel(cat.category),
            value: cat.total,
            color: colorPalette[i % colorPalette.length],
        })),
        // Append "Otros" slice if there are remaining categories
        ...(others > 0.005
            ? [{ label: "Otros", value: others, color: "#9ca3af" /* gray-400 */ }]
            : []),
    ];

    return (
        <Box className="flex flex-col items-center">
            <Box className="flex flex-col sm:flex-row items-center gap-3">
                {/* Donut — use grandTotal as centerLabel so it matches the summary card */}
                <PieChart
                    slices={slices}
                    innerRadius={28}
                    radius={42}
                    size={150}
                    centerLabel={grandTotal.toLocaleString("es-AR")}
                />

                {/* Legend — percentages relative to grandTotal */}
                <Box className="flex flex-col gap-1 text-xs min-w-0">
                    {slices.map((sl) => {
                        const pct = grandTotal > 0 ? Math.round((sl.value / grandTotal) * 100) : 0;
                        return (
                            <Box key={sl.label} className="flex items-center gap-1.5">
                                <Box
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    sx={{ bgcolor: sl.color }}
                                />
                                <Typography
                                    variant="caption"
                                    noWrap
                                    className="max-w-[120px] block"
                                >
                                    {sl.label}
                                </Typography>
                                <Typography
                                    variant="caption"
                                    className="font-semibold! shrink-0 ml-auto"
                                >
                                    {pct}%
                                </Typography>
                            </Box>
                        );
                    })}
                </Box>
            </Box>
        </Box>
    );
};

export const MetricsPage = () => {
    const { currentSheet } = useSheets();
    const { token, refreshToken, logout } = useAuth();

    const tokenRef = useRef(token);
    tokenRef.current = token;
    const refreshTokenRef = useRef(refreshToken);
    refreshTokenRef.current = refreshToken;
    const logoutRef = useRef(logout);
    logoutRef.current = logout;

    const [allMetrics, setAllMetrics] = useState<MonthlyMetrics[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const withTokenRefresh = useCallback(
        async <T,>(operation: (tok: string) => Promise<T>): Promise<T> => {
            const tok = tokenRef.current;
            if (!tok) throw new Error("Not authenticated");
            try {
                return await operation(tok);
            } catch (err: unknown) {
                if (!is401Error(err)) throw err;
                const fresh = await refreshTokenRef.current();
                if (!fresh) {
                    logoutRef.current();
                    throw new Error("Sesión expirada.");
                }
                sheetsService.setToken(fresh);
                return await operation(fresh);
            }
        },
        [],
    );

    const loadHistoricalData = useCallback(async () => {
        if (!currentSheet || !tokenRef.current) return;
        setIsLoading(true);
        setLoadError(null);
        try {
            await withTokenRefresh(async (tok) => {
                const sheetNames = await sheetsService.getSheetNames(
                    tok,
                    currentSheet.spreadsheetId,
                );
                const monthSheets = sheetNames
                    .map((name) => ({ name, parsed: parseSheetName(name) }))
                    .filter((s): s is { name: string; parsed: { year: number; month: number } } =>
                        s.parsed !== null
                    )
                    .sort((a, b) =>
                        monthKey(a.parsed.year, a.parsed.month) -
                        monthKey(b.parsed.year, b.parsed.month)
                    );

                const metricsList: MonthlyMetrics[] = [];

                for (const sheet of monthSheets) {
                    try {
                        const { expenses, income } = await sheetsService.getMovements(
                            tok,
                            currentSheet.spreadsheetId,
                            sheet.name,
                        );

                        const totalExpenses: Record<Currency, number> = { ARS: 0, USD: 0 };
                        const totalIncome: Record<Currency, number> = { ARS: 0, USD: 0 };
                        const expenseCatMap: Record<string, { total: number; currency: Currency }> =
                            {};
                        const incomeCatMap: Record<string, { total: number; currency: Currency }> =
                            {};

                        for (const e of expenses) {
                            if (e.paymentType === "credito") continue; // skip credit card for metrics
                            totalExpenses[e.currency] += e.amount;
                            const key = e.category;
                            if (!expenseCatMap[key]) {
                                expenseCatMap[key] = { total: 0, currency: e.currency };
                            }
                            expenseCatMap[key].total += e.amount;
                        }

                        for (const inc of income) {
                            totalIncome[inc.currency] += inc.amount;
                            const key = inc.category;
                            if (!incomeCatMap[key]) {
                                incomeCatMap[key] = { total: 0, currency: inc.currency };
                            }
                            incomeCatMap[key].total += inc.amount;
                        }

                        const balance: Record<Currency, number> = {
                            ARS: totalIncome.ARS - totalExpenses.ARS,
                            USD: totalIncome.USD - totalExpenses.USD,
                        };

                        metricsList.push({
                            year: sheet.parsed.year,
                            month: sheet.parsed.month,
                            monthLabel: formatMonthLabel(sheet.parsed.year, sheet.parsed.month),
                            totalExpenses,
                            totalIncome,
                            balance,
                            expenseCount: expenses.filter((e) =>
                                e.paymentType !== "credito"
                            ).length,
                            incomeCount: income.length,
                            topExpenseCategories: Object.entries(expenseCatMap)
                                .map(([cat, val]) => ({ category: cat as ExpenseCategory, ...val }))
                                .sort((a, b) => b.total - a.total)
                                .slice(0, 5),
                            topIncomeCategories: Object.entries(incomeCatMap)
                                .map(([cat, val]) => ({ category: cat as IncomeCategory, ...val }))
                                .sort((a, b) => b.total - a.total)
                                .slice(0, 5),
                        });
                    } catch {
                        // Skip sheets that can't be read
                    }
                }

                setAllMetrics(metricsList);
            });
        } catch (err) {
            setLoadError(err instanceof Error ? err.message : "Error al cargar datos históricos");
        } finally {
            setIsLoading(false);
        }
    }, [currentSheet, withTokenRefresh]);

    useEffect(() => {
        if (currentSheet) {
            loadHistoricalData();
        }
    }, [currentSheet, loadHistoricalData]);

    // ── Computed metrics ──
    const currentMetrics = useMemo(() => {
        if (!currentSheet) return null;
        return allMetrics.find(
            (m) => m.year === currentSheet.year && m.month === currentSheet.month,
        ) ?? null;
    }, [allMetrics, currentSheet]);

    const projection = useMemo((): MetricsProjection | null => {
        if (allMetrics.length < 2) return null;

        const expenseValuesARS = allMetrics.map((m) => m.totalExpenses.ARS);
        const expenseValuesUSD = allMetrics.map((m) => m.totalExpenses.USD);
        const incomeValuesARS = allMetrics.map((m) => m.totalIncome.ARS);
        const incomeValuesUSD = allMetrics.map((m) => m.totalIncome.USD);

        const avgExpensesARS = expenseValuesARS.reduce((a, b) => a + b, 0) /
            expenseValuesARS.length;
        const avgExpensesUSD = expenseValuesUSD.reduce((a, b) => a + b, 0) /
            expenseValuesUSD.length;
        const avgIncomeARS = incomeValuesARS.reduce((a, b) => a + b, 0) / incomeValuesARS.length;
        const avgIncomeUSD = incomeValuesUSD.reduce((a, b) => a + b, 0) / incomeValuesUSD.length;

        // Weighted projection: 60% last month + 40% average
        const last = allMetrics[allMetrics.length - 1];
        const w = 0.6;

        const projectedExpenses = {
            ARS: last.totalExpenses.ARS * w + avgExpensesARS * (1 - w),
            USD: last.totalExpenses.USD * w + avgExpensesUSD * (1 - w),
        };
        const projectedIncome = {
            ARS: last.totalIncome.ARS * w + avgIncomeARS * (1 - w),
            USD: last.totalIncome.USD * w + avgIncomeUSD * (1 - w),
        };

        const trend = calculateTrend(allMetrics.map((m) => m.balance.ARS + m.balance.USD));

        return {
            nextMonth: {
                projectedExpenses,
                projectedIncome,
                projectedBalance: {
                    ARS: projectedIncome.ARS - projectedExpenses.ARS,
                    USD: projectedIncome.USD - projectedExpenses.USD,
                },
            },
            averageMonthlyExpenses: { ARS: avgExpensesARS, USD: avgExpensesUSD },
            averageMonthlyIncome: { ARS: avgIncomeARS, USD: avgIncomeUSD },
            trend,
        };
    }, [allMetrics]);

    const previousMonthMetrics = useMemo(() => {
        if (allMetrics.length < 2) return null;
        return allMetrics[allMetrics.length - 2];
    }, [allMetrics]);

    // ── Difference with previous month ──
    const diffWithPrevious = useMemo(() => {
        if (!currentMetrics || !previousMonthMetrics) return null;
        return {
            expenses: {
                ARS: currentMetrics.totalExpenses.ARS - previousMonthMetrics.totalExpenses.ARS,
                USD: currentMetrics.totalExpenses.USD - previousMonthMetrics.totalExpenses.USD,
            },
            income: {
                ARS: currentMetrics.totalIncome.ARS - previousMonthMetrics.totalIncome.ARS,
                USD: currentMetrics.totalIncome.USD - previousMonthMetrics.totalIncome.USD,
            },
            balance: {
                ARS: currentMetrics.balance.ARS - previousMonthMetrics.balance.ARS,
                USD: currentMetrics.balance.USD - previousMonthMetrics.balance.USD,
            },
        };
    }, [currentMetrics, previousMonthMetrics]);

    if (!currentSheet) {
        return (
            <Box className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <Typography variant="h6" className="text-gray-500">
                    No hay una hoja activa
                </Typography>
                <Typography variant="body2" className="text-gray-400">
                    Seleccioná o creá una hoja desde la pestaña de Gastos
                </Typography>
            </Box>
        );
    }

    if (isLoading) {
        return (
            <Box className="flex justify-center py-12">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box className="flex flex-col gap-3 sm:gap-4">
            {/* Title */}
            <Typography variant="h6" className="font-semibold! text-base sm:text-xl">
                Métricas y Proyecciones
            </Typography>

            {loadError && (
                <Paper className="p-3 bg-red-50">
                    <Typography color="error" variant="body2">{loadError}</Typography>
                </Paper>
            )}

            {/* ── Current Month Summary ── */}
            <Paper className="p-3 sm:p-4">
                <Typography variant="subtitle1" className="font-semibold! mb-2">
                    Resumen {currentSheet.monthLabel}
                </Typography>

                <Box className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Income card */}
                    <Box className="bg-green-50 rounded-lg p-3 text-center">
                        <Typography variant="caption" className="text-green-700 font-semibold!">
                            INGRESOS
                        </Typography>
                        <Typography variant="h6" className="font-bold! text-green-700">
                            {currentMetrics
                                ? formatCurrency(currentMetrics.totalIncome.ARS, "ARS")
                                : formatCurrency(0, "ARS")}
                        </Typography>
                        {currentMetrics && currentMetrics.totalIncome.USD > 0 && (
                            <Typography variant="body2" className="text-green-600">
                                {formatCurrency(currentMetrics.totalIncome.USD, "USD")}
                            </Typography>
                        )}
                    </Box>

                    {/* Expenses card */}
                    <Box className="bg-red-50 rounded-lg p-3 text-center">
                        <Typography variant="caption" className="text-red-700 font-semibold!">
                            GASTOS
                        </Typography>
                        <Typography variant="h6" className="font-bold! text-red-700">
                            {currentMetrics
                                ? formatCurrency(currentMetrics.totalExpenses.ARS, "ARS")
                                : formatCurrency(0, "ARS")}
                        </Typography>
                        {currentMetrics && currentMetrics.totalExpenses.USD > 0 && (
                            <Typography variant="body2" className="text-red-600">
                                {formatCurrency(currentMetrics.totalExpenses.USD, "USD")}
                            </Typography>
                        )}
                    </Box>

                    {/* Balance card */}
                    <Box
                        className={`rounded-lg p-3 text-center ${
                            (currentMetrics?.balance.ARS ?? 0) >= 0 ? "bg-blue-50" : "bg-orange-50"
                        }`}
                    >
                        <Typography
                            variant="caption"
                            className={`font-semibold! ${
                                (currentMetrics?.balance.ARS ?? 0) >= 0
                                    ? "text-blue-700"
                                    : "text-orange-700"
                            }`}
                        >
                            BALANCE
                        </Typography>
                        <Typography
                            variant="h6"
                            className={`font-bold! ${
                                (currentMetrics?.balance.ARS ?? 0) >= 0
                                    ? "text-blue-700"
                                    : "text-orange-700"
                            }`}
                        >
                            {currentMetrics
                                ? formatCurrency(currentMetrics.balance.ARS, "ARS")
                                : formatCurrency(0, "ARS")}
                        </Typography>
                        {currentMetrics && currentMetrics.balance.USD !== 0 && (
                            <Typography
                                variant="body2"
                                className={currentMetrics.balance.USD >= 0
                                    ? "text-blue-600"
                                    : "text-orange-600"}
                            >
                                {formatCurrency(currentMetrics.balance.USD, "USD")}
                            </Typography>
                        )}
                    </Box>
                </Box>
            </Paper>

            {/* ── Comparison with previous month ── */}
            {diffWithPrevious && previousMonthMetrics && (
                <Paper className="p-3 sm:p-4">
                    <Typography variant="subtitle1" className="font-semibold! mb-2">
                        vs. {previousMonthMetrics.monthLabel}
                    </Typography>
                    <Box className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Box className="text-center">
                            <Typography variant="caption" color="text.secondary">
                                Ingresos
                            </Typography>
                            <Typography
                                variant="body2"
                                className={`font-semibold! ${
                                    diffWithPrevious.income.ARS >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                }`}
                            >
                                {diffWithPrevious.income.ARS >= 0 ? "+" : ""}
                                {formatCurrency(diffWithPrevious.income.ARS, "ARS")}
                            </Typography>
                        </Box>
                        <Box className="text-center">
                            <Typography variant="caption" color="text.secondary">Gastos</Typography>
                            <Typography
                                variant="body2"
                                className={`font-semibold! ${
                                    diffWithPrevious.expenses.ARS <= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                }`}
                            >
                                {diffWithPrevious.expenses.ARS >= 0 ? "+" : ""}
                                {formatCurrency(diffWithPrevious.expenses.ARS, "ARS")}
                            </Typography>
                        </Box>
                        <Box className="text-center">
                            <Typography variant="caption" color="text.secondary">
                                Balance
                            </Typography>
                            <Typography
                                variant="body2"
                                className={`font-semibold! ${
                                    diffWithPrevious.balance.ARS >= 0
                                        ? "text-green-600"
                                        : "text-red-600"
                                }`}
                            >
                                {diffWithPrevious.balance.ARS >= 0 ? "+" : ""}
                                {formatCurrency(diffWithPrevious.balance.ARS, "ARS")}
                            </Typography>
                        </Box>
                    </Box>
                </Paper>
            )}

            {/* ── Historical monthly table ── */}
            {allMetrics.length > 0 && (
                <Paper className="p-3 sm:p-4">
                    <Typography variant="subtitle1" className="font-semibold! mb-2">
                        Historial Mensual
                    </Typography>
                    <Box className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b text-left text-gray-500">
                                    <th className="py-2 pr-3 font-medium">Mes</th>
                                    <th className="py-2 pr-3 font-medium text-right">Ingresos</th>
                                    <th className="py-2 pr-3 font-medium text-right">Gastos</th>
                                    <th className="py-2 font-medium text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allMetrics.map((m) => (
                                    <tr
                                        key={monthKey(m.year, m.month)}
                                        className={`border-b last:border-0 ${
                                            currentSheet.year === m.year &&
                                                currentSheet.month === m.month
                                                ? "bg-blue-50 font-semibold"
                                                : ""
                                        }`}
                                    >
                                        <td className="py-2 pr-3 whitespace-nowrap">
                                            {m.monthLabel}
                                        </td>
                                        <td className="py-2 pr-3 text-right text-green-700 whitespace-nowrap">
                                            {formatCurrency(m.totalIncome.ARS, "ARS")}
                                        </td>
                                        <td className="py-2 pr-3 text-right text-red-700 whitespace-nowrap">
                                            {formatCurrency(m.totalExpenses.ARS, "ARS")}
                                        </td>
                                        <td
                                            className={`py-2 text-right whitespace-nowrap ${
                                                m.balance.ARS >= 0
                                                    ? "text-blue-700"
                                                    : "text-orange-700"
                                            }`}
                                        >
                                            {formatCurrency(m.balance.ARS, "ARS")}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </Box>
                </Paper>
            )}

            {/* ── Projections ── */}
            {projection && (
                <Paper className="p-3 sm:p-4">
                    <Typography variant="subtitle1" className="font-semibold! mb-2">
                        Proyección Próximo Mes
                    </Typography>

                    <Box className="flex items-center gap-2 mb-3">
                        <Typography variant="body2" color="text.secondary">Tendencia:</Typography>
                        {projection.trend === "up" && (
                            <Chip
                                icon={<TrendingUpIcon />}
                                label="Al alza"
                                color="success"
                                size="small"
                                variant="outlined"
                            />
                        )}
                        {projection.trend === "down" && (
                            <Chip
                                icon={<TrendingDownIcon />}
                                label="A la baja"
                                color="warning"
                                size="small"
                                variant="outlined"
                            />
                        )}
                        {projection.trend === "stable" && (
                            <Chip
                                icon={<TrendingFlatIcon />}
                                label="Estable"
                                color="default"
                                size="small"
                                variant="outlined"
                            />
                        )}
                    </Box>

                    <Box className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Box className="bg-green-50 rounded-lg p-3 text-center">
                            <Typography variant="caption" className="text-green-700 font-semibold!">
                                INGRESOS PROYECTADOS
                            </Typography>
                            <Typography variant="h6" className="font-bold! text-green-700">
                                {formatCurrency(projection.nextMonth.projectedIncome.ARS, "ARS")}
                            </Typography>
                        </Box>
                        <Box className="bg-red-50 rounded-lg p-3 text-center">
                            <Typography variant="caption" className="text-red-700 font-semibold!">
                                GASTOS PROYECTADOS
                            </Typography>
                            <Typography variant="h6" className="font-bold! text-red-700">
                                {formatCurrency(projection.nextMonth.projectedExpenses.ARS, "ARS")}
                            </Typography>
                        </Box>
                        <Box
                            className={`rounded-lg p-3 text-center ${
                                projection.nextMonth.projectedBalance.ARS >= 0
                                    ? "bg-blue-50"
                                    : "bg-orange-50"
                            }`}
                        >
                            <Typography
                                variant="caption"
                                className={`font-semibold! ${
                                    projection.nextMonth.projectedBalance.ARS >= 0
                                        ? "text-blue-700"
                                        : "text-orange-700"
                                }`}
                            >
                                BALANCE PROYECTADO
                            </Typography>
                            <Typography
                                variant="h6"
                                className={`font-bold! ${
                                    projection.nextMonth.projectedBalance.ARS >= 0
                                        ? "text-blue-700"
                                        : "text-orange-700"
                                }`}
                            >
                                {formatCurrency(projection.nextMonth.projectedBalance.ARS, "ARS")}
                            </Typography>
                        </Box>
                    </Box>

                    <Box className="mt-3 text-center">
                        <Typography variant="caption" color="text.secondary">
                            Basado en promedio mensual de {allMetrics.length} meses ·{" "}
                            {projection.trend === "up"
                                ? "Tendencia positiva"
                                : projection.trend === "down"
                                ? "Tendencia negativa"
                                : "Tendencia estable"}
                        </Typography>
                    </Box>
                </Paper>
            )}

            {/* ── Top Categories ── Pie/Donut charts ── */}
            {currentMetrics && (
                <Paper className="p-3 sm:p-4">
                    <Typography variant="subtitle1" className="font-semibold! mb-3">
                        Top Categorías del Mes
                    </Typography>

                    {/* Two-column layout: donut chart + legend */}
                    <Box className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {/* ── Expenses donut ── */}
                        <Box className="flex flex-col items-center">
                            <Typography
                                variant="body2"
                                className="font-semibold! text-red-700 mb-2"
                            >
                                Gastos
                            </Typography>
                            {currentMetrics.topExpenseCategories.length === 0
                                ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Sin datos
                                    </Typography>
                                )
                                : (
                                    <CategoryDonut
                                        categories={currentMetrics.topExpenseCategories}
                                        grandTotal={currentMetrics.totalExpenses.ARS}
                                        colorPalette={EXPENSE_COLORS}
                                        getLabel={(cat) =>
                                            CATEGORY_LABELS[cat as ExpenseCategory] ?? cat}
                                    />
                                )}
                        </Box>

                        {/* ── Income donut ── */}
                        <Box className="flex flex-col items-center">
                            <Typography
                                variant="body2"
                                className="font-semibold! text-green-700 mb-2"
                            >
                                Ingresos
                            </Typography>
                            {currentMetrics.topIncomeCategories.length === 0
                                ? (
                                    <Typography variant="body2" color="text.secondary">
                                        Sin datos
                                    </Typography>
                                )
                                : (
                                    <CategoryDonut
                                        categories={currentMetrics.topIncomeCategories}
                                        grandTotal={currentMetrics.totalIncome.ARS}
                                        colorPalette={INCOME_COLORS}
                                        getLabel={(cat) =>
                                            INCOME_CATEGORY_LABELS[cat as IncomeCategory] ?? cat}
                                    />
                                )}
                        </Box>
                    </Box>
                </Paper>
            )}

            {/* ── Summary Stats ── */}
            {allMetrics.length > 0 && (
                <Paper className="p-3 sm:p-4">
                    <Typography variant="subtitle1" className="font-semibold! mb-2">
                        Promedios ({allMetrics.length} meses)
                    </Typography>
                    <Box className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Ingreso prom. ARS
                            </Typography>
                            <Typography variant="body2" className="font-semibold! text-green-700">
                                {formatCurrency(
                                    allMetrics.reduce((s, m) => s + m.totalIncome.ARS, 0) /
                                        allMetrics.length,
                                    "ARS",
                                )}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Gasto prom. ARS
                            </Typography>
                            <Typography variant="body2" className="font-semibold! text-red-700">
                                {formatCurrency(
                                    allMetrics.reduce((s, m) => s + m.totalExpenses.ARS, 0) /
                                        allMetrics.length,
                                    "ARS",
                                )}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Balance prom. ARS
                            </Typography>
                            <Typography
                                variant="body2"
                                className={`font-semibold! ${
                                    allMetrics.reduce((s, m) => s + m.balance.ARS, 0) >= 0
                                        ? "text-blue-700"
                                        : "text-orange-700"
                                }`}
                            >
                                {formatCurrency(
                                    allMetrics.reduce((s, m) => s + m.balance.ARS, 0) /
                                        allMetrics.length,
                                    "ARS",
                                )}
                            </Typography>
                        </Box>
                        <Box>
                            <Typography variant="caption" color="text.secondary">
                                Ahorro %
                            </Typography>
                            <Typography
                                variant="body2"
                                className={`font-semibold! ${
                                    allMetrics.reduce((s, m) => s + m.totalIncome.ARS, 0) > 0
                                        ? (allMetrics.reduce((s, m) => s + m.balance.ARS, 0) /
                                                    allMetrics.reduce((s, m) =>
                                                        s + m.totalIncome.ARS, 0) *
                                                    100 >= 0
                                            ? "text-blue-700"
                                            : "text-orange-700")
                                        : "text-gray-500"
                                }`}
                            >
                                {allMetrics.reduce((s, m) =>
                                        s + m.totalIncome.ARS, 0) > 0
                                    ? (
                                        allMetrics.reduce((s, m) => s + m.balance.ARS, 0) /
                                        allMetrics.reduce((s, m) => s + m.totalIncome.ARS, 0) *
                                        100
                                    ).toFixed(1) + "%"
                                    : "N/A"}
                            </Typography>
                        </Box>
                    </Box>
                </Paper>
            )}
        </Box>
    );
};
