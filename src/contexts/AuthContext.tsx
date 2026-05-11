import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { AuthState, User } from "@/types";
import * as googleAuth from "@/services/googleAuth";

interface AuthContextType extends AuthState {
    login: () => Promise<void>;
    logout: () => void;
    /** Attempt silent token refresh. Returns the new token on success, null otherwise. */
    refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AuthState>({
        user: null,
        isAuthenticated: false,
        isLoading: true,
        token: null,
    });

    // Try to restore session on mount — instant, no network call.
    // Google access tokens live ~1h, so they are usually still valid on reload.
    // Token refresh is handled lazily in SheetsContext when a 401 is detected.
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

    const refreshToken = useCallback(async (): Promise<string | null> => {
        const freshToken = await googleAuth.silentRefreshToken();
        if (!freshToken) return null;

        // Re-fetch user info in case it changed, but keep existing as fallback
        let user: User;
        try {
            user = await googleAuth.fetchUserInfo(freshToken);
        } catch {
            // If userinfo fails but token is fresh, keep the stored user
            const persisted = googleAuth.loadPersistedAuth();
            if (!persisted) return null;
            user = persisted.user;
        }

        googleAuth.persistAuth(freshToken, user);
        setState((prev) => ({
            ...prev,
            token: freshToken,
            user,
            isAuthenticated: true,
            isLoading: false,
        }));
        return freshToken;
    }, []);

    return (
        <AuthContext.Provider value={{ ...state, login, logout, refreshToken }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within AuthProvider");
    return ctx;
};
