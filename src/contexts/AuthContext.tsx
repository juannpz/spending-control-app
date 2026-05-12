import {
    createContext,
    type ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
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

    // ---- Refs so timeouts / callbacks always see latest values ----

    const stateRef = useRef(state);
    stateRef.current = state;

    /** setTimeout handle for scheduled proactive refresh. */
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ---- Core helpers ----

    /** Clear any pending refresh timer. */
    const clearRefreshTimer = () => {
        if (refreshTimerRef.current !== null) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
    };

    /**
     * Schedule a proactive refresh just before the stored token expires.
     * Safe to call multiple times — previous timer is cancelled first.
     * Reads expiry from localStorage so it works after any persistAuth().
     */
    const scheduleProactiveRefresh = useCallback(() => {
        clearRefreshTimer();

        const expiresAt = googleAuth.getExpiresAt();
        if (expiresAt === 0) return; // no stored expiry

        const now = Date.now();
        const delay = expiresAt - googleAuth.TOKEN_REFRESH_MARGIN_MS - now;

        if (delay <= 1000) {
            // Already in the margin or overdue — refresh now (fire-and-forget)
            refreshToken().catch(() => {
                /* silent; 401 handler will catch later */
            });
            return;
        }

        refreshTimerRef.current = setTimeout(() => {
            refreshToken().catch(() => {
                /* silent */
            });
        }, delay);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    /**
     * Execute a silent refresh and update state + persistence + schedule.
     * Returns the fresh token, or null if the refresh was impossible.
     */
    const executeRefresh = useCallback(async (): Promise<string | null> => {
        const fresh = await googleAuth.silentRefreshToken();
        if (!fresh) return null;

        // Re-fetch user info in case it changed, but keep existing as fallback
        let user: User;
        try {
            user = await googleAuth.fetchUserInfo(fresh.access_token);
        } catch {
            const persisted = googleAuth.loadPersistedAuth();
            if (!persisted) return null;
            user = persisted.user;
        }

        googleAuth.persistAuth(fresh.access_token, user, fresh.expires_in);

        setState((prev) => ({
            ...prev,
            token: fresh.access_token,
            user,
            isAuthenticated: true,
            isLoading: false,
        }));

        // Schedule the next refresh based on the freshly stored expiry
        scheduleProactiveRefresh();

        return fresh.access_token;
    }, [scheduleProactiveRefresh]);

    // ---- Public API ----

    /** Public-facing refreshToken — used by SheetsContext etc. after a 401. */
    const refreshToken = useCallback(async (): Promise<string | null> => {
        return executeRefresh();
    }, [executeRefresh]);

    // ---- Bootstrap on mount ─────────────────────────────────────────

    useEffect(() => {
        const bootstrap = async () => {
            const persisted = googleAuth.loadPersistedAuth();
            if (!persisted) {
                setState((prev) => ({ ...prev, isLoading: false }));
                return;
            }

            const { token, user } = persisted;

            // Token still valid — restore instantly
            if (!googleAuth.isTokenExpired()) {
                setState({
                    user,
                    isAuthenticated: true,
                    isLoading: false,
                    token,
                });

                // If already in the danger zone, refresh now async.
                // Otherwise schedule the next refresh.
                if (googleAuth.isTokenExpiringSoon()) {
                    executeRefresh().catch(() => {
                        /* if it fails we'll hit 401 and force login */
                    });
                } else {
                    scheduleProactiveRefresh();
                }
                return;
            }

            // Token expired — try silent refresh
            const freshToken = await executeRefresh();
            if (freshToken) {
                // executeRefresh already scheduled the next refresh
                return;
            }

            // Silent refresh impossible — user must re-login
            googleAuth.clearPersistedAuth();
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                token: null,
            });
        };

        bootstrap().catch(() => {
            googleAuth.clearPersistedAuth();
            setState({
                user: null,
                isAuthenticated: false,
                isLoading: false,
                token: null,
            });
        });

        return () => {
            clearRefreshTimer();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Login / Logout ----

    const login = useCallback(async () => {
        setState((prev) => ({ ...prev, isLoading: true }));
        try {
            const { user, token, expiresIn } = await googleAuth.loginWithGoogle();
            googleAuth.persistAuth(token, user, expiresIn);

            setState({
                user,
                isAuthenticated: true,
                isLoading: false,
                token,
            });

            scheduleProactiveRefresh();
        } catch (err) {
            console.error("Login failed:", err);
            setState((prev) => ({ ...prev, isLoading: false }));
            throw err;
        }
    }, [scheduleProactiveRefresh]);

    const logout = useCallback(() => {
        clearRefreshTimer();
        googleAuth.logoutFromGoogle();
        setState({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            token: null,
        });
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
