export type Currency = "ARS" | "USD";

export type PaymentType =
    | "debito"
    | "credito"
    | "qr"
    | "transferencia"
    | "efectivo"
    | "otro";

export type ExpenseCategory =
    | "supermercado"
    | "combustible"
    | "restaurante"
    | "servicios"
    | "alquiler"
    | "transporte"
    | "salud"
    | "educacion"
    | "entretenimiento"
    | "ropa"
    | "tecnologia"
    | "impuestos"
    | "seguros"
    | "mascotas"
    | "viajes"
    | "otro"
    | "delivery"
    | "peluqueria"
    | "gastos_personales"
    | "ocio"
    | "suscripciones"
    | "gimnasio"
    | "hogar"
    | "regalos"
    | "vehiculo"
    | "medicamentos"
    | "cafeteria"
    | "limpieza"
    | "ferreteria"
    | "libreria"
    | "tarjeta"
    | "juegos";

export interface Expense {
    id: string;
    description: string;
    category: ExpenseCategory;
    paymentType: PaymentType;
    currency: Currency;
    amount: number;
    date: string; // ISO date string (YYYY-MM-DD)
    // Installment tracking (only relevant when paymentType === 'credito')
    installments: number; // total number of installments (1 = single payment, >1 = multiple)
    paidInstallments: number; // how many have been paid so far
    createdBy: string; // email or name of who created the expense
    createdAt: string;
    updatedAt: string;
}

export interface MonthSheet {
    id: string;
    spreadsheetId: string;
    sheetName: string; // e.g., "2026-05"
    monthLabel: string; // e.g., "Mayo 2026"
    year: number;
    month: number; // 1-12
    expenses: Expense[];
    createdAt: string;
    updatedAt: string;
}

export interface GoogleSheetMeta {
    spreadsheetId: string;
    title: string;
    sheets: string[];
}

export interface User {
    id: string;
    email: string;
    name: string;
    picture: string;
}

export interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    token: string | null;
}

export interface ExpenseFormData {
    description: string;
    category: ExpenseCategory | "";
    paymentType: PaymentType | "";
    currency: Currency;
    amount: string;
    date: string;
    installments: string;
}

/** Data needed to create a new expense (no generated fields) */
export type CreateExpenseData = Omit<Expense, "id" | "createdAt" | "updatedAt">;
