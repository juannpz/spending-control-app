import type {
    Currency,
    ExpenseCategory,
    IncomeCategory,
    IncomeReceptionType,
    PaymentType,
} from "@/types";

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
    supermercado: "Supermercado",
    combustible: "Combustible",
    restaurante: "Restaurante",
    delivery: "Delivery",
    cafeteria: "Cafetería",
    servicios: "Servicios",
    alquiler: "Alquiler",
    hogar: "Hogar",
    transporte: "Transporte",
    vehiculo: "Vehículo",
    salud: "Salud",
    medicamentos: "Medicamentos",
    gimnasio: "Gimnasio",
    educacion: "Educación",
    entretenimiento: "Entretenimiento",
    ocio: "Ocio",
    juegos: "Juegos",
    suscripciones: "Suscripciones",
    ropa: "Ropa",
    tecnologia: "Tecnología",
    impuestos: "Impuestos",
    seguros: "Seguros",
    mascotas: "Mascotas",
    viajes: "Viajes",
    peluqueria: "Peluquería",
    gastos_personales: "Gastos Personales",
    regalos: "Regalos",
    limpieza: "Limpieza",
    ferreteria: "Ferretería",
    libreria: "Librería",
    tarjeta: "Pago de tarjeta",
    otro: "Otro",
};

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
    salario: "Salario",
    freelance: "Freelance",
    ventas: "Ventas",
    inversiones: "Inversiones",
    alquiler_cobrado: "Alquiler cobrado",
    reembolso: "Reembolso",
    regalo_recibido: "Regalo recibido",
    premio: "Premio",
    devolucion: "Devolución",
    prestamo: "Préstamo",
    otro_ingreso: "Otro",
};

export const INCOME_RECEPTION_LABELS: Record<IncomeReceptionType, string> = {
    transferencia: "Transferencia",
    efectivo: "Efectivo",
    qr: "QR",
    debito: "Débito",
    otro: "Otro",
};

/** Pre-sorted category entries for display in autocompletes (alphabetical by label) */
export const CATEGORY_ENTRIES = (
    Object.entries(CATEGORY_LABELS) as [ExpenseCategory, string][]
).sort((a, b) => a[1].localeCompare(b[1], "es"));

/** Pre-sorted income category entries for display in autocompletes (alphabetical by label) */
export const INCOME_CATEGORY_ENTRIES = (
    Object.entries(INCOME_CATEGORY_LABELS) as [IncomeCategory, string][]
).sort((a, b) => a[1].localeCompare(b[1], "es"));

/** Pre-sorted income reception type entries */
export const INCOME_RECEPTION_ENTRIES = (
    Object.entries(INCOME_RECEPTION_LABELS) as [IncomeReceptionType, string][]
).sort((a, b) => a[1].localeCompare(b[1], "es"));

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
    "Tipo Movimiento",
] as const;

// Google API config — values must come from .env
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
export const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string;
export const DISCOVERY_DOC = "https://sheets.googleapis.com/$discovery/rest?version=v4";
