import { useCallback, useRef, useState } from "react";
import { Alert, Box, Button, Chip, CircularProgress, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import FileOpenIcon from "@mui/icons-material/FileOpen";
import { useSheets } from "@/contexts/SheetsContext";
import { useAuth } from "@/contexts/AuthContext";
import type { CreateExpenseData, Expense } from "@/types";
import { SheetCreator } from "@/components/sheets/SheetCreator";
import { SheetImporter } from "@/components/sheets/SheetImporter";
import { ExpenseForm } from "@/components/expenses/ExpenseForm";
import { ExpenseTable } from "@/components/expenses/ExpenseTable";
import { ConfirmDelete } from "@/components/expenses/ConfirmDelete";
import InstallmentDetail from "@/components/expenses/InstallmentDetail";
import { getSpreadsheetMeta, setToken } from "@/services/googleSheets";

export const DashboardPage = () => {
    const {
        currentSheet,
        isLoading,
        error,
        clearError,
        addExpense,
        editExpense,
        removeExpense,
        markInstallmentPaid,
    } = useSheets();
    const { token, user, refreshToken, logout } = useAuth();

    // Stable refs so callbacks always see latest auth values
    const tokenRef = useRef(token);
    tokenRef.current = token;
    const refreshTokenRef = useRef(refreshToken);
    refreshTokenRef.current = refreshToken;
    const logoutRef = useRef(logout);
    logoutRef.current = logout;

    /** 401 detector for GAPI / fetch errors. */
    const is401Error = (err: unknown): boolean => {
        const e = err as Record<string, any> | null;
        if (!e) return false;
        if (e.status === 401) return true;
        if (e.result?.error?.code === 401) return true;
        if (
            typeof e.message === "string" && e.message.includes("401") &&
            e.message.includes("UNAUTHENTICATED")
        ) return true;
        return false;
    };

    /** Fetch spreadsheet metadata with automatic silent token refresh on 401. */
    const fetchMetaWithRefresh = useCallback(async (id: string) => {
        const tok = tokenRef.current;
        if (!tok) throw new Error("Not authenticated");
        try {
            return await getSpreadsheetMeta(tok, id);
        } catch (err: unknown) {
            if (!is401Error(err)) throw err;
            const fresh = await refreshTokenRef.current();
            if (!fresh) {
                logoutRef.current();
                throw new Error("Sesión expirada. Por favor iniciá sesión nuevamente.");
            }
            setToken(fresh);
            return await getSpreadsheetMeta(fresh, id);
        }
    }, []);

    // Dialogs
    const [showCreator, setShowCreator] = useState(false);
    const [showImporter, setShowImporter] = useState(false);
    const [showExpenseForm, setShowExpenseForm] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [installmentExpense, setInstallmentExpense] = useState<Expense | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    // When there's no sheet yet BUT still loading, show a loading state
    if (!currentSheet && isLoading) {
        return (
            <Box className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <Box className="relative">
                    <Box className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                </Box>
                <Typography variant="h6" className="text-gray-500">
                    Cargando tus gastos...
                </Typography>
                <Typography variant="body2" className="text-gray-400">
                    Conectando con Google Sheets
                </Typography>
            </Box>
        );
    }

    // When loading finished and there's no sheet, show the setup view
    if (!currentSheet) {
        return (
            <>
                <Box className="flex flex-col items-center justify-center py-12 gap-6 text-center">
                    <Typography variant="h5" className="font-semibold! text-gray-700">
                        Bienvenido al Control de Gastos
                    </Typography>
                    <Typography variant="body1" className="text-gray-500 max-w-md">
                        Creá una nueva hoja de gastos mensual o importá una existente desde Google
                        Sheets.
                    </Typography>

                    <Box className="flex flex-col sm:flex-row gap-3">
                        <Button
                            variant="contained"
                            size="large"
                            startIcon={<AddIcon />}
                            onClick={() => setShowCreator(true)}
                        >
                            Nueva Hoja
                        </Button>
                        <Button
                            variant="outlined"
                            size="large"
                            startIcon={<FileOpenIcon />}
                            onClick={() => setShowImporter(true)}
                        >
                            Importar Hoja
                        </Button>
                    </Box>
                </Box>

                <SheetCreator open={showCreator} onClose={() => setShowCreator(false)} />
                <SheetImporter open={showImporter} onClose={() => setShowImporter(false)} />
            </>
        );
    }

    // Active sheet view
    const handleAddExpense = async (data: CreateExpenseData) => {
        setActionError(null);
        try {
            await addExpense({ ...data, createdBy: user?.name || user?.email || "Desconocido" });
        } catch {
            setActionError("Error al guardar el gasto");
            throw new Error();
        }
    };

    const handleEditExpense = async (data: CreateExpenseData) => {
        if (!editingExpense) return;
        setActionError(null);
        try {
            // Preserve createdBy from original — the form always sends ""
            await editExpense(editingExpense.id, {
                ...data,
                createdBy: data.createdBy || editingExpense.createdBy,
            });
            setEditingExpense(null);
        } catch {
            setActionError("Error al actualizar el gasto");
            throw new Error();
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingId) return;
        setActionError(null);
        try {
            await removeExpense(deletingId);
            setDeletingId(null);
        } catch {
            setActionError("Error al eliminar el gasto");
        }
    };

    const handleOpenSheet = async () => {
        if (!currentSheet) return;
        const meta = await fetchMetaWithRefresh(currentSheet.spreadsheetId);
        const url = `https://docs.google.com/spreadsheets/d/${meta.spreadsheetId}`;
        globalThis.open(url, "_blank");
    };

    return (
        <>
            {/* Sheet header */}
            <Paper className="p-3 sm:p-4 mb-3 sm:mb-4!">
                <Box className="flex flex-col gap-2">
                    {/* Top row: month + totals */}
                    <Box className="flex items-center justify-between gap-2">
                        <Box className="flex items-center gap-2 min-w-0">
                            <Typography
                                variant="h6"
                                className="font-semibold! text-base sm:text-xl truncate"
                            >
                                {currentSheet.monthLabel}
                            </Typography>
                            <Chip
                                label={currentSheet.expenses.length}
                                size="small"
                                color="primary"
                                variant="outlined"
                            />
                        </Box>
                        <Chip
                            label="Sheets"
                            size="small"
                            color="primary"
                            variant="outlined"
                            onClick={handleOpenSheet}
                            className="cursor-pointer shrink-0"
                        />
                    </Box>

                    {/* Action buttons */}
                    <Box className="flex gap-1.5 flex-wrap">
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setEditingExpense(null);
                                setShowExpenseForm(true);
                            }}
                        >
                            Gasto
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<CalendarMonthIcon />}
                            onClick={() => setShowCreator(true)}
                        >
                            Nuevo mes (hoja)
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setShowImporter(true)}
                        >
                            Cambiar mes (hoja)
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* Errors */}
            {(error || actionError) && (
                <Alert
                    severity="error"
                    className="mb-4"
                    onClose={() => {
                        clearError();
                        setActionError(null);
                    }}
                >
                    {error || actionError}
                </Alert>
            )}

            {/* Loading */}
            {isLoading
                ? (
                    <Box className="flex justify-center py-12">
                        <CircularProgress />
                    </Box>
                )
                : (
                    <ExpenseTable
                        expenses={currentSheet.expenses}
                        onEdit={(expense) => {
                            setEditingExpense(expense);
                            setShowExpenseForm(true);
                        }}
                        onDelete={(id) => setDeletingId(id)}
                        onViewInstallments={(expense) => setInstallmentExpense(expense)}
                    />
                )}

            {/* Installment detail modal */}
            <InstallmentDetail
                expense={installmentExpense}
                open={!!installmentExpense}
                onClose={() => setInstallmentExpense(null)}
                onMarkPaid={async (id, newCount) => {
                    // Optimistic update: reflect change in the modal immediately
                    setInstallmentExpense((prev) =>
                        prev ? { ...prev, paidInstallments: newCount } : prev
                    );
                    await markInstallmentPaid(id, newCount);
                }}
            />

            {/* Dialogs */}
            <ExpenseForm
                open={showExpenseForm}
                onClose={() => {
                    setShowExpenseForm(false);
                    setEditingExpense(null);
                }}
                onSubmit={editingExpense ? handleEditExpense : handleAddExpense}
                initial={editingExpense
                    ? {
                        description: editingExpense.description,
                        category: editingExpense.category,
                        paymentType: editingExpense.paymentType,
                        currency: editingExpense.currency,
                        amount: editingExpense.amount.toString(),
                        date: editingExpense.date,
                        installments: editingExpense.installments.toString(),
                    }
                    : undefined}
                title={editingExpense ? "Editar Gasto" : "Nuevo Gasto"}
            />

            <ConfirmDelete
                open={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleDeleteConfirm}
            />

            <SheetCreator
                open={showCreator}
                onClose={() => setShowCreator(false)}
                existingSpreadsheetId={currentSheet?.spreadsheetId}
            />
            <SheetImporter
                open={showImporter}
                onClose={() => setShowImporter(false)}
                prefillSpreadsheetId={currentSheet?.spreadsheetId}
            />
        </>
    );
};
