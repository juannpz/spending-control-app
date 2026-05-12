import type { User } from "@/types";
import { GOOGLE_CLIENT_ID } from "@/constants";

// ── Scopes ──────────────────────────────────────────────────────────

const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
];

// ── Token expiry ────────────────────────────────────────────────────

/**
 * How many milliseconds before the token actually expires we consider it
 * "expiring soon" and trigger a proactive refresh. 5 minutes is a safe
 * margin that covers most network delays.
 */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// ── localStorage keys ───────────────────────────────────────────────

const TOKEN_KEY = "auth_token";
const USER_KEY = "auth_user";
const EXPIRES_AT_KEY = "auth_expires_at";

// ── Types ───────────────────────────────────────────────────────────

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

interface GoogleUserInfo {
    sub: string;
    email: string;
    name: string;
    picture: string;
}

interface PersistedAuth {
    token: string;
    user: User;
    /** Unix timestamp (ms) when the token expires. */
    expiresAt: number;
}

// ── Google Identity Services (GIS) script loader ────────────────────

let gisLoaded = false;
let gisLoadPromise: Promise<void> | null = null;

export const loadGIS = (): Promise<void> => {
    if (gisLoaded) return Promise.resolve();
    if (gisLoadPromise) return gisLoadPromise;

    gisLoadPromise = new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
            gisLoaded = true;
            resolve();
        };
        script.onerror = () => {
            gisLoadPromise = null;
            reject(new Error("Failed to load Google Identity Services"));
        };
        document.head.appendChild(script);
    });

    return gisLoadPromise;
};

/**
 * Request an access token using the OAuth 2.0 Token model.
 *
 * IMPORTANT: `prompt: ""` tells Google to only show UI if absolutely
 * necessary (no prior consent, session expired, etc.). On a healthy
 * session with existing consent this resolves **silently** — no popup.
 *
 * On mobile, some browsers may still pop a window if the Google session
 * is stale. That's why we proactively refresh long before expiry
 * (see AuthContext for the scheduled refresh logic).
 *
 * Returns both the token AND its lifetime so callers can schedule
 * the next refresh.
 */
const requestAccessToken = (): Promise<TokenResponse> => {
    return new Promise((resolve, reject) => {
        if (!window.google) {
            reject(new Error("Google Identity Services not loaded"));
            return;
        }

        const client = window.google.accounts.oauth2.initTokenClient({
            client_id: GOOGLE_CLIENT_ID,
            scope: SCOPES.join(" "),
            callback: (response: TokenResponse) => {
                if (response.access_token) {
                    resolve(response);
                } else {
                    reject(new Error("Failed to obtain access token"));
                }
            },
            error_callback: (error: unknown) => {
                reject(error);
            },
        });

        // prompt: "" means "skip UI if consent already exists"
        client.requestAccessToken({ prompt: "" });
    });
};

// ── Token persistence ───────────────────────────────────────────────

/**
 * Persist token + user + expiry to localStorage.
 * `expiresIn` comes from the `expires_in` field returned by Google
 * (typically 3599 seconds = ~1 hour).
 */
export const persistAuth = (
    token: string,
    user: User,
    expiresIn: number,
): void => {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(EXPIRES_AT_KEY, String(expiresAt));
};

/** Load persisted auth (token + user + expiry) or null if missing / corrupted. */
export const loadPersistedAuth = (): PersistedAuth | null => {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);

    if (!token || !userStr) return null;

    // expiresAt may be missing for legacy records (before this refactor).
    // Default to 0 so the token is treated as expired → immediate refresh.
    const expiresAt = expiresAtStr ? Number(expiresAtStr) : 0;

    try {
        const user = JSON.parse(userStr) as User;
        return { token, user, expiresAt };
    } catch {
        clearPersistedAuth();
        return null;
    }
};

/** Remove all auth data from localStorage. */
export const clearPersistedAuth = (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(EXPIRES_AT_KEY);
};

/** True when the token has already passed its expiry time. */
export const isTokenExpired = (): boolean => {
    const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);
    if (!expiresAtStr) return true;
    return Date.now() >= Number(expiresAtStr);
};

/** True when the token will expire within the refresh margin window. */
export const isTokenExpiringSoon = (): boolean => {
    const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);
    if (!expiresAtStr) return true;
    return Date.now() >= Number(expiresAtStr) - TOKEN_REFRESH_MARGIN_MS;
};

/**
 * Returns the stored expiresAt timestamp, or 0 if missing.
 * Useful for computing the timeout delay.
 */
export const getExpiresAt = (): number => {
    const expiresAtStr = localStorage.getItem(EXPIRES_AT_KEY);
    return expiresAtStr ? Number(expiresAtStr) : 0;
};

// ── User info ──────────────────────────────────────────────────────

export const fetchUserInfo = async (token: string): Promise<User> => {
    const response = await fetch(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        {
            headers: { Authorization: `Bearer ${token}` },
        },
    );

    if (!response.ok) {
        throw new Error("Failed to fetch user info");
    }

    const data = (await response.json()) as GoogleUserInfo;

    return {
        id: data.sub,
        email: data.email,
        name: data.name,
        picture: data.picture,
    };
};

// ── Public auth flows ──────────────────────────────────────────────

/**
 * Full interactive login flow.
 * May show a Google popup/redirect on first consent.
 */
export const loginWithGoogle = async (): Promise<{
    user: User;
    token: string;
    expiresIn: number;
}> => {
    await loadGIS();
    const tokenResponse = await requestAccessToken();
    const user = await fetchUserInfo(tokenResponse.access_token);

    return {
        user,
        token: tokenResponse.access_token,
        expiresIn: tokenResponse.expires_in,
    };
};

/**
 * Attempt to obtain a fresh access token **silently**.
 *
 * Uses `prompt: ""` which succeeds without any UI when:
 * - The user still has a valid Google session in this browser
 * - The user has already granted consent for the requested scopes
 *
 * Returns the full token response (with `expires_in`) on success,
 * or null when silent acquisition is impossible
 * (session expired, cookies cleared, etc.).
 */
export const silentRefreshToken = async (): Promise<TokenResponse | null> => {
    try {
        await loadGIS();
        return await requestAccessToken();
    } catch {
        return null;
    }
};

// ── Logout ─────────────────────────────────────────────────────────

export const logoutFromGoogle = (): void => {
    // Tell Google to stop auto-selecting an account in future prompts
    // (only relevant if we switch to One Tap / Sign-In model later).
    try {
        if (window.google?.accounts.id) {
            window.google.accounts.id.disableAutoSelect();
        }
    } catch {
        // Best-effort, not critical.
    }
    clearPersistedAuth();
};

// ── Shared 401 detection ───────────────────────────────────────────

/**
 * Detect whether an error is an HTTP 401 (unauthenticated).
 *
 * Works with:
 *  - GAPI errors   (`err.result.error.code === 401`)
 *  - Fetch errors  (`err.status === 401`)
 *  - GAPI string errors (message contains "401" & "UNAUTHENTICATED")
 *
 * Use this single helper everywhere instead of copy-pasting.
 */
export const is401Error = (err: unknown): boolean => {
    const e = err as Record<string, unknown> | null;
    if (!e) return false;
    if (e.status === 401) return true;
    const result = e.result as Record<string, unknown> | null | undefined;
    const errorObj = result?.error as Record<string, unknown> | null | undefined;
    if (errorObj?.code === 401) return true;
    if (
        typeof e.message === "string" &&
        e.message.includes("401") &&
        e.message.includes("UNAUTHENTICATED")
    ) {
        return true;
    }
    return false;
};
