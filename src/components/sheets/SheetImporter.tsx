import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { getSpreadsheetMeta, setToken } from "@/services/googleSheets";
import { is401Error } from "@/services/googleAuth";
import { MONTH_NAMES } from "@/constants";

interface Props {
    open: boolean;
    onClose: () => void;
    prefillSpreadsheetId?: string;
}

interface SheetOption {
    name: string;
    year: number;
    month: number;
}

/** Extract spreadsheet ID from a full Google Sheets URL or just the raw ID */
const extractSpreadsheetId = (input: string): string => {
    input = input.trim();
    // If it's a raw ID (alphanumeric plus - and _)
    if (/^[a-zA-Z0-9\-_]+$/.test(input)) return input;
    // Extract from URL: /d/<ID>/
    const match = input.match(/\/d\/([a-zA-Z0-9\-_]+)/);
    return match?.[1] ?? input;
};

export const SheetImporter = ({ open, onClose, prefillSpreadsheetId }: Props) => {
    const { loadSheet, isLoading: sheetLoading, currentSheet } = useSheets();
    const { token, refreshToken, logout } = useAuth();
    const [rawInput, setRawInput] = useState("");
    const [sheets, setSheets] = useState<SheetOption[]>([]);
    const [selectedSheet, setSelectedSheet] = useState("");
    const [isFinding, setIsFinding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Stable refs so the withTokenRefresh callback inside this component
    // always sees the latest token/refreshToken/logout without stale closures.
    const tokenRef = useRef(token);
    tokenRef.current = token;
    const refreshTokenRef = useRef(refreshToken);
    refreshTokenRef.current = refreshToken;
    const logoutRef = useRef(logout);
    logoutRef.current = logout;

    const spreadsheetId = useMemo(() => extractSpreadsheetId(rawInput), [rawInput]);

    /**
     * Fetch spreadsheet metadata with automatic 401 → silent refresh → retry.
     * If silent refresh also fails, forces logout.
     */
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

    // Auto-fetch when opening with a pre-filled spreadsheet ID
    useEffect(() => {
        if (open && prefillSpreadsheetId && token) {
            setRawInput(prefillSpreadsheetId);
            setIsFinding(true);
            setError(null);
            fetchMetaWithRefresh(prefillSpreadsheetId)
                .then((meta) => {
                    const parsed: SheetOption[] = meta.sheets
                        .filter((name) => /^\d{4}-\d{2}$/.test(name))
                        .map((name) => {
                            const [y, m] = name.split("-").map(Number);
                            return { name, year: y!, month: m! };
                        });
                    setSheets(parsed);
                })
                .catch(() => setError("No se pudo acceder al spreadsheet"))
                .finally(() => setIsFinding(false));
        }
    }, [open, prefillSpreadsheetId, token, fetchMetaWithRefresh]);

    const handleFind = async () => {
        if (!token || !spreadsheetId) return;
        setIsFinding(true);
        setError(null);
        try {
            const meta = await fetchMetaWithRefresh(spreadsheetId);

            const parsed: SheetOption[] = meta.sheets
                .filter((name) => /^\d{4}-\d{2}$/.test(name))
                .map((name) => {
                    const [y, m] = name.split("-").map(Number);
                    return { name, year: y!, month: m! };
                });

            if (parsed.length === 0) {
                setError("No se encontraron hojas con formato YYYY-MM");
            }
            setSheets(parsed);
        } catch {
            setError("No se pudo acceder al spreadsheet. Verificá el ID.");
        } finally {
            setIsFinding(false);
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!selectedSheet) return;
        const sheet = sheets.find((s) => s.name === selectedSheet);
        if (!sheet) return;
        try {
            await loadSheet(spreadsheetId, sheet.name, sheet.year, sheet.month);
            onClose();
        } catch {
            // handled in context
        }
    };

    const handleClose = () => {
        setRawInput("");
        setSheets([]);
        setSelectedSheet("");
        setError(null);
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
            <form onSubmit={handleSubmit}>
                <DialogTitle>Importar Hoja Existente</DialogTitle>
                <DialogContent className="flex flex-col gap-3 pt-2!">
                    {error && <Alert severity="error">{error}</Alert>}
                    <div className="flex gap-2 items-end">
                        <TextField
                            label="URL o ID del Spreadsheet"
                            value={rawInput}
                            onChange={(e) => {
                                setRawInput(e.target.value);
                                setSheets([]);
                                setSelectedSheet("");
                                setError(null);
                            }}
                            fullWidth
                            size="medium"
                            placeholder="Pegá la URL completa o solo el ID"
                            helperText={spreadsheetId && spreadsheetId !== rawInput
                                ? `ID detectado: ${spreadsheetId}`
                                : "Pegá la URL de Google Sheets o el ID"}
                        />
                        <Button
                            variant="outlined"
                            onClick={handleFind}
                            disabled={!spreadsheetId || isFinding}
                            className="shrink-0"
                        >
                            {isFinding ? "..." : "Buscar"}
                        </Button>
                    </div>

                    {sheets.length > 0 && (
                        <FormControl fullWidth>
                            <InputLabel id="sheet-select-label">Hoja</InputLabel>
                            <Select
                                labelId="sheet-select-label"
                                value={selectedSheet}
                                label="Hoja"
                                onChange={(e: SelectChangeEvent<string>) =>
                                    setSelectedSheet(e.target.value)}
                            >
                                {sheets.map((s) => (
                                    <MenuItem key={s.name} value={s.name}>
                                        {MONTH_NAMES[s.month] ?? s.month} {s.year} ({s.name})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={sheetLoading}>Cancelar</Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={!selectedSheet || sheetLoading}
                    >
                        {sheetLoading ? "Importando..." : "Importar"}
                    </Button>
                </DialogActions>
            </form>
        </Dialog>
    );
};
