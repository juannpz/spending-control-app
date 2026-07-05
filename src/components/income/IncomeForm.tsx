import { type FormEvent, useEffect, useRef, useState } from "react";
import {
    Autocomplete,
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
} from "@mui/material";
import type { CreateIncomeData, Income, IncomeCategory, IncomeFormData } from "@/types";
import { CURRENCY_LABELS, INCOME_CATEGORY_ENTRIES, INCOME_RECEPTION_ENTRIES } from "@/constants";
import { getTodayISO, hasErrors, validateIncomeForm } from "@/utils";

interface Props {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: CreateIncomeData) => Promise<void>;
    initial?: Partial<IncomeFormData>;
    title?: string;
}

const emptyForm: IncomeFormData = {
    description: "",
    category: "",
    paymentType: "",
    currency: "ARS",
    amount: "",
    date: getTodayISO(),
};

export const IncomeForm = ({
    open,
    onClose,
    onSubmit,
    initial,
    title = "Nuevo Ingreso",
}: Props) => {
    const [form, setForm] = useState<IncomeFormData>(() => ({
        ...emptyForm,
        ...initial,
    }));
    const [errors, setErrors] = useState<ReturnType<typeof validateIncomeForm>>({});
    const [submitting, setSubmitting] = useState(false);

    const initialRef = useRef(initial);
    initialRef.current = initial;
    useEffect(() => {
        if (open) {
            const init = initialRef.current;
            setForm({
                ...emptyForm,
                ...init,
            });
            setErrors({});
        }
    }, [open]);

    const handleChange = (
        e:
            | React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
            | SelectChangeEvent,
    ) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        if (name in errors) {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const validationErrors = validateIncomeForm(form);
        setErrors(validationErrors);
        if (hasErrors(validationErrors)) return;

        setSubmitting(true);
        try {
            await onSubmit({
                movementType: "income",
                description: form.description.trim(),
                category: form.category as Income["category"],
                paymentType: form.paymentType as Income["paymentType"],
                currency: form.currency,
                amount: Number(form.amount),
                date: form.date,
                installments: 1,
                paidInstallments: 0,
                createdBy: "",
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
                        placeholder="Ej: Salario mensual"
                    />

                    {/* Category — searchable Autocomplete */}
                    <FormControl fullWidth error={!!errors.category}>
                        <Autocomplete
                            options={INCOME_CATEGORY_ENTRIES}
                            value={INCOME_CATEGORY_ENTRIES.find(([k]) => k === form.category) ??
                                undefined}
                            onChange={(_e, newValue) => {
                                setForm((prev) => ({
                                    ...prev,
                                    category: (newValue?.[0] ?? "") as IncomeCategory,
                                }));
                                setErrors((prev) => ({ ...prev, category: undefined }));
                            }}
                            getOptionLabel={(option) => option[1]}
                            isOptionEqualToValue={(option, value) => option[0] === value[0]}
                            noOptionsText="Sin resultados"
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Categoría"
                                    error={!!errors.category}
                                />
                            )}
                            disableClearable
                            slotProps={{
                                listbox: { style: { maxHeight: 220 } },
                            }}
                        />
                        {errors.category && <FormHelperText>{errors.category}</FormHelperText>}
                    </FormControl>

                    {/* Reception Type */}
                    <FormControl fullWidth error={!!errors.paymentType}>
                        <InputLabel id="reception-label">Medio de Recepción</InputLabel>
                        <Select
                            labelId="reception-label"
                            name="paymentType"
                            value={form.paymentType}
                            label="Medio de Recepción"
                            onChange={handleChange}
                        >
                            {INCOME_RECEPTION_ENTRIES.map(([key, label]) => (
                                <MenuItem key={key} value={key}>
                                    {label}
                                </MenuItem>
                            ))}
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
                                htmlInput: { min: 0, step: 0.01, inputMode: "decimal" },
                            }}
                        />
                    </div>
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
