import { useCallback, useRef, useState } from "react";
import { Alert, Box, Button, Chip, Paper, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useSheets } from "@/contexts/SheetsContext";
import { useAuth } from "@/contexts/AuthContext";
import type { CreateIncomeData, Income } from "@/types";
import { IncomeForm } from "@/components/income/IncomeForm";
import { IncomeTable } from "@/components/income/IncomeTable";
import { ConfirmDelete } from "@/components/expenses/ConfirmDelete";

export const IncomePage = () => {
    const { currentSheet, isLoading, error, clearError, addIncome, editIncome, removeIncome } =
        useSheets();
    const { user } = useAuth();

    const [showForm, setShowForm] = useState(false);
    const [editingIncome, setEditingIncome] = useState<Income | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);

    const handleAddIncome = async (data: CreateIncomeData) => {
        setActionError(null);
        try {
            await addIncome({ ...data, createdBy: user?.name || user?.email || "Desconocido" });
        } catch {
            setActionError("Error al guardar el ingreso");
            throw new Error();
        }
    };

    const handleEditIncome = async (data: CreateIncomeData) => {
        if (!editingIncome) return;
        setActionError(null);
        try {
            await editIncome(editingIncome.id, {
                ...data,
                createdBy: data.createdBy || editingIncome.createdBy,
            });
            setEditingIncome(null);
        } catch {
            setActionError("Error al actualizar el ingreso");
            throw new Error();
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingId) return;
        setActionError(null);
        try {
            await removeIncome(deletingId);
            setDeletingId(null);
        } catch {
            setActionError("Error al eliminar el ingreso");
        }
    };

    if (!currentSheet) {
        return (
            <Box className="flex flex-col items-center justify-center py-12 gap-4 text-center">
                <Typography variant="h6" className="text-gray-500">
                    No hay una hoja activa
                </Typography>
                <Typography variant="body2" className="text-gray-400">
                    Seleccioná o creá una hoja desde la pestaña de Gastos
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Paper className="p-3 sm:p-4 mb-3 sm:mb-4!">
                <Box className="flex flex-col gap-2">
                    <Box className="flex items-center justify-between gap-2">
                        <Box className="flex items-center gap-2 min-w-0">
                            <Typography
                                variant="h6"
                                className="font-semibold! text-base sm:text-xl truncate text-green-700"
                            >
                                Ingresos - {currentSheet.monthLabel}
                            </Typography>
                            <Chip
                                label={currentSheet.income.length}
                                size="small"
                                color="success"
                                variant="outlined"
                            />
                        </Box>
                    </Box>

                    <Box className="flex gap-1.5 flex-wrap">
                        <Button
                            variant="contained"
                            size="small"
                            color="success"
                            startIcon={<AddIcon />}
                            onClick={() => {
                                setEditingIncome(null);
                                setShowForm(true);
                            }}
                        >
                            Ingreso
                        </Button>
                    </Box>
                </Box>
            </Paper>

            {/* Errors */}
            {(error || actionError) && (
                <Alert
                    severity="error"
                    className="mb-4"
                    onClose={() => {
                        clearError();
                        setActionError(null);
                    }}
                >
                    {error || actionError}
                </Alert>
            )}

            {/* Income table */}
            {isLoading
                ? (
                    <Box className="flex justify-center py-12">
                        <Box className="w-10 h-10 border-4 border-green-200 border-t-green-600 rounded-full animate-spin" />
                    </Box>
                )
                : (
                    <IncomeTable
                        income={currentSheet.income}
                        onEdit={(inc) => {
                            setEditingIncome(inc);
                            setShowForm(true);
                        }}
                        onDelete={(id) => setDeletingId(id)}
                    />
                )}

            {/* Dialogs */}
            <IncomeForm
                open={showForm}
                onClose={() => {
                    setShowForm(false);
                    setEditingIncome(null);
                }}
                onSubmit={editingIncome ? handleEditIncome : handleAddIncome}
                initial={editingIncome
                    ? {
                        description: editingIncome.description,
                        category: editingIncome.category,
                        paymentType: editingIncome.paymentType,
                        currency: editingIncome.currency,
                        amount: editingIncome.amount.toString(),
                        date: editingIncome.date,
                    }
                    : undefined}
                title={editingIncome ? "Editar Ingreso" : "Nuevo Ingreso"}
            />

            <ConfirmDelete
                open={!!deletingId}
                onClose={() => setDeletingId(null)}
                onConfirm={handleDeleteConfirm}
            />
        </Box>
    );
};
