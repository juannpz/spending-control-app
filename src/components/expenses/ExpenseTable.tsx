import { useMemo, useState } from "react";
import {
    Avatar,
    Box,
    Chip,
    Collapse,
    Dialog,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    type SelectChangeEvent,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import DescriptionIcon from "@mui/icons-material/Description";
import type { Currency, Expense } from "@/types";
import { formatCurrency, formatDate } from "@/utils";
import { CATEGORY_LABELS, PAYMENT_TYPE_LABELS } from "@/constants";

interface Props {
    expenses: Expense[];
    onEdit: (expense: Expense) => void;
    onDelete: (id: string) => void;
    onViewInstallments: (expense: Expense) => void;
}

type PersonBreakdown = Record<string, { name: string; ars: number; usd: number; count: number }>;

export const ExpenseTable = ({ expenses, onEdit, onDelete, onViewInstallments }: Props) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filterText, setFilterText] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [showByPerson, setShowByPerson] = useState(false);
    const [descModal, setDescModal] = useState<{ open: boolean; text: string }>({
        open: false,
        text: "",
    });

    const filtered = useMemo(() => {
        return expenses.filter((e) => {
            const matchesText = !filterText ||
                e.description.toLowerCase().includes(filterText.toLowerCase());
            const matchesCat = filterCategory === "all" || e.category === filterCategory;
            return matchesText && matchesCat;
        });
    }, [expenses, filterText, filterCategory]);

    const totals = useMemo(() => {
        return filtered.reduce(
            (acc, e) => {
                acc[e.currency] += e.amount;
                return acc;
            },
            { ARS: 0, USD: 0 } as Record<Currency, number>,
        );
    }, [filtered]);

    const byPerson = useMemo((): PersonBreakdown => {
        const map: PersonBreakdown = {};
        for (const e of filtered) {
            const key = e.createdBy || "Desconocido";
            if (!map[key]) map[key] = { name: key, ars: 0, usd: 0, count: 0 };
            map[key][e.currency === "ARS" ? "ars" : "usd"] += e.amount;
            map[key].count += 1;
        }
        return map;
    }, [filtered]);

    const persons = Object.values(byPerson).sort((a, b) => b.ars + b.usd - (a.ars + a.usd));

    const paged = useMemo(
        () => filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
        [filtered, page, rowsPerPage],
    );

    const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(Number(e.target.value));
        setPage(0);
    };

    if (expenses.length === 0) {
        return (
            <Box className="text-center py-8 text-gray-500">
                <Typography variant="h6">No hay gastos cargados</Typography>
                <Typography variant="body2">Usá el botón "Nuevo Gasto" para empezar</Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Filters */}
            <Box className="flex flex-col sm:flex-row gap-2 mb-3">
                <TextField
                    size="small"
                    label="Buscar"
                    value={filterText}
                    onChange={(e) => {
                        setFilterText(e.target.value);
                        setPage(0);
                    }}
                    className="flex-1"
                    placeholder="Filtrar por descripción..."
                />
                <FormControl size="small" className="sm:w-48">
                    <InputLabel id="filter-cat-m">Categoría</InputLabel>
                    <Select
                        labelId="filter-cat-m"
                        value={filterCategory}
                        label="Categoría"
                        onChange={(e: SelectChangeEvent<string>) => {
                            setFilterCategory(e.target.value);
                            setPage(0);
                        }}
                    >
                        <MenuItem value="all">Todas</MenuItem>
                        {(Object.entries(CATEGORY_LABELS) as [string, string][]).map(([k, v]) => (
                            <MenuItem key={k} value={k}>{v}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            </Box>

            {/* Totals bar */}
            <Box className="bg-blue-50 rounded-lg p-3 mb-3">
                <Box className="flex flex-wrap gap-2 items-center">
                    <Chip
                        label={`Total ARS: ${formatCurrency(totals.ARS, "ARS")}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        label={`Total USD: ${formatCurrency(totals.USD, "USD")}`}
                        color="secondary"
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        label={`${filtered.length} gasto${filtered.length !== 1 ? "s" : ""}`}
                        variant="outlined"
                        size="small"
                    />
                </Box>

                {persons.length > 0 && (
                    <Box className="mt-2">
                        <Box
                            className="flex items-center gap-1 cursor-pointer text-blue-700"
                            onClick={() => setShowByPerson(!showByPerson)}
                            component="button"
                            sx={{ border: "none", bgcolor: "transparent", p: 0 }}
                        >
                            <Typography variant="caption" className="font-semibold!">
                                {showByPerson ? "Ocultar por persona ▾" : "Ver por persona ▸"}
                            </Typography>
                        </Box>
                        <Collapse in={showByPerson}>
                            <Box className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {persons.map((p) => (
                                    <Paper
                                        key={p.name}
                                        variant="outlined"
                                        className="p-2 flex items-center gap-3"
                                    >
                                        <Avatar
                                            sx={{
                                                width: 32,
                                                height: 32,
                                                fontSize: 14,
                                                bgcolor: "primary.main",
                                            }}
                                        >
                                            {p.name.charAt(0).toUpperCase()}
                                        </Avatar>
                                        <Box className="flex-1 min-w-0">
                                            <Typography
                                                variant="body2"
                                                className="font-semibold! truncate"
                                            >
                                                {p.name}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary">
                                                {p.count} gasto{p.count !== 1 ? "s" : ""}
                                            </Typography>
                                        </Box>
                                        <Box className="text-right shrink-0">
                                            {p.ars > 0 && (
                                                <Typography
                                                    variant="body2"
                                                    className="font-semibold! whitespace-nowrap"
                                                >
                                                    {formatCurrency(p.ars, "ARS")}
                                                </Typography>
                                            )}
                                            {p.usd > 0 && (
                                                <Typography
                                                    variant="body2"
                                                    className="font-semibold! whitespace-nowrap"
                                                    color="secondary"
                                                >
                                                    {formatCurrency(p.usd, "USD")}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        </Collapse>
                    </Box>
                )}
            </Box>

            {/* Table with sticky actions column */}
            <Box className="overflow-x-auto -mx-3 sm:mx-0 w-[calc(100%+1.5rem)] sm:w-full">
                <TableContainer
                    component={Paper}
                    variant="outlined"
                    className="rounded-none sm:rounded-lg"
                >
                    <Table size="small" className="min-w-[600px]">
                        <TableHead>
                            <TableRow className="bg-gray-50">
                                <TableCell className="whitespace-nowrap">Fecha</TableCell>
                                <TableCell className="whitespace-nowrap">Descripción</TableCell>
                                <TableCell className="whitespace-nowrap hidden sm:table-cell">
                                    Categ.
                                </TableCell>
                                <TableCell className="whitespace-nowrap">Tipo</TableCell>
                                <TableCell className="whitespace-nowrap hidden md:table-cell">
                                    Agregó
                                </TableCell>
                                <TableCell align="right" className="whitespace-nowrap">
                                    Monto
                                </TableCell>
                                <TableCell
                                    align="center"
                                    className="whitespace-nowrap sticky right-0 bg-gray-50 z-10"
                                    sx={{ boxShadow: "-4px 0 4px -4px rgba(0,0,0,0.1)" }}
                                >
                                    Acc.
                                </TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paged.map((expense) => {
                                const isCredit = expense.paymentType === "credito";
                                const remainingInstallments = isCredit
                                    ? expense.installments - expense.paidInstallments
                                    : 0;
                                const isLong = expense.description.length > 25;

                                return (
                                    <TableRow key={expense.id} hover>
                                        <TableCell className="whitespace-nowrap text-xs">
                                            {formatDate(expense.date)}
                                        </TableCell>
                                        <TableCell className="max-w-[110px] sm:max-w-[180px]">
                                            <Box className="flex items-center gap-0.5">
                                                <Typography
                                                    variant="body2"
                                                    noWrap
                                                    className="flex-1 min-w-0"
                                                >
                                                    {expense.description}
                                                </Typography>
                                                {isLong && (
                                                    <Tooltip title="Ver texto completo">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() =>
                                                                setDescModal({
                                                                    open: true,
                                                                    text: expense.description,
                                                                })}
                                                            sx={{ p: 0.25, flexShrink: 0 }}
                                                        >
                                                            <DescriptionIcon
                                                                sx={{ fontSize: 16 }}
                                                            />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap hidden sm:table-cell text-xs">
                                            {CATEGORY_LABELS[expense.category] ?? expense.category}
                                        </TableCell>
                                        <TableCell>
                                            <Box className="flex items-center gap-1">
                                                <Typography
                                                    variant="caption"
                                                    className="whitespace-nowrap"
                                                >
                                                    {PAYMENT_TYPE_LABELS[expense.paymentType] ??
                                                        expense.paymentType}
                                                </Typography>
                                                {isCredit && (
                                                    <Chip
                                                        icon={
                                                            <ReceiptLongIcon
                                                                sx={{ fontSize: 14 }}
                                                            />
                                                        }
                                                        label={expense.paidInstallments > 0
                                                            ? `${expense.paidInstallments}/${expense.installments}`
                                                            : expense.installments}
                                                        size="small"
                                                        color={remainingInstallments === 0
                                                            ? "success"
                                                            : "warning"}
                                                        variant="outlined"
                                                        sx={{
                                                            "& .MuiChip-label": {
                                                                px: 0.5,
                                                                fontSize: 11,
                                                            },
                                                        }}
                                                    />
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap hidden md:table-cell">
                                            <Typography variant="caption" className="text-gray-600">
                                                {expense.createdBy || "—"}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="right" className="whitespace-nowrap">
                                            <Typography variant="body2" className="font-semibold!">
                                                {formatCurrency(expense.amount, expense.currency)}
                                            </Typography>
                                        </TableCell>
                                        <TableCell
                                            align="center"
                                            className="sticky right-0 bg-white"
                                            sx={{ boxShadow: "-4px 0 4px -4px rgba(0,0,0,0.1)" }}
                                        >
                                            <Box className="flex items-center justify-center gap-0.5">
                                                {isCredit && (
                                                    <Tooltip title="Cuotas">
                                                        <IconButton
                                                            size="small"
                                                            color="info"
                                                            onClick={() =>
                                                                onViewInstallments(expense)}
                                                            sx={{ p: 0.5 }}
                                                        >
                                                            <ReceiptLongIcon
                                                                sx={{ fontSize: 18 }}
                                                            />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                                <Tooltip title="Editar">
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        onClick={() => onEdit(expense)}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        <EditIcon sx={{ fontSize: 18 }} />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Eliminar">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => onDelete(expense.id)}
                                                        sx={{ p: 0.5 }}
                                                    >
                                                        <DeleteIcon sx={{ fontSize: 18 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {paged.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={7}
                                        align="center"
                                        className="text-gray-400 py-6"
                                    >
                                        Sin resultados para los filtros aplicados
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>

            <TablePagination
                component="div"
                count={filtered.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                rowsPerPageOptions={[5, 10, 25, 50]}
                labelRowsPerPage="Filas:"
                labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
            />

            {/* Description detail modal */}
            <Dialog
                open={descModal.open}
                onClose={() => setDescModal({ open: false, text: "" })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Descripción completa</DialogTitle>
                <DialogContent>
                    <Typography className="whitespace-pre-wrap break-words">
                        {descModal.text}
                    </Typography>
                </DialogContent>
            </Dialog>
        </Box>
    );
};
