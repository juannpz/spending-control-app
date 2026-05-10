import type { Currency, ExpenseCategory, PaymentType } from "@/types";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    supermercado: "Supermercado",
    combustible: "Combustible",
    restaurante: "Restaurante",
    servicios: "Servicios",
    alquiler: "Alquiler",
    transporte: "Transporte",
    salud: "Salud",
    educacion: "Educación",
    entretenimiento: "Entretenimiento",
    ropa: "Ropa",
    tecnologia: "Tecnología",
    impuestos: "Impuestos",
    seguros: "Seguros",
    mascotas: "Mascotas",
    viajes: "Viajes",
    otro: "Otro",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
    debito: "Débito",
    credito: "Crédito",
    qr: "QR",
    transferencia: "Transferencia",
    efectivo: "Efectivo",
    otro: "Otro",
};

export const CURRENCY_LABELS: Record<Currency, string> = {
    ARS: "Pesos (ARS)",
    USD: "Dólares (USD)",
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
    ARS: "$",
    USD: "USD$",
};

export const MONTH_NAMES: Record<number, string> = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
};

export const GOOGLE_SCOPES = {
    spreadsheet: "https://www.googleapis.com/auth/spreadsheets",
    drive: "https://www.googleapis.com/auth/drive.file",
};

export const SHEET_HEADERS = [
    "ID",
    "Fecha",
    "Descripción",
    "Categoría",
    "Tipo de Pago",
    "Moneda",
    "Monto",
    "Cuotas",
    "Cuotas Pagadas",
    "Creado Por",
    "Creado",
    "Actualizado",
] as const;

// Google API config — values must come from .env
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
export const DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";
