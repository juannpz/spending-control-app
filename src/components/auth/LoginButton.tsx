import Button from "@mui/material/Button";
import GoogleIcon from "@mui/icons-material/Google";
import CircularProgress from "@mui/material/CircularProgress";

interface Props {
    isLoading: boolean;
    onLogin: () => void;
}

export const LoginButton = ({ isLoading, onLogin }: Props) => (
    <Button
        variant="contained"
        size="large"
        startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <GoogleIcon />}
        onClick={onLogin}
        disabled={isLoading}
        sx={{
            px: 4,
            py: 1.5,
            borderRadius: 2,
            textTransform: "none",
            fontSize: "1rem",
            bgcolor: "#1a73e8",
            "&:hover": { bgcolor: "#1557b0" },
        }}
    >
        {isLoading ? "Conectando..." : "Iniciar sesión con Google"}
    </Button>
);
