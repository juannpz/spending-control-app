/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_GOOGLE_CLIENT_ID: string;
    readonly VITE_GOOGLE_API_KEY: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}

// Google Identity Services types
interface GoogleOAuth2TokenClient {
    requestAccessToken(overrides?: { prompt?: string }): void;
}

interface GoogleAccountsOAuth2 {
    initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (
            response: {
                access_token: string;
                expires_in: number;
                token_type: string;
                scope: string;
            },
        ) => void;
        error_callback?: (error: unknown) => void;
    }): GoogleOAuth2TokenClient;
}

interface GoogleAccountsId {
    disableAutoSelect(): void;
    initialize(config: unknown): void;
    prompt(): void;
    renderButton(el: HTMLElement, config: unknown): void;
}

interface GoogleAccounts {
    oauth2: GoogleAccountsOAuth2;
    id: GoogleAccountsId;
}

// Google API (gapi) types
interface GapiClient {
    setToken(token: { access_token: string }): void;
    init(args: { apiKey?: string; discoveryDocs: string[] }): Promise<void>;
    load(lib: string, cb: () => void): void;
    sheets: {
        spreadsheets: {
            create(request: {
                properties: { title: string };
                sheets: Array<
                    { properties: { title: string; gridProperties?: { frozenRowCount: number } } }
                >;
            }): Promise<{ result: { spreadsheetId: string } }>;
            batchUpdate(request: {
                spreadsheetId: string;
                resource: {
                    requests: Array<{
                        addSheet?: {
                            properties: {
                                title: string;
                                gridProperties?: { frozenRowCount: number };
                            };
                        };
                        deleteDimension?: {
                            range: {
                                sheetId: number;
                                dimension: string;
                                startIndex: number;
                                endIndex: number;
                            };
                        };
                    }>;
                };
            }): Promise<{ result: unknown }>;
            get(request: { spreadsheetId: string }): Promise<{
                result: {
                    spreadsheetId?: string;
                    properties?: { title?: string };
                    sheets?: Array<{ properties?: { title?: string } }>;
                };
            }>;
            values: {
                update(request: {
                    spreadsheetId: string;
                    range: string;
                    valueInputOption: string;
                    resource: { values: string[][] };
                }): Promise<{ result: unknown }>;
                get(request: {
                    spreadsheetId: string;
                    range: string;
                }): Promise<{ result: { values?: string[][] } }>;
                append(request: {
                    spreadsheetId: string;
                    range: string;
                    valueInputOption: string;
                    insertDataOption: string;
                    resource: { values: string[][] };
                }): Promise<{ result: unknown }>;
                clear(request: {
                    spreadsheetId: string;
                    range: string;
                }): Promise<{ result: unknown }>;
            };
        };
    };
}

interface Gapi {
    client: GapiClient;
    load: (lib: string, cb: () => void) => void;
}

declare const gapi: Gapi;

interface Window {
    google?: {
        accounts: GoogleAccounts;
    };
    gapi?: Gapi;
}
