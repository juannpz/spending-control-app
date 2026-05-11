import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Expense, MonthSheet } from "@/types";
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

/**
 * Stable sort: newest expenses first (by date descending, then by ID for tiebreaking).
 * This guarantees that pagination never shows "duplicated" or shifting items
 * across page changes, regardless of what order the Sheets API returns.
 */
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
    addExpense: (data: Omit<Expense, "id" | "createdAt" | "updatedAt">) => Promise<Expense>;
    editExpense: (id: string, updates: Partial<Omit<Expense, "id" | "createdAt">>) => Promise<void>;
    removeExpense: (id: string) => Promise<void>;
    markInstallmentPaid: (id: string, newPaidCount: number) => Promise<void>;
    clearError: () => void;
}

const SheetsContext = createContext<SheetsContextType | null>(null);

export const SheetsProvider = ({ children }: { children: ReactNode }) => {
    const { token } = useAuth();
    const [currentSheet, setCurrentSheet] = useState<MonthSheet | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [restored, setRestored] = useState(false);

    // Auto-restore persisted sheet on mount (when token becomes available)
    useEffect(() => {
        if (restored || !token) return;
        setRestored(true);
        const persisted = loadPersistedSheet();
        if (!persisted) return;

        // Fire-and-forget restore
        setIsLoading(true);
        sheetsService
            .getExpenses(token, persisted.spreadsheetId, persisted.sheetName)
            .then((expenses) => {
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
            })
            .catch(() => {
                // Sheet gone or token expired — clear the persisted ref
                clearPersistedSheet();
            })
            .finally(() => setIsLoading(false));
    }, [token, restored]);

    const clearError = useCallback(() => setError(null), []);

    // Persist sheet whenever it changes
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

    const createSheet = useCallback(
        async (year: number, month: number, existingSpreadsheetId?: string) => {
            if (!token) throw new Error("Not authenticated");
            setIsLoading(true);
            setError(null);
            try {
                const sheetName = formatMonthSheetName(year, month);
                let spreadsheetId: string;

                if (existingSpreadsheetId) {
                    // Add a new sheet tab to the existing spreadsheet
                    await sheetsService.addSheetToSpreadsheet(
                        token,
                        existingSpreadsheetId,
                        sheetName,
                    );
                    spreadsheetId = existingSpreadsheetId;
                } else {
                    // Create a brand new spreadsheet
                    const title = `${formatMonthLabel(year, month)} - Control de Gastos`;
                    spreadsheetId = await sheetsService.createSpreadsheet(token, title, sheetName);
                }

                const newSheet: MonthSheet = {
                    id: spreadsheetId,
                    spreadsheetId,
                    sheetName,
                    monthLabel: formatMonthLabel(year, month),
                    year,
                    month,
                    expenses: [],
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                setCurrentSheet(newSheet);
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

                const sheet: MonthSheet = {
                    id: spreadsheetId,
                    spreadsheetId,
                    sheetName,
                    monthLabel: formatMonthLabel(year, month),
                    year,
                    month,
                    expenses: sortExpenses(expenses),
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };

                setCurrentSheet(sheet);
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

    const addExpense = useCallback(
        async (data: Omit<Expense, "id" | "createdAt" | "updatedAt">) => {
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
                    prev
                        ? {
                            ...prev,
                            expenses: sortExpenses([...prev.expenses, expense]),
                        }
                        : prev
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
        async (id: string, updates: Partial<Omit<Expense, "id" | "createdAt">>) => {
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
                    const updated = prev.expenses.map((e) =>
                        e.id === id ? { ...e, ...updates, updatedAt: new Date().toISOString() } : e
                    );
                    return { ...prev, expenses: sortExpenses(updated) };
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
                    return {
                        ...prev,
                        expenses: prev.expenses.filter((e) => e.id !== id),
                    };
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
