export type Currency = "ARS" | "USD";

export type MovementType = "expense" | "income";

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

export type IncomeCategory =
    | "salario"
    | "freelance"
    | "ventas"
    | "inversiones"
    | "alquiler_cobrado"
    | "reembolso"
    | "regalo_recibido"
    | "premio"
    | "devolucion"
    | "prestamo"
    | "otro_ingreso";

/** Medio de recepción del ingreso (same values as PaymentType but semantically different) */
export type IncomeReceptionType =
    | "transferencia"
    | "efectivo"
    | "qr"
    | "debito"
    | "otro";

export type MovementCategory = ExpenseCategory | IncomeCategory;

export interface Expense {
    id: string;
    movementType: MovementType;
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

export interface Income {
    id: string;
    movementType: "income";
    description: string;
    category: IncomeCategory;
    paymentType: IncomeReceptionType;
    currency: Currency;
    amount: number;
    date: string; // ISO date string (YYYY-MM-DD)
    installments: number; // always 1 for income
    paidInstallments: number; // always 0 for income
    createdBy: string;
    createdAt: string;
    updatedAt: string;
}

/** Unified movement type for shared components */
export type Movement = Expense | Income;

export interface MonthSheet {
    id: string;
    spreadsheetId: string;
    sheetName: string; // e.g., "2026-05"
    monthLabel: string; // e.g., "Mayo 2026"
    year: number;
    month: number; // 1-12
    expenses: Expense[];
    income: Income[];
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

export interface IncomeFormData {
    description: string;
    category: IncomeCategory | "";
    paymentType: IncomeReceptionType | "";
    currency: Currency;
    amount: string;
    date: string;
}

/** Data needed to create a new expense (no generated fields) */
export type CreateExpenseData = Omit<Expense, "id" | "createdAt" | "updatedAt">;

/** Data needed to create a new income (no generated fields) */
export type CreateIncomeData = Omit<Income, "id" | "createdAt" | "updatedAt">;

/** Metrics for analytics dashboard */
export interface MonthlyMetrics {
    year: number;
    month: number;
    monthLabel: string;
    totalExpenses: Record<Currency, number>;
    totalIncome: Record<Currency, number>;
    balance: Record<Currency, number>;
    expenseCount: number;
    incomeCount: number;
    topExpenseCategories: { category: ExpenseCategory; total: number; currency: Currency }[];
    topIncomeCategories: { category: IncomeCategory; total: number; currency: Currency }[];
}

export interface MetricsProjection {
    nextMonth: {
        projectedExpenses: Record<Currency, number>;
        projectedIncome: Record<Currency, number>;
        projectedBalance: Record<Currency, number>;
    };
    averageMonthlyExpenses: Record<Currency, number>;
    averageMonthlyIncome: Record<Currency, number>;
    trend: "up" | "down" | "stable";
}
