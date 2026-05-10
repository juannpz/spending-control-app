import { useState } from "react";
import {
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    IconButton,
    Tooltip,
    Typography,
} from "@mui/material";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import type { Expense } from "@/types";
import { formatCurrency } from "@/utils";
import { CATEGORY_LABELS, CURRENCY_SYMBOLS } from "@/constants";

interface Props {
    expense: Expense | null;
    open: boolean;
    onClose: () => void;
    onMarkPaid: (id: string, newPaidCount: number) => void;
}

const InstallmentDetail = ({ expense, open, onClose, onMarkPaid }: Props) => {
    const [loading, setLoading] = useState(false);

    if (!expense) return null;

    const total = expense.installments;
    const paid = expense.paidInstallments;
    const pending = total - paid;
    const amountPerInstallment = total > 0 ? expense.amount / total : expense.amount;
    const remaining = pending * amountPerInstallment;
    const paidTotal = paid * amountPerInstallment;

    const handleMarkNextPaid = async () => {
        if (paid >= total) return;
        setLoading(true);
        try {
            await onMarkPaid(expense.id, paid + 1);
        } finally {
            setLoading(false);
        }
    };

    const handleUndoPaid = async () => {
        if (paid <= 0) return;
        setLoading(true);
        try {
            await onMarkPaid(expense.id, paid - 1);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Detalle de cuotas</DialogTitle>

            <DialogContent className="flex flex-col gap-4 pt-2!">
                {/* Expense summary */}
                <Box className="bg-gray-50 rounded-lg p-3 flex flex-col gap-1">
                    <Typography variant="subtitle1" className="font-semibold!">
                        {expense.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {CATEGORY_LABELS[expense.category]} — Crédito
                    </Typography>
                    <Typography variant="h6" className="font-bold! text-blue-700">
                        {formatCurrency(expense.amount, expense.currency)}
                    </Typography>
                </Box>

                {/* Installment overview */}
                <Box className="flex flex-wrap gap-3 justify-center">
                    <Chip
                        icon={<CheckCircleIcon />}
                        label={`${paid} pagada${paid !== 1 ? "s" : ""}`}
                        color="success"
                        variant="outlined"
                    />
                    <Chip
                        icon={<RadioButtonUncheckedIcon />}
                        label={`${pending} pendiente${pending !== 1 ? "s" : ""}`}
                        color="warning"
                        variant="outlined"
                    />
                    <Chip label={`${total} total`} variant="outlined" />
                </Box>

                <Divider />

                {/* Financial summary */}
                <Box className="flex flex-col gap-2">
                    <Box className="flex justify-between">
                        <Typography variant="body2">Monto por cuota:</Typography>
                        <Typography variant="body2" className="font-semibold">
                            {formatCurrency(amountPerInstallment, expense.currency)}
                        </Typography>
                    </Box>
                    <Box className="flex justify-between">
                        <Typography variant="body2" color="success.main">
                            Total pagado:
                        </Typography>
                        <Typography variant="body2" className="font-semibold" color="success.main">
                            {formatCurrency(paidTotal, expense.currency)}
                        </Typography>
                    </Box>
                    <Box className="flex justify-between">
                        <Typography variant="body2" color="warning.main">
                            Total pendiente:
                        </Typography>
                        <Typography variant="body2" className="font-semibold" color="warning.main">
                            {formatCurrency(remaining, expense.currency)}
                        </Typography>
                    </Box>
                </Box>

                <Divider />

                {/* Visual installment tracker */}
                <Box>
                    <Typography variant="body2" className="mb-2 font-medium">
                        Progreso
                    </Typography>
                    <Box className="flex flex-wrap gap-2">
                        {Array.from({ length: total }, (_, i) => (
                            <Tooltip
                                key={i}
                                title={`Cuota ${i + 1}: ${i < paid ? "Pagada" : "Pendiente"} — ${
                                    formatCurrency(amountPerInstallment, expense.currency)
                                }`}
                            >
                                <Box className="flex flex-col items-center gap-0.5">
                                    {i < paid
                                        ? <CheckCircleIcon color="success" fontSize="small" />
                                        : (
                                            <RadioButtonUncheckedIcon
                                                color="disabled"
                                                fontSize="small"
                                            />
                                        )}
                                    <Typography variant="caption" className="leading-none">
                                        {i + 1}
                                    </Typography>
                                </Box>
                            </Tooltip>
                        ))}
                    </Box>
                </Box>

                {/* Progress bar */}
                <Box className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <Box
                        className="bg-green-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${total > 0 ? (paid / total) * 100 : 0}%` }}
                    />
                </Box>
            </DialogContent>

            <DialogActions className="justify-between! px-6!">
                <Button
                    onClick={handleUndoPaid}
                    disabled={paid <= 0 || loading}
                    color="inherit"
                    size="small"
                >
                    Desmarcar pago
                </Button>
                <Box className="flex gap-2">
                    <Button onClick={onClose} disabled={loading}>
                        Cerrar
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={handleMarkNextPaid}
                        disabled={paid >= total || loading}
                        startIcon={<CheckCircleOutlineIcon />}
                    >
                        {loading ? "..." : "Marcar cuota como pagada"}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
};

export default InstallmentDetail;
