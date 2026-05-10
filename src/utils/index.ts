import type { ExpenseFormData } from "@/types";
import { CURRENCY_SYMBOLS, MONTH_NAMES } from "@/constants";
import type { Currency } from "@/types";

// ---- VALIDATION ----

export interface ValidationErrors {
    description?: string;
    category?: string;
    paymentType?: string;
    amount?: string;
    date?: string;
    installments?: string;
}

export const validateExpenseForm = (data: ExpenseFormData): ValidationErrors => {
    const errors: ValidationErrors = {};

    if (!data.description.trim()) {
        errors.description = "La descripción es requerida";
    } else if (data.description.trim().length < 2) {
        errors.description = "La descripción debe tener al menos 2 caracteres";
    } else if (data.description.trim().length > 200) {
        errors.description = "La descripción no puede exceder 200 caracteres";
    }

    if (!data.category) {
        errors.category = "Seleccioná una categoría";
    }

    if (!data.paymentType) {
        errors.paymentType = "Seleccioná un tipo de pago";
    }

    if (!data.amount) {
        errors.amount = "El monto es requerido";
    } else {
        const num = Number(data.amount);
        if (Number.isNaN(num)) {
            errors.amount = "Ingresá un número válido";
        } else if (num <= 0) {
            errors.amount = "El monto debe ser mayor a 0";
        } else if (num > 99_999_999) {
            errors.amount = "El monto no puede exceder 99.999.999";
        }
    }

    if (!data.date) {
        errors.date = "La fecha es requerida";
    }

    // Installments: required and validated only for credito
    if (data.paymentType === "credito") {
        if (!data.installments) {
            errors.installments = "Indicá la cantidad de cuotas";
        } else {
            const n = Number(data.installments);
            if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) {
                errors.installments = "Debe ser un número entero >= 1";
            } else if (n > 48) {
                errors.installments = "Máximo 48 cuotas";
            }
        }
    }

    return errors;
};

export const hasErrors = (errors: ValidationErrors): boolean => Object.values(errors).some(Boolean);

// ---- FORMATTING ----

export const formatCurrency = (amount: number, currency: Currency): string => {
    const symbol = CURRENCY_SYMBOLS[currency];
    return `${symbol} ${
        amount.toLocaleString("es-AR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })
    }`;
};

export const formatDate = (isoString: string): string => {
    if (!isoString) return "-";
    const [year, month, day] = isoString.split("T")[0].split("-");
    return `${day ?? "-"}/${month ?? "-"}/${year ?? "-"}`;
};

export const formatMonthLabel = (year: number, month: number): string => {
    return `${MONTH_NAMES[month] ?? "??"} ${year}`;
};

export const formatMonthSheetName = (year: number, month: number): string => {
    return `${year}-${String(month).padStart(2, "0")}`;
};

// ---- DATE HELPERS ----

export const getTodayISO = (): string => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
};

export const getCurrentMonthYear = (): { year: number; month: number } => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
};
