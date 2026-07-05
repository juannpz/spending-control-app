import type {
    Currency,
    Expense,
    ExpenseCategory,
    GoogleSheetMeta,
    Income,
    IncomeCategory,
    IncomeReceptionType,
    PaymentType,
} from "@/types";
import { DISCOVERY_DOC, SHEET_HEADERS } from "@/constants";

const EXPENSE_RANGE = "A2:M";
const HEADER_RANGE = "A1:M1";

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

const rowToMovement = (row: string[]): Expense | Income => {
    const movementType = (row[12] || "expense") as "expense" | "income";

    if (movementType === "income") {
        return {
            id: row[0] || generateId(),
            movementType: "income",
            date: row[1] || "",
            description: row[2] || "",
            category: (row[3] || "otro_ingreso") as IncomeCategory,
            paymentType: (row[4] || "transferencia") as IncomeReceptionType,
            currency: (row[5] || "ARS") as Currency,
            amount: Number(row[6]) || 0,
            installments: 1,
            paidInstallments: 0,
            createdBy: row[9] || "Desconocido",
            createdAt: row[10] || new Date().toISOString(),
            updatedAt: row[11] || new Date().toISOString(),
        };
    }

    return {
        id: row[0] || generateId(),
        movementType: "expense",
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
    };
};

const movementToRow = (m: Expense | Income): string[] => [
    m.id,
    m.date,
    m.description,
    m.category,
    m.paymentType,
    m.currency,
    m.amount.toString(),
    m.installments.toString(),
    m.paidInstallments.toString(),
    m.createdBy,
    m.createdAt,
    m.updatedAt,
    m.movementType,
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

// ---- MOVEMENT CRUD ----

export const getMovements = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
): Promise<{ expenses: Expense[]; income: Income[] }> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    try {
        const res = await gapi.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!${EXPENSE_RANGE}`,
        });

        const rows = (res.result.values as string[][]) ?? [];
        const movements = rows
            .filter((row) => row.some((cell) => cell?.trim()))
            .map(rowToMovement);

        const expenses = movements.filter((m) => m.movementType === "expense") as Expense[];
        const income = movements.filter((m) => m.movementType === "income") as Income[];

        return { expenses, income };
    } catch (err) {
        throw err;
    }
};

/** Backward-compatible: returns only expenses */
export const getExpenses = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
): Promise<Expense[]> => {
    const { expenses } = await getMovements(token, spreadsheetId, sheetName);
    return expenses;
};

export const addMovement = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    data:
        | Omit<Expense, "id" | "createdAt" | "updatedAt">
        | Omit<Income, "id" | "createdAt" | "updatedAt">,
): Promise<Expense | Income> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    const now = new Date().toISOString();
    const movement: Expense | Income = {
        ...data,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
        // Ensure these fields are always set for income
        installments: data.movementType === "income" ? 1 : (data as Expense).installments,
        paidInstallments: data.movementType === "income" ? 0 : (data as Expense).paidInstallments,
    } as Expense | Income;

    await gapi.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A:M`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: [movementToRow(movement)] },
    });

    return movement;
};

/** Backward-compatible: addExpense using addMovement */
export const addExpense = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    data: Omit<Expense, "id" | "createdAt" | "updatedAt">,
): Promise<Expense> => {
    const result = await addMovement(token, spreadsheetId, sheetName, data);
    return result as Expense;
};

/** Add a new income record */
export const addIncome = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    data: Omit<Income, "id" | "createdAt" | "updatedAt">,
): Promise<Income> => {
    const result = await addMovement(token, spreadsheetId, sheetName, data);
    return result as Income;
};

export const updateMovement = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    id: string,
    updates: Partial<Omit<Expense | Income, "id" | "createdAt">>,
): Promise<void> => {
    const row = await findMovementRow(token, spreadsheetId, sheetName, id);
    if (row === -1) throw new Error(`Movement ${id} not found`);

    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    const res = await gapi.sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `'${sheetName}'!A${row}:M${row}`,
    });
    const rowData = (res.result.values as string[][])?.[0] ?? [];
    const current = rowToMovement(rowData);

    const updated: Expense | Income = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
    } as Expense | Income;

    await gapi.sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `'${sheetName}'!A${row}:M${row}`,
        valueInputOption: "RAW",
        resource: { values: [movementToRow(updated)] },
    });
};

/** Backward-compatible: updateExpense using updateMovement */
export const updateExpense = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    id: string,
    updates: Partial<Omit<Expense, "id" | "createdAt">>,
): Promise<void> => {
    return updateMovement(token, spreadsheetId, sheetName, id, updates);
};

export const findMovementRow = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    id: string,
): Promise<number> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    try {
        const res = await gapi.sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `'${sheetName}'!A2:A`,
        });
        const rows = (res.result.values as string[][]) ?? [];
        const rowIdx = rows.findIndex((row) => row[0] === id);
        return rowIdx >= 0 ? rowIdx + 2 : -1;
    } catch {
        return -1;
    }
};

/** Backward-compatible alias */
export const findExpenseRow = findMovementRow;

export const deleteMovement = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    id: string,
): Promise<void> => {
    const row = await findMovementRow(token, spreadsheetId, sheetName, id);
    if (row === -1) throw new Error(`Movement ${id} not found`);

    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    await gapi.sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `'${sheetName}'!A${row}:M${row}`,
    });
};

/** Backward-compatible alias */
export const deleteExpense = deleteMovement;

// ---- CROSS-SHEET HELPERS ----

/** List all sheet tab names in a spreadsheet, sorted alphabetically. */
export const getSheetNames = async (
    token: string,
    spreadsheetId: string,
): Promise<string[]> => {
    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    const res = await gapi.sheets.spreadsheets.get({ spreadsheetId });

    return (res.result.sheets ?? [])
        .map((s: { properties?: { title?: string } }) => s.properties?.title ?? "")
        .filter(Boolean);
};

/** Check whether a sheet tab exists in a spreadsheet. */
export const sheetExists = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
): Promise<boolean> => {
    const names = await getSheetNames(token, spreadsheetId);
    return names.includes(sheetName);
};

/** Append multiple movement rows to a sheet in one API call. */
export const batchAddMovements = async (
    token: string,
    spreadsheetId: string,
    sheetName: string,
    movements: (Expense | Income)[],
): Promise<void> => {
    if (movements.length === 0) return;

    const gapi = await loadGapiClient();
    gapi.setToken({ access_token: token });

    await gapi.sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `'${sheetName}'!A:M`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        resource: { values: movements.map(movementToRow) },
    });
};

/** Backward-compatible alias */
export const batchAddExpenses = batchAddMovements;
