import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogContentText,
    DialogTitle,
} from "@mui/material";

interface Props {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const ConfirmDelete = ({ open, onClose, onConfirm }: Props) => (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
        <DialogTitle>¿Eliminar gasto?</DialogTitle>
        <DialogContent>
            <DialogContentText>
                Esta acción no se puede deshacer. El gasto se eliminará permanentemente de la hoja
                de Google Sheets.
            </DialogContentText>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose}>Cancelar</Button>
            <Button onClick={onConfirm} color="error" variant="contained">
                Eliminar
            </Button>
        </DialogActions>
    </Dialog>
);
