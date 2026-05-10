import { type FormEvent, useEffect, useRef, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormHelperText,
    InputLabel,
    MenuItem,
    Select,
    type SelectChangeEvent,
    TextField,
    Typography,
} from "@mui/material";
import type { ExpenseFormData } from "@/types";
import { CATEGORY_LABELS, CURRENCY_LABELS, PAYMENT_TYPE_LABELS } from "@/constants";
import { getTodayISO, hasErrors, validateExpenseForm } from "@/utils";
import type { Expense } from "@/types";

interface Props {
    open: boolean;
    onClose: () => void;
    onSubmit: (
        data: Omit<Expense, "id" | "createdAt" | "updatedAt">,
    ) => Promise<void>;
    initial?: Partial<ExpenseFormData> & { paidInstallments?: number };
    title?: string;
}

const emptyForm: ExpenseFormData = {
    description: "",
    category: "",
    paymentType: "",
    currency: "ARS",
    amount: "",
    date: getTodayISO(),
    installments: "",
};

export const ExpenseForm = ({
    open,
    onClose,
    onSubmit,
    initial,
    title = "Nuevo Gasto",
}: Props) => {
    const [form, setForm] = useState<ExpenseFormData>(() => ({
        ...emptyForm,
        ...initial,
    }));
    const [errors, setErrors] = useState<ReturnType<typeof validateExpenseForm>>({});
    const [submitting, setSubmitting] = useState(false);

    // Reset form only when the dialog opens (not on every initial change)
    const initialRef = useRef(initial);
    initialRef.current = initial;
    useEffect(() => {
        if (open) {
            const init = initialRef.current;
            setForm({
                ...emptyForm,
                ...init,
                installments: init?.installments ?? "",
            });
            setErrors({});
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const isCredit = form.paymentType === "credito";

    const handleChange = (
        e:
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
            | SelectChangeEvent,
    ) => {
        const { name, value } = e.target;
        setForm((prev) => {
            const next = { ...prev, [name]: value };
            // If switching away from credito, reset installments
            if (name === "paymentType" && value !== "credito") {
                next.installments = "";
            }
            return next;
        });
        // Clear individual error
        if (name in errors) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const validationErrors = validateExpenseForm(form);
        setErrors(validationErrors);
        if (hasErrors(validationErrors)) return;

        setSubmitting(true);
        try {
            const installments = isCredit ? Number(form.installments) : 1;
            await onSubmit({
                description: form.description.trim(),
                category: form.category as Expense["category"],
                paymentType: form.paymentType as Expense["paymentType"],
                currency: form.currency,
                amount: Number(form.amount),
                date: form.date,
                installments,
                paidInstallments: 0,
                createdBy: "", // filled by DashboardPage via user
            });
            setForm(emptyForm);
            setErrors({});
            onClose();
        } catch {
            // handled in parent
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setErrors({});
        if (!initial) setForm(emptyForm);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <form onSubmit={handleSubmit}>
                <DialogTitle>{title}</DialogTitle>
                <DialogContent className="flex flex-col gap-3 pt-2!">
                    {/* Date */}
                    <TextField
                        label="Fecha"
                        name="date"
                        type="date"
                        value={form.date}
                        onChange={handleChange}
                        slotProps={{ inputLabel: { shrink: true } }}
                        fullWidth
                        error={!!errors.date}
                        helperText={errors.date}
                    />

                    {/* Description */}
                    <TextField
                        label="Descripción"
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        fullWidth
                        error={!!errors.description}
                        helperText={errors.description}
                        placeholder="Ej: Compra supermercado"
                    />

                    {/* Category */}
                    <FormControl fullWidth error={!!errors.category}>
                        <InputLabel id="cat-label">Categoría</InputLabel>
                        <Select
                            labelId="cat-label"
                            name="category"
                            value={form.category}
                            label="Categoría"
                            onChange={handleChange}
                        >
                            {(Object.entries(CATEGORY_LABELS) as [string, string][]).map(
                                ([key, label]) => (
                                    <MenuItem key={key} value={key}>
                                        {label}
                                    </MenuItem>
                                ),
                            )}
                        </Select>
                        {errors.category && <FormHelperText>{errors.category}</FormHelperText>}
                    </FormControl>

                    {/* Payment Type */}
                    <FormControl fullWidth error={!!errors.paymentType}>
                        <InputLabel id="pay-label">Tipo de Pago</InputLabel>
                        <Select
                            labelId="pay-label"
                            name="paymentType"
                            value={form.paymentType}
                            label="Tipo de Pago"
                            onChange={handleChange}
                        >
                            {(Object.entries(PAYMENT_TYPE_LABELS) as [string, string][]).map(
                                ([key, label]) => (
                                    <MenuItem key={key} value={key}>
                                        {label}
                                    </MenuItem>
                                ),
                            )}
                        </Select>
                        {errors.paymentType && <FormHelperText>{errors.paymentType}
                        </FormHelperText>}
                    </FormControl>

                    {/* Currency + Amount in one row */}
                    <div className="flex gap-2">
                        <FormControl className="w-2/5">
                            <InputLabel id="curr-label">Moneda</InputLabel>
                            <Select
                                labelId="curr-label"
                                name="currency"
                                value={form.currency}
                                label="Moneda"
                                onChange={handleChange}
                            >
                                {(Object.entries(CURRENCY_LABELS) as [string, string][]).map(
                                    ([key, label]) => (
                                        <MenuItem key={key} value={key}>
                                            {label}
                                        </MenuItem>
                                    ),
                                )}
                            </Select>
                        </FormControl>
                        <TextField
                            className="w-3/5"
                            label="Monto"
                            name="amount"
                            type="number"
                            value={form.amount}
                            onChange={handleChange}
                            fullWidth
                            error={!!errors.amount}
                            helperText={errors.amount}
                            placeholder="0.00"
                            slotProps={{
                                htmlInput: { min: 0, step: 0.01 },
                            }}
                        />
                    </div>

                    {/* Installments — only for crédito */}
                    {isCredit && (
                        <div className="bg-indigo-50 rounded-lg p-3 flex flex-col gap-1">
                            <Typography variant="body2" className="font-semibold text-indigo-800">
                                Configuración de cuotas
                            </Typography>
                            <TextField
                                label="Cantidad de cuotas"
                                name="installments"
                                type="number"
                                value={form.installments}
                                onChange={handleChange}
                                fullWidth
                                error={!!errors.installments}
                                helperText={errors.installments ||
                                    "Total a pagar en cada cuota: " +
                                        (form.amount && Number(form.amount) > 0 && form.installments
                                            ? `$${
                                                (
                                                    Number(form.amount) / Number(form.installments)
                                                ).toLocaleString("es-AR", {
                                                    minimumFractionDigits: 2,
                                                    maximumFractionDigits: 2,
                                                })
                                            }`
                                            : "-")}
                                slotProps={{
                                    htmlInput: { min: 1, max: 48, step: 1 },
                                }}
                            />
                        </div>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={submitting}>
                        Cancelar
                    </Button>
                    <Button type="submit" variant="contained" disabled={submitting}>
                        {submitting ? "Guardando..." : "Guardar"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
