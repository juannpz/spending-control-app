import { type FormEvent, useState } from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    type SelectChangeEvent,
    TextField,
} from "@mui/material";
import { useSheets } from "@/contexts/SheetsContext";
import { MONTH_NAMES } from "@/constants";

interface Props {
    open: boolean;
    onClose: () => void;
    existingSpreadsheetId?: string;
}

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => currentYear + i);
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

export const SheetCreator = ({ open, onClose, existingSpreadsheetId }: Props) => {
    const { createSheet, isLoading, error, clearError } = useSheets();
    const [year, setYear] = useState(currentYear);
    const [month, setMonth] = useState(new Date().getMonth() + 1);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        try {
            await createSheet(year, month, existingSpreadsheetId);
            onClose();
        } catch {
            // error is handled in context
        }
    };

    const handleClose = () => {
        clearError();
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
            <form onSubmit={handleSubmit}>
                <DialogTitle>Nueva Hoja de Gastos</DialogTitle>
                <DialogContent className="flex flex-col gap-3 pt-2!">
                    {error && <Alert severity="error" onClose={clearError}>{error}</Alert>}
                    <FormControl fullWidth>
                        <InputLabel id="sheet-year-label">Año</InputLabel>
                        <Select
                            labelId="sheet-year-label"
                            value={year}
                            label="Año"
                            onChange={(e: SelectChangeEvent<number>) =>
                                setYear(Number(e.target.value))}
                        >
                            {YEARS.map((y) => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <FormControl fullWidth>
                        <InputLabel id="sheet-month-label">Mes</InputLabel>
                        <Select
                            labelId="sheet-month-label"
                            value={month}
                            label="Mes"
                            onChange={(e: SelectChangeEvent<number>) =>
                                setMonth(Number(e.target.value))}
                        >
                            {MONTHS.map((m) => (
                                <MenuItem key={m} value={m}>{MONTH_NAMES[m]}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={isLoading}>Cancelar</Button>
                    <Button type="submit" variant="contained" disabled={isLoading}>
                        {isLoading ? "Creando..." : "Crear Hoja"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
