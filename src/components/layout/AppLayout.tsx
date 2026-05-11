import { useState } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import {
    AppBar,
    Avatar,
    Box,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import { useAuth } from "@/contexts/AuthContext";

export const AppLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);
    const handleLogout = () => {
        handleMenuClose();
        logout();
        navigate("/login");
    };

    return (
        <Box className="min-h-screen bg-gray-50">
            <AppBar position="sticky" elevation={1}>
                <Toolbar className="flex justify-between">
                    <Box
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => navigate("/")}
                    >
                        <AccountBalanceWalletIcon className="text-2xl sm:text-3xl" />
                        <Typography
                            variant="h6"
                            className="font-semibold! whitespace-nowrap text-lg sm:text-xl"
                        >
                            Gastos
                        </Typography>
                    </Box>

                    <Box className="flex items-center gap-2">
                        <Typography variant="body2" className="hidden sm:block">
                            {user?.name}
                        </Typography>
                        <Tooltip title="Cuenta">
                            <IconButton onClick={handleMenuOpen} size="small">
                                <Avatar
                                    src={user?.picture}
                                    alt={user?.name}
                                    sx={{ width: 36, height: 36 }}
                                />
                            </IconButton>
                        </Tooltip>
                    </Box>

                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleMenuClose}
                        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                    >
                        <MenuItem disabled>
                            <ListItemText primary={user?.name} secondary={user?.email} />
                        </MenuItem>
                        <MenuItem onClick={handleLogout}>
                            <ListItemIcon>
                                <LogoutIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Cerrar sesión</ListItemText>
                        </MenuItem>
                    </Menu>
                </Toolbar>
            </AppBar>

            <Box component="main" className="max-w-4xl mx-auto p-2 sm:p-4">
                <Outlet />
            </Box>
        </Box>
    );
};
