# Control de Gastos Mensual 🌐

SPA para llevar el control y seguimiento de gastos mensuales sincronizado con Google Sheets.

## Stack

- **Vite** + **React 19** + **TypeScript 5.8**
- **Material UI 7** (components)
- **Tailwind CSS 4** (utility classes)
- **Google Identity Services** (auth)
- **Google Sheets API v4** (database)
- **React Router 7**

## Estructura del proyecto

```
src/
├── components/
│   ├── auth/          LoginButton, ProtectedRoute
│   ├── sheets/        SheetCreator, SheetImporter
│   ├── expenses/      ExpenseForm, ExpenseTable, ConfirmDelete
│   └── layout/        AppLayout
├── contexts/          AuthContext, SheetsContext
├── services/          googleAuth.ts, googleSheets.ts
├── types/             Tipos TypeScript
├── constants/         Etiquetas, config
├── utils/             Validación, formateo
├── pages/             LoginPage, DashboardPage
├── App.tsx            Ruteo y providers
└── main.tsx           Entry point
```

## Setup

### 1. Google Cloud Console

Creá un proyecto en [Google Cloud Console](https://console.cloud.google.com):

1. **Habilitá las APIs:**
   - Google Sheets API
   - Google Drive API

2. **Creá credenciales OAuth 2.0:**
   - Tipo: Web application
   - Authorized JavaScript origins: `http://localhost:5173`
   - Copiá el **Client ID**

3. **Creá una API Key:**
   - Restringila a Google Sheets API
   - Copiá la **API Key**

### 2. Variables de entorno

```bash
cp .env.example .env
```

Editá `.env`:

```env
VITE_GOOGLE_CLIENT_ID=tu-client-id.apps.googleusercontent.com
VITE_GOOGLE_API_KEY=tu-api-key
```

### 3. Instalación y desarrollo

```bash
# Instalar dependencias
bun install

# Dev server
bun run dev

# Build
bun run build

# Preview build
bun run preview
```

## Features

- 🔐 Inicio de sesión con Google
- 📊 Creación de hojas de gastos por mes (ej. Mayo 2026)
- ➕ Carga de gastos con: descripción, categoría, tipo de pago, moneda y monto
- ✏️ Edición y eliminación de gastos
- 🔍 Filtros por descripción y categoría
- 📈 Totales por moneda (ARS/USD)
- 📱 Mobile-first responsive
- ☁️ Google Sheets como base de datos (creación, lectura, escritura, eliminación)
- 📥 Importación de hojas existentes desde Google Sheets
- 🔗 Apertura directa del sheet en Google Sheets

## Categorías

Supermercado, Combustible, Restaurante, Servicios, Alquiler, Transporte, Salud, Educación,
Entretenimiento, Ropa, Tecnología, Impuestos, Seguros, Mascotas, Viajes, Otro.

## Tipos de pago

Débito, Crédito, QR, Transferencia, Efectivo, Otro.

## Monedas

Pesos (ARS) y Dólares (USD).
