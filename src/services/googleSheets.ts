import type { Currency, Expense, ExpenseCategory, GoogleSheetMeta, PaymentType } from "@/types";
import { DISCOVERY_DOC, SHEET_HEADERS } from "@/constants";

const EXPENSE_RANGE = "A2:L";
const HEADER_RANGE = "A1:L1";

let gapiReady = false;
let gapiLoadPromise: Promise<GapiClient> | null = null;

const getGapi = (): GapiClient => {
    return window.gapi!.client;
};

export const loadGapiClient = (): Promise<GapiClient> => {
    if (gapiReady) return Promise.resolve(getGapi());
    if (gapiLoadPromise) return gapiLoadPromise;

    gapiLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://apis.google.com/js/api.js";
        script.async = true;
        script.defer = true;
        script.onload = () => {
            window.gapi!.load("client", async () => {
                try {
                    await window.gapi!.client.init({
                        discoveryDocs: [DISCOVERY_DOC],
                    });
                    gapiReady = true;
                    resolve(getGapi());
                } catch (err) {
                    gapiLoadPromise = null;
                    reject(err);
                }
            });
        };
        script.onerror = () => {
            gapiLoadPromise = null;
            reject(new Error("Failed to load Google API client"));
        };
        document.head.appendChild(script);
    });

    return gapiLoadPromise;
};

export const setToken = (token: string): void => {
    if (gapiReady) {
        getGapi().setToken({ access_token: token });
    }
};

// Utilities
const generateId = (): string => `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

const rowToExpense = (row: string[]): Expense => ({
    id: row[0] || generateId(),
    date: row[1] || "",
    description: row[2] || "",
    category: (row[3] || "otro") as ExpenseCategory,
    paymentType: (row[4] || "otro") as PaymentType,
    currency: (row[5] || "ARS") as Currency,
    amount: Number(row[6]) || 0,
    installments: Number(row[7]) || 1,
    paidInstallments: Number(row[8]) || 0,
    createdBy: row[9] || "Desconocido",
    createdAt: row[10] || new Date().toISOString(),
    updatedAt: row[11] || new Date().toISOString(),
});

const expenseToRow = (e: Expense): string[] => [
    e.id,
    e.date,
    e.description,
    e.category,
    e.paymentType,
    e.currency,
    e.amount.toString(),
    e.installments.toString(),
    e.paidInstallments.toString(),
    e.createdBy,
    e.createdAt,
    e.updatedAt,
];

// ---- SPREADSHEET MANAGEMENT ----

export const createSpreadsheet = async (
    token: string,
    title: string,
    sheetName: string,
): Promise<string> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    const res = await gapi.sheets.spreadsheets.create({
        properties: { title },
        sheets: [
            { properties: { title: sheetName, gridProperties: { frozenRowCount: 1 } } },
        ],
    });

    const id = res.result.spreadsheetId;

    await gapi.sheets.spreadsheets.values.update({
        spreadsheetId: id,
        range: `'${sheetName}'!${HEADER_RANGE}`,
        valueInputOption: "RAW",
        resource: { values: [[...SHEET_HEADERS]] },
    });

    return id;
};

export const addSheetToSpreadsheet = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
): Promise<void> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    // Add the sheet tab
    await gapi.sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        resource: {
            requests: [
                {
                    addSheet: {
                        properties: {
                            title: sheetName,
                            gridProperties: { frozenRowCount: 1 },
                        },
                    },
                },
            ],
        },
    });

    // Add headers to the new sheet
    await gapi.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!${HEADER_RANGE}`,
        valueInputOption: "RAW",
        resource: { values: [[...SHEET_HEADERS]] },
    });
};

export const getSpreadsheetMeta = async (
    token: string,
    spreadsheetId: string,
): Promise<GoogleSheetMeta> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    const res = await gapi.sheets.spreadsheets.get({ spreadsheetId });

    return {
        spreadsheetId: res.result.spreadsheetId ?? "",
        title: res.result.properties?.title ?? "",
        sheets: (res.result.sheets ?? []).map(
            (s: { properties?: { title?: string } }) => s.properties?.title ?? "",
        ),
    };
};

// ---- EXPENSE CRUD ----

export const getExpenses = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
): Promise<Expense[]> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    try {
        const res = await gapi.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!${EXPENSE_RANGE}`,
        });

        const rows = (res.result.values as string[][]) ?? [];
        return rows
            .filter((row) => row.some((cell) => cell?.trim()))
            .map(rowToExpense);
    } catch {
        return [];
    }
};

export const addExpense = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    data: Omit<Expense, "id" | "createdAt" | "updatedAt">,
): Promise<Expense> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    const now = new Date().toISOString();
    const expense: Expense = { ...data, id: generateId(), createdAt: now, updatedAt: now };

    await gapi.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A:L`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: [expenseToRow(expense)] },
    });

    return expense;
};

export const updateExpense = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    id: string,
    updates: Partial<Omit<Expense, "id" | "createdAt">>,
): Promise<void> => {
    // Find the real sheet row using the ID column directly (not filtered array index)
    const row = await findExpenseRow(token, spreadsheetId, sheetName, id);
    if (row === -1) throw new Error(`Expense ${id} not found`);

    // Fetch current data from that exact row to build the updated object
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    const res = await gapi.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A${row}:L${row}`,
    });
    const rowData = (res.result.values as string[][])?.[0] ?? [];
    const current = rowToExpense(rowData);

    const updated: Expense = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
    };

    await gapi.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A${row}:L${row}`,
        valueInputOption: "RAW",
        resource: { values: [expenseToRow(updated)] },
    });
};

export const findExpenseRow = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    id: string,
): Promise<number> => {
    // Returns the 1-based sheet row number for the given expense ID
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    try {
        const res = await gapi.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A2:A`,
        });
        const rows = (res.result.values as string[][]) ?? [];
        const rowIdx = rows.findIndex((row) => row[0] === id);
        return rowIdx >= 0 ? rowIdx + 2 : -1; // +2 because header is row 1, array is 0-based
    } catch {
        return -1;
    }
};

export const deleteExpense = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    id: string,
): Promise<void> => {
    const row = await findExpenseRow(token, spreadsheetId, sheetName, id);
    if (row === -1) throw new Error(`Expense ${id} not found`);

    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    // Clear the row contents (updateExpense now uses real row numbers, so gaps are safe)
    await gapi.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${sheetName}'!A${row}:L${row}`,
    });
};
