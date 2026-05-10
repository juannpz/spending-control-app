import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { AuthState, User } from "@/types";
import * as googleAuth from "@/services/googleAuth";

interface AuthContextType extends AuthState {
    login: () => Promise<void>;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        token: null,
    });

    // Try to restore session on mount
    useEffect(() => {
        const persisted = googleAuth.loadPersistedAuth();
        if (persisted) {
            setState({
                user: persisted.user,
                isAuthenticated: true,
                isLoading: false,
                token: persisted.token,
            });
        } else {
            setState((prev) => ({ ...prev, isLoading: false }));
        }
    }, []);

    const login = useCallback(async () => {
        setState((prev) => ({ ...prev, isLoading: true }));
        try {
            const { user, token } = await googleAuth.loginWithGoogle();
            googleAuth.persistAuth(token, user);
            setState({
                user,
                isAuthenticated: true,
                isLoading: false,
                token,
            });
        } catch (err) {
            console.error("Login failed:", err);
            setState((prev) => ({ ...prev, isLoading: false }));
            throw err;
        }
    }, []);

    const logout = useCallback(() => {
        googleAuth.logoutFromGoogle();
        setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            token: null,
        });
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};
