import { useMemo, useState } from "react";
import {
    Autocomplete,
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
    ListItemIcon,
    ListItemText,
    Menu,
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
    Typography,
} from "@mui/material";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import DescriptionIcon from "@mui/icons-material/Description";
import type { Currency, Expense, ExpenseCategory } from "@/types";
import { formatCurrency, formatDate } from "@/utils";
import { CATEGORY_ENTRIES, CATEGORY_LABELS, PAYMENT_TYPE_LABELS } from "@/constants";

interface Props {
    expenses: Expense[];
    onEdit: (expense: Expense) => void;
    onDelete: (id: string) => void;
    onViewInstallments: (expense: Expense) => void;
}

type PersonBreakdown = Record<string, { name: string; ars: number; usd: number; count: number }>;

/** 3-dot actions menu — shared between mobile cards and desktop rows.
 *  Keyed by expense.id so React never reuses Menu/Popover DOM across different rows. */
const ActionsMenu = ({
    expense,
    onEdit,
    onDelete,
    onViewInstallments,
}: {
    expense: Expense;
    onEdit: (e: Expense) => void;
    onDelete: (id: string) => void;
    onViewInstallments: (e: Expense) => void;
}) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const isCredit = expense.paymentType === "credito";

    return (
        <>
            <IconButton
                size="small"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                sx={{ p: 0.5 }}
                aria-label="Acciones"
            >
                <MoreHorizIcon sx={{ fontSize: 20 }} />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={!!anchorEl}
                onClose={() => setAnchorEl(null)}
                anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                transformOrigin={{ horizontal: "right", vertical: "top" }}
            >
                {isCredit && (
                    <MenuItem
                        onClick={() => {
                            setAnchorEl(null);
                            onViewInstallments(expense);
                        }}
                    >
                        <ListItemIcon>
                            <ReceiptLongIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Ver cuotas</ListItemText>
                    </MenuItem>
                )}
                <MenuItem
                    onClick={() => {
                        setAnchorEl(null);
                        onEdit(expense);
                    }}
                >
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Editar</ListItemText>
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        setAnchorEl(null);
                        onDelete(expense.id);
                    }}
                >
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText>Eliminar</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
};

/** Single expense card for mobile view */
const ExpenseCard = ({
    expense,
    onEdit,
    onDelete,
    onViewInstallments,
    onViewDesc,
}: {
    expense: Expense;
    onEdit: (e: Expense) => void;
    onDelete: (id: string) => void;
    onViewInstallments: (e: Expense) => void;
    onViewDesc: (text: string) => void;
}) => {
    const isCredit = expense.paymentType === "credito";
    const remaining = isCredit ? expense.installments - expense.paidInstallments : 0;

    return (
        <Paper variant="outlined" className="p-3 flex flex-col gap-2 relative">
            {/* 3-dot menu — top-right corner, always visible */}
            <Box className="absolute top-1 right-1 z-10">
                <ActionsMenu
                    key={expense.id}
                    expense={expense}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onViewInstallments={onViewInstallments}
                />
            </Box>

            {/* Top row: date + amount (leave room for the 3-dot button) */}
            <Box className="flex justify-between items-start pr-9">
                <Typography variant="caption" color="text.secondary">
                    {formatDate(expense.date)}
                </Typography>
                <Typography variant="body1" className="font-bold!">
                    {formatCurrency(expense.amount, expense.currency)}
                </Typography>
            </Box>

            {/* Description */}
            <Box className="flex items-start gap-1 pr-9">
                <Typography variant="body2" className="font-medium! flex-1">
                    {expense.description}
                </Typography>
                {expense.description.length > 30 && (
                    <IconButton
                        size="small"
                        onClick={() => onViewDesc(expense.description)}
                        sx={{ p: 0.25, mt: -0.25 }}
                    >
                        <DescriptionIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                )}
            </Box>

            {/* Category + Payment type + Person */}
            <Box className="flex flex-wrap gap-1.5 items-center">
                <Chip
                    label={CATEGORY_LABELS[expense.category] ?? expense.category}
                    size="small"
                    variant="outlined"
                />
                <Chip
                    label={PAYMENT_TYPE_LABELS[expense.paymentType] ?? expense.paymentType}
                    size="small"
                    variant="outlined"
                    color="primary"
                />
                {isCredit && (
                    <Chip
                        icon={<ReceiptLongIcon sx={{ fontSize: 14 }} />}
                        label={expense.paidInstallments > 0
                            ? `${expense.paidInstallments}/${expense.installments}`
                            : `${expense.installments}c`}
                        size="small"
                        color={remaining === 0 ? "success" : "warning"}
                        variant="outlined"
                    />
                )}
                <Typography variant="caption" color="text.secondary" className="ml-auto">
                    {expense.createdBy || "—"}
                </Typography>
            </Box>
        </Paper>
    );
};

/** Column widths for the desktop table (used in table-layout: fixed) */
const COL_WIDTHS = {
    actions: 48,
    amount: 110,
    category: 115,
    createdBy: 100,
    date: 95,
    paymentType: 155,
    /* description gets the remaining space */
} as const;

export const ExpenseTable = ({
    expenses,
    onEdit,
    onDelete,
    onViewInstallments,
}: Props) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [filterText, setFilterText] = useState("");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [showByPerson, setShowByPerson] = useState(false);
    const [descModal, setDescModal] = useState<{
        open: boolean;
        text: string;
    }>({ open: false, text: "" });

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

    const persons = Object.values(byPerson).sort(
        (a, b) => b.ars + b.usd - (a.ars + a.usd),
    );

    const paged = useMemo(
        () => filtered.slice(page * rowsPerPage, (page + 1) * rowsPerPage),
        [filtered, page, rowsPerPage],
    );

    const handleChangePage = (_: unknown, newPage: number) => setPage(newPage);
    const handleChangeRowsPerPage = (
        e: React.ChangeEvent<HTMLInputElement>,
    ) => {
        setRowsPerPage(Number(e.target.value));
        setPage(0);
    };

    if (expenses.length === 0) {
        return (
            <Box className="text-center py-8 text-gray-500">
                <Typography variant="h6">No hay gastos cargados</Typography>
                <Typography variant="body2">
                    Usá el botón "Nuevo Gasto" para empezar
                </Typography>
            </Box>
        );
    }

    // ---- Sticky-cell shared styles ----
    const stickyActionsSx = {
        position: "sticky",
        right: 0,
        zIndex: 1,
        bgcolor: "background.paper",
    } as const;

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
                <FormControl size="small" className="sm:w-52">
                    <Autocomplete
                        size="small"
                        options={CATEGORY_ENTRIES}
                        value={CATEGORY_ENTRIES.find(([k]) => k === filterCategory) ?? null}
                        onChange={(_e, newValue) => {
                            setFilterCategory(newValue?.[0] ?? "all");
                            setPage(0);
                        }}
                        getOptionLabel={(option) => option[1]}
                        isOptionEqualToValue={(option, value) => option[0] === value[0]}
                        noOptionsText="Sin resultados"
                        renderInput={(params) => <TextField {...params} label="Categoría" />}
                        slotProps={{
                            listbox: { style: { maxHeight: 220 } },
                        }}
                    />
                </FormControl>
            </Box>

            {/* Totals bar */}
            <Box className="bg-blue-50 rounded-lg p-3 mb-3">
                <Box className="flex flex-wrap gap-2 items-center">
                    <Chip
                        label={`ARS: ${formatCurrency(totals.ARS, "ARS")}`}
                        color="primary"
                        variant="outlined"
                        size="small"
                    />
                    <Chip
                        label={`USD: ${formatCurrency(totals.USD, "USD")}`}
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

            {/* ---- MOBILE: Cards ---- */}
            <Box className="flex flex-col gap-2 sm:hidden">
                {paged.map((expense) => (
                    <ExpenseCard
                        key={expense.id}
                        expense={expense}
                        onEdit={onEdit}
                        onDelete={onDelete}
                        onViewInstallments={onViewInstallments}
                        onViewDesc={(text) => setDescModal({ open: true, text })}
                    />
                ))}
                {paged.length === 0 && (
                    <Typography className="text-center text-gray-400 py-6">
                        Sin resultados para los filtros aplicados
                    </Typography>
                )}
            </Box>

            {/* ---- DESKTOP: Table ---- */}
            <Box className="hidden sm:block">
                <TableContainer component={Paper} variant="outlined" className="rounded-lg">
                    <Table
                        size="small"
                        sx={{ tableLayout: "fixed", minWidth: 500 }}
                    >
                        {/* Column group for explicit widths */}
                        <colgroup>
                            <col style={{ width: COL_WIDTHS.date }} />
                            <col /* description — flexible */ />
                            <col style={{ width: COL_WIDTHS.category }} />
                            <col style={{ width: COL_WIDTHS.paymentType }} />
                            <col
                                style={{ width: COL_WIDTHS.createdBy }}
                                className="hidden lg:table-column"
                            />
                            <col style={{ width: COL_WIDTHS.amount }} />
                            <col style={{ width: COL_WIDTHS.actions }} />
                        </colgroup>

                        <TableHead>
                            <TableRow className="bg-gray-50">
                                <TableCell className="whitespace-nowrap font-semibold!">
                                    Fecha
                                </TableCell>
                                <TableCell className="whitespace-nowrap font-semibold!">
                                    Descripción
                                </TableCell>
                                <TableCell className="whitespace-nowrap font-semibold!">
                                    Categ.
                                </TableCell>
                                <TableCell className="whitespace-nowrap font-semibold!">
                                    Tipo
                                </TableCell>
                                <TableCell className="whitespace-nowrap font-semibold! hidden lg:table-cell">
                                    Autor
                                </TableCell>
                                <TableCell
                                    align="right"
                                    className="whitespace-nowrap font-semibold!"
                                >
                                    Monto
                                </TableCell>
                                <TableCell
                                    align="center"
                                    className="whitespace-nowrap font-semibold!"
                                    sx={{ ...stickyActionsSx, bgcolor: "#f9fafb" }}
                                />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {paged.map((expense) => {
                                const isCredit = expense.paymentType === "credito";
                                const remainingInstallments = isCredit
                                    ? expense.installments - expense.paidInstallments
                                    : 0;
                                const isLong = expense.description.length > 30;

                                return (
                                    <TableRow key={expense.id} hover>
                                        <TableCell className="whitespace-nowrap text-xs">
                                            {formatDate(expense.date)}
                                        </TableCell>

                                        <TableCell className="max-w-0">
                                            <Box className="flex items-center gap-0.5">
                                                <Typography
                                                    variant="body2"
                                                    noWrap
                                                    className="flex-1 min-w-0"
                                                >
                                                    {expense.description}
                                                </Typography>
                                                {isLong && (
                                                    <IconButton
                                                        size="small"
                                                        onClick={() =>
                                                            setDescModal({
                                                                open: true,
                                                                text: expense.description,
                                                            })}
                                                        sx={{ p: 0.25, flexShrink: 0 }}
                                                    >
                                                        <DescriptionIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                )}
                                            </Box>
                                        </TableCell>

                                        <TableCell
                                            className="whitespace-nowrap text-xs"
                                            sx={{ overflow: "hidden", textOverflow: "ellipsis" }}
                                        >
                                            {CATEGORY_LABELS[expense.category] ?? expense.category}
                                        </TableCell>

                                        <TableCell
                                            sx={{ overflow: "hidden" }}
                                        >
                                            <Box className="flex items-center gap-1 flex-nowrap">
                                                <Typography variant="caption" noWrap>
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

                                        <TableCell
                                            className="hidden lg:table-cell"
                                            sx={{
                                                maxWidth: COL_WIDTHS.createdBy,
                                                overflow: "hidden",
                                            }}
                                        >
                                            <Typography
                                                variant="caption"
                                                className="text-gray-600"
                                                noWrap
                                            >
                                                {expense.createdBy || "—"}
                                            </Typography>
                                        </TableCell>

                                        <TableCell align="right" className="whitespace-nowrap">
                                            <Typography variant="body2" className="font-semibold!">
                                                {formatCurrency(expense.amount, expense.currency)}
                                            </Typography>
                                        </TableCell>

                                        {/* Sticky actions column */}
                                        <TableCell align="center" sx={stickyActionsSx}>
                                            <ActionsMenu
                                                key={expense.id}
                                                expense={expense}
                                                onEdit={onEdit}
                                                onDelete={onDelete}
                                                onViewInstallments={onViewInstallments}
                                            />
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

            {/* Description modal */}
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
