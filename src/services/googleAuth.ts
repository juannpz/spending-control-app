import type { User } from "@/types";
import { GOOGLE_CLIENT_ID } from "@/constants";

const SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "openid",
];

interface TokenResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
    scope: string;
}

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

export const getGoogleToken = (): Promise<TokenResponse> => {
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

        client.requestAccessToken({ prompt: "" });
    });
};

interface GoogleUserInfo {
    sub: string;
    email: string;
    name: string;
    picture: string;
}

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

export const loginWithGoogle = async (): Promise<{
    user: User;
    token: string;
}> => {
    await loadGIS();
    const tokenResponse = await getGoogleToken();
    const user = await fetchUserInfo(tokenResponse.access_token);

    return { user, token: tokenResponse.access_token };
};

/**
 * Attempt to silently obtain a fresh Google access token.
 * Uses prompt="" so no popup is shown — succeeds only if
 * the user still has a valid Google session.
 * Returns the new access_token string, or null on failure.
 */
export const silentRefreshToken = async (): Promise<string | null> => {
    try {
        await loadGIS();
        const tokenResponse = await getGoogleToken();
        return tokenResponse.access_token;
    } catch {
        return null;
    }
};

export const logoutFromGoogle = (): void => {
    if (window.google?.accounts.id) {
        window.google.accounts.id.disableAutoSelect();
    }
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_user");
};

// Persist auth in localStorage
export const persistAuth = (token: string, user: User): void => {
    localStorage.setItem("auth_token", token);
    localStorage.setItem("auth_user", JSON.stringify(user));
};

export const loadPersistedAuth = (): {
    token: string;
    user: User;
} | null => {
    const token = localStorage.getItem("auth_token");
    const userStr = localStorage.getItem("auth_user");

    if (token && userStr) {
        try {
            const user = JSON.parse(userStr) as User;
            return { token, user };
        } catch {
            // Corrupted data, clear it
            localStorage.removeItem("auth_token");
            localStorage.removeItem("auth_user");
        }
    }

    return null;
};
