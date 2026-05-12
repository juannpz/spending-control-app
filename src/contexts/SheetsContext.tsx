import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import type { CreateExpenseData, Expense, MonthSheet } from "@/types";
import { useAuth } from "./AuthContext";
import * as sheetsService from "@/services/googleSheets";
import { is401Error } from "@/services/googleAuth";
import { formatMonthLabel, formatMonthSheetName } from "@/utils";

// ---- localStorage persistence ----

interface PersistedSheet {
    spreadsheetId: string;
    sheetName: string;
    year: number;
    month: number;
}

const STORAGE_KEY = "sca_current_sheet";

const loadPersistedSheet = (): PersistedSheet | null => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as PersistedSheet;
    } catch {
        return null;
    }
};

const savePersistedSheet = (sheet: PersistedSheet): void => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sheet));
};

const clearPersistedSheet = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};

const sortExpenses = (list: Expense[]): Expense[] =>
    [...list].sort((a, b) => {
        const dateCmp = (b.date || "").localeCompare(a.date || "");
        if (dateCmp !== 0) return dateCmp;
        return a.id.localeCompare(b.id);
    });

interface SheetsContextType {
    currentSheet: MonthSheet | null;
    isLoading: boolean;
    error: string | null;
    createSheet: (year: number, month: number, spreadsheetId?: string) => Promise<void>;
    loadSheet: (
        spreadsheetId: string,
        sheetName: string,
        year: number,
        month: number,
    ) => Promise<void>;
    addExpense: (data: CreateExpenseData) => Promise<Expense>;
    editExpense: (id: string, updates: Partial<CreateExpenseData>) => Promise<void>;
    removeExpense: (id: string) => Promise<void>;
    markInstallmentPaid: (id: string, newPaidCount: number) => Promise<void>;
    clearError: () => void;
}

const SheetsContext = createContext<SheetsContextType | null>(null);

export const SheetsProvider = ({ children }: { children: ReactNode }) => {
    const { token, refreshToken, logout } = useAuth();
    const [currentSheet, setCurrentSheet] = useState<MonthSheet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restored, setRestored] = useState(false);

    // Refs so withTokenRefresh stays stable across renders
    const tokenRef = useRef(token);
    tokenRef.current = token;
    const refreshTokenRef = useRef(refreshToken);
    refreshTokenRef.current = refreshToken;
    const logoutRef = useRef(logout);
    logoutRef.current = logout;

    /**
     * Wraps a Google API operation with automatic 401 → silent token refresh → retry.
     * If silent refresh also fails, forces logout so the user lands on /login
     * instead of staying in a broken authenticated state.
     */
    const withTokenRefresh = useCallback(async <T,>(
        operation: (tok: string) => Promise<T>,
    ): Promise<T> => {
        const tok = tokenRef.current;
        if (!tok) throw new Error("Not authenticated");
        try {
            return await operation(tok);
        } catch (err: unknown) {
            if (!is401Error(err)) throw err;

            const fresh = await refreshTokenRef.current();
            if (!fresh) {
                // Cannot refresh → force logout to clean UI state
                logoutRef.current();
                throw new Error("Sesión expirada. Por favor iniciá sesión nuevamente.");
            }

            sheetsService.setToken(fresh);
            return await operation(fresh);
        }
    }, []);

    // ── RESTORE PERSISTED SHEET ON MOUNT ──────────────────────────

    const doRestoreSheet = useCallback(async () => {
        if (!tokenRef.current) return;
        const persisted = loadPersistedSheet();
        if (!persisted) return;

        setIsLoading(true);
        try {
            await withTokenRefresh(async (tok) => {
                const expenses = await sheetsService.getExpenses(
                    tok,
                    persisted.spreadsheetId,
                    persisted.sheetName,
                );

                setCurrentSheet({
                    id: persisted.spreadsheetId,
                    spreadsheetId: persisted.spreadsheetId,
                    sheetName: persisted.sheetName,
                    monthLabel: formatMonthLabel(persisted.year, persisted.month),
                    year: persisted.year,
                    month: persisted.month,
                    expenses: sortExpenses(expenses),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                });
            });
        } catch {
            // withTokenRefresh already called logout() if the token was unrecoverable.
            // For other errors (network, permissions, …), clear the stale sheet ref.
            clearPersistedSheet();
            setCurrentSheet(null);
        } finally {
            setIsLoading(false);
        }
    }, [withTokenRefresh]);

    useEffect(() => {
        if (restored || !token) return;
        setRestored(true);
        doRestoreSheet();
    }, [token, restored, doRestoreSheet]);

    const clearError = useCallback(() => setError(null), []);

    useEffect(() => {
        if (currentSheet) {
            savePersistedSheet({
                spreadsheetId: currentSheet.spreadsheetId,
                sheetName: currentSheet.sheetName,
                year: currentSheet.year,
                month: currentSheet.month,
            });
        }
    }, [currentSheet]);

    // ── SHEET LIFECYCLE ────────────────────────────────────────────

    const createSheet = useCallback(
        async (year: number, month: number, existingSpreadsheetId?: string) => {
            setIsLoading(true);
            setError(null);
            try {
                await withTokenRefresh(async (tok) => {
                    const sheetName = formatMonthSheetName(year, month);
                    let spreadsheetId: string;

                    if (existingSpreadsheetId) {
                        await sheetsService.addSheetToSpreadsheet(
                            tok,
                            existingSpreadsheetId,
                            sheetName,
                        );
                        spreadsheetId = existingSpreadsheetId;
                    } else {
                        const title = `${formatMonthLabel(year, month)} - Control de Gastos`;
                        spreadsheetId = await sheetsService.createSpreadsheet(
                            tok,
                            title,
                            sheetName,
                        );
                    }

                    setCurrentSheet({
                        id: spreadsheetId,
                        spreadsheetId,
                        sheetName,
                        monthLabel: formatMonthLabel(year, month),
                        year,
                        month,
                        expenses: [],
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al crear la hoja";
                setError(msg);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [withTokenRefresh],
    );

    const loadSheet = useCallback(
        async (spreadsheetId: string, sheetName: string, year: number, month: number) => {
            setIsLoading(true);
            setError(null);
            try {
                await withTokenRefresh(async (tok) => {
                    const expenses = await sheetsService.getExpenses(tok, spreadsheetId, sheetName);
                    setCurrentSheet({
                        id: spreadsheetId,
                        spreadsheetId,
                        sheetName,
                        monthLabel: formatMonthLabel(year, month),
                        year,
                        month,
                        expenses: sortExpenses(expenses),
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                    });
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al cargar la hoja";
                setError(msg);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [withTokenRefresh],
    );

    // ── EXPENSE CRUD ───────────────────────────────────────────────

    const addExpense = useCallback(
        async (data: CreateExpenseData) => {
            if (!currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                return await withTokenRefresh(async (tok) => {
                    const expense = await sheetsService.addExpense(
                        tok,
                        currentSheet.spreadsheetId,
                        currentSheet.sheetName,
                        data,
                    );

                    setCurrentSheet((prev) =>
                        prev
                            ? { ...prev, expenses: sortExpenses([...prev.expenses, expense]) }
                            : prev
                    );
                    return expense;
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al agregar gasto";
                setError(msg);
                throw err;
            }
        },
        [currentSheet, withTokenRefresh],
    );

    const editExpense = useCallback(
        async (id: string, updates: Partial<CreateExpenseData>) => {
            if (!currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                await withTokenRefresh(async (tok) => {
                    await sheetsService.updateExpense(
                        tok,
                        currentSheet.spreadsheetId,
                        currentSheet.sheetName,
                        id,
                        updates,
                    );
                    setCurrentSheet((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            expenses: prev.expenses.map((e) =>
                                e.id === id
                                    ? { ...e, ...updates, updatedAt: new Date().toISOString() }
                                    : e
                            ),
                        };
                    });
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al editar gasto";
                setError(msg);
                throw err;
            }
        },
        [currentSheet, withTokenRefresh],
    );

    const removeExpense = useCallback(
        async (id: string) => {
            if (!currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                await withTokenRefresh(async (tok) => {
                    await sheetsService.deleteExpense(
                        tok,
                        currentSheet.spreadsheetId,
                        currentSheet.sheetName,
                        id,
                    );
                    setCurrentSheet((prev) => {
                        if (!prev) return prev;
                        return { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) };
                    });
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al eliminar gasto";
                setError(msg);
                throw err;
            }
        },
        [currentSheet, withTokenRefresh],
    );

    const markInstallmentPaid = useCallback(
        async (id: string, newPaidCount: number) => {
            if (!currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                await withTokenRefresh(async (tok) => {
                    await sheetsService.updateExpense(
                        tok,
                        currentSheet.spreadsheetId,
                        currentSheet.sheetName,
                        id,
                        { paidInstallments: newPaidCount },
                    );
                    setCurrentSheet((prev) => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            expenses: prev.expenses.map((e) =>
                                e.id === id
                                    ? {
                                        ...e,
                                        paidInstallments: newPaidCount,
                                        updatedAt: new Date().toISOString(),
                                    }
                                    : e
                            ),
                        };
                    });
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al actualizar cuotas";
                setError(msg);
                throw err;
            }
        },
        [currentSheet, withTokenRefresh],
    );

    return (
        <SheetsContext.Provider
            value={{
                currentSheet,
                isLoading,
                error,
                createSheet,
                loadSheet,
                addExpense,
                editExpense,
                removeExpense,
                markInstallmentPaid,
                clearError,
            }}
        >
            {children}
        </SheetsContext.Provider>
    );
};

export const useSheets = (): SheetsContextType => {
    const ctx = useContext(SheetsContext);
    if (!ctx) throw new Error("useSheets must be used within SheetsProvider");
    return ctx;
};
