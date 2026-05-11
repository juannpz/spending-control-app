import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { CreateExpenseData, Expense, MonthSheet } from "@/types";
import { useAuth } from "./AuthContext";
import * as sheetsService from "@/services/googleSheets";
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
    const { token, refreshToken } = useAuth();
    const [currentSheet, setCurrentSheet] = useState<MonthSheet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restored, setRestored] = useState(false);

    const doRestoreSheet = useCallback(async () => {
        if (!token) return;
        const persisted = loadPersistedSheet();
        if (!persisted) return;

        setIsLoading(true);
        try {
            // First try with the stored token — it's usually still valid (~1h lifetime).
            let expenses: Expense[];
            try {
                expenses = await sheetsService.getExpenses(
                    token,
                    persisted.spreadsheetId,
                    persisted.sheetName,
                );
            } catch (err: any) {
                // If 401, attempt a token refresh and retry.
                // GAPI errors have result.error.code; standard fetch errors have status.
                const is401 = err?.status === 401 ||
                    err?.result?.error?.code === 401 ||
                    (err?.message?.includes("401") && err?.message?.includes("UNAUTHENTICATED"));
                if (!is401) throw err;

                const fresh = await refreshToken();
                if (!fresh) throw err; // can't refresh → give up

                sheetsService.setToken(fresh);
                expenses = await sheetsService.getExpenses(
                    fresh,
                    persisted.spreadsheetId,
                    persisted.sheetName,
                );
            }

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
        } catch {
            clearPersistedSheet();
            setCurrentSheet(null);
        } finally {
            setIsLoading(false);
        }
    }, [token, refreshToken]);

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
            if (!token) throw new Error("Not authenticated");
            setIsLoading(true);
            setError(null);
            try {
                const sheetName = formatMonthSheetName(year, month);
                let spreadsheetId: string;

                if (existingSpreadsheetId) {
                    await sheetsService.addSheetToSpreadsheet(
                        token,
                        existingSpreadsheetId,
                        sheetName,
                    );
                    spreadsheetId = existingSpreadsheetId;
                } else {
                    const title = `${formatMonthLabel(year, month)} - Control de Gastos`;
                    spreadsheetId = await sheetsService.createSpreadsheet(token, title, sheetName);
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
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al crear la hoja";
                setError(msg);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [token],
    );

    const loadSheet = useCallback(
        async (spreadsheetId: string, sheetName: string, year: number, month: number) => {
            if (!token) throw new Error("Not authenticated");
            setIsLoading(true);
            setError(null);
            try {
                const expenses = await sheetsService.getExpenses(token, spreadsheetId, sheetName);
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
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al cargar la hoja";
                setError(msg);
                throw err;
            } finally {
                setIsLoading(false);
            }
        },
        [token],
    );

    // ── EXPENSE CRUD ───────────────────────────────────────────────

    const addExpense = useCallback(
        async (data: CreateExpenseData) => {
            if (!token || !currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                const expense = await sheetsService.addExpense(
                    token,
                    currentSheet.spreadsheetId,
                    currentSheet.sheetName,
                    data,
                );

                setCurrentSheet((prev) =>
                    prev ? { ...prev, expenses: sortExpenses([...prev.expenses, expense]) } : prev
                );
                return expense;
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al agregar gasto";
                setError(msg);
                throw err;
            }
        },
        [token, currentSheet],
    );

    const editExpense = useCallback(
        async (id: string, updates: Partial<CreateExpenseData>) => {
            if (!token || !currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                await sheetsService.updateExpense(
                    token,
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
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al editar gasto";
                setError(msg);
                throw err;
            }
        },
        [token, currentSheet],
    );

    const removeExpense = useCallback(
        async (id: string) => {
            if (!token || !currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                await sheetsService.deleteExpense(
                    token,
                    currentSheet.spreadsheetId,
                    currentSheet.sheetName,
                    id,
                );
                setCurrentSheet((prev) => {
                    if (!prev) return prev;
                    return { ...prev, expenses: prev.expenses.filter((e) => e.id !== id) };
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al eliminar gasto";
                setError(msg);
                throw err;
            }
        },
        [token, currentSheet],
    );

    const markInstallmentPaid = useCallback(
        async (id: string, newPaidCount: number) => {
            if (!token || !currentSheet) throw new Error("No active sheet");
            setError(null);
            try {
                await sheetsService.updateExpense(
                    token,
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
            } catch (err) {
                const msg = err instanceof Error ? err.message : "Error al actualizar cuotas";
                setError(msg);
                throw err;
            }
        },
        [token, currentSheet],
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
