import { useNavigate } from "react-router-dom";
import { Alert, Box, Paper, Typography } from "@mui/material";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { LoginButton } from "@/components/auth/LoginButton";
import { useAuth } from "@/contexts/AuthContext";
import { useState } from "react";

export const LoginPage = () => {
    const { login, isLoading } = useAuth();
    const navigate = useNavigate();
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        setError(null);
        try {
            await login();
            navigate("/");
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Error al iniciar sesión";
            setError(msg);
        }
    };

    return (
        <Box className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
            <Paper
                elevation={3}
                className="w-full max-w-sm p-8 flex flex-col items-center gap-6 text-center"
            >
                <Box className="bg-blue-600 text-white rounded-full p-4">
                    <AccountBalanceWalletIcon className="text-5xl" />
                </Box>

                <Box>
                    <Typography variant="h4" className="font-bold! text-gray-800">
                        Control de Gastos
                    </Typography>
                    <Typography variant="body1" className="text-gray-500 mt-1">
                        Seguí tus gastos mensuales sincronizado con Google Sheets
                    </Typography>
                </Box>

                {error && (
                    <Alert severity="error" className="w-full">
                        {error}
                    </Alert>
                )}

                <Box className="flex flex-col gap-2 w-full">
                    <LoginButton isLoading={isLoading} onLogin={handleLogin} />

                    <Typography variant="caption" className="text-gray-400">
                        Iniciá sesión con tu cuenta de Google para empezar. Tus datos se guardan
                        directamente en tu Google Sheets.
                    </Typography>
                </Box>
            </Paper>
        </Box>
    );
};
