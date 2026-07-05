import { useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
    AppBar,
    Avatar,
    BottomNavigation,
    BottomNavigationAction,
    Box,
    IconButton,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Toolbar,
    Tooltip,
    Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SavingsIcon from "@mui/icons-material/Savings";
import BarChartIcon from "@mui/icons-material/BarChart";
import { useAuth } from "@/contexts/AuthContext";

const NAV_ROUTES = {
    "/": { label: "Gastos", icon: <ReceiptLongIcon /> },
    "/income": { label: "Ingresos", icon: <SavingsIcon /> },
    "/metrics": { label: "Métricas", icon: <BarChartIcon /> },
} as const;

export const AppLayout = () => {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
    const handleMenuClose = () => setAnchorEl(null);
    const handleLogout = () => {
        handleMenuClose();
        logout();
        navigate("/login");
    };

    // Determine active tab from path
    const currentPath = Object.keys(NAV_ROUTES).find(
        (route) => route === location.pathname,
    ) ?? "/";

    return (
        <Box className="min-h-screen bg-gray-50 flex flex-col">
            <AppBar position="sticky" elevation={1}>
                <Toolbar className="flex justify-between">
                    <Box
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => navigate("/")}
                    >
                        <img src="/logo7.png" alt="Kaiju" className="h-7 w-7 sm:h-8 sm:w-8" />
                        <Typography
                            variant="h6"
                            className="font-bold! whitespace-nowrap text-lg sm:text-xl tracking-tight"
                        >
                            Kaiju
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

            <Box component="main" className="flex-1 max-w-4xl mx-auto p-2 sm:p-4 w-full">
                <Outlet />
            </Box>

            {/* Bottom Navigation — mobile-first */}
            <Paper
                elevation={3}
                className="sticky bottom-0 sm:hidden z-10"
                sx={{ pb: "env(safe-area-inset-bottom, 0)" }}
            >
                <BottomNavigation
                    value={currentPath}
                    onChange={(_e, newPath) => navigate(newPath)}
                >
                    {Object.entries(NAV_ROUTES).map(([path, { label, icon }]) => (
                        <BottomNavigationAction
                            key={path}
                            value={path}
                            label={label}
                            icon={icon}
                        />
                    ))}
                </BottomNavigation>
            </Paper>

            {/* Desktop: top-level tab bar */}
            <Box className="hidden sm:flex justify-center gap-1 py-2 bg-white border-t">
                {Object.entries(NAV_ROUTES).map(([path, { label, icon }]) => (
                    <Box
                        key={path}
                        component="button"
                        onClick={() => navigate(path)}
                        sx={{
                            border: "none",
                            bgcolor: "transparent",
                            cursor: "pointer",
                            px: 2,
                            py: 1,
                        }}
                        className={`flex items-center gap-1.5 rounded-lg text-sm font-medium transition-colors ${
                            currentPath === path
                                ? "bg-blue-50 text-blue-700"
                                : "text-gray-500 hover:bg-gray-100"
                        }`}
                    >
                        {icon}
                        {label}
                    </Box>
                ))}
            </Box>
        </Box>
    );
};
