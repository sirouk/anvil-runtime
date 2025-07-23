/**
 * Anvil Authentication Manager
 * 
 * Handles authentication tokens, uplink keys, session validation,
 * and authentication state management for Anvil bridge
 */

export interface AnvilAuthTokens {
    sessionToken: string;           // Main session identifier
    uplinkKey?: string;            // WebSocket authentication key
    cookieToken?: string;          // Cookie-based authentication token
    urlToken?: string;             // URL-based authentication token
    temporaryTokens?: Set<string>; // Temporary tokens for special purposes
    burnedToken?: string;          // Burned token after cookie authentication
}

export interface AnvilAuthState {
    isAuthenticated: boolean;
    userId?: string;
    userEmail?: string;
    userRow?: any;                 // User data from Users table
    loginTime?: number;
    lastActivity?: number;
    sessionStartTime?: number;
}

export interface AnvilTokenValidation {
    valid: boolean;
    tokenType: 'session' | 'uplink' | 'cookie' | 'url' | 'temporary' | 'burned' | 'unknown';
    sessionId?: string;
    errors: string[];
    warnings: string[];
}

export interface AuthenticationHeaders {
    'Session-Token'?: string;
    'Uplink-Key'?: string;
    'Authorization'?: string;
    'X-Anvil-Session'?: string;
    'Cookie'?: string;
    'User-Agent'?: string;
}

export interface AuthConfig {
    tokenExpiryMinutes?: number;   // Session token expiry
    uplinkKeyLength?: number;      // Expected uplink key length
    maxTemporaryTokens?: number;   // Maximum temporary tokens per session
    validateTokenFormat?: boolean; // Whether to validate token formats
    debug?: boolean;
}

export class AnvilAuthManager {
    private config: Required<AuthConfig>;
    private authSessions: Map<string, AnvilAuthState> = new Map();
    private tokenCache: Map<string, AnvilAuthTokens> = new Map();
    private tokenExpiryTimers: Map<string, NodeJS.Timeout> = new Map();

    constructor(config: AuthConfig = {}) {
        this.config = {
            tokenExpiryMinutes: config.tokenExpiryMinutes || 30,
            uplinkKeyLength: config.uplinkKeyLength || 21, // Base32 21 chars
            maxTemporaryTokens: config.maxTemporaryTokens || 10,
            validateTokenFormat: config.validateTokenFormat ?? true,
            debug: config.debug || false
        };
    }

    /**
     * Parse authentication tokens from session cookie
     */
    parseAuthTokensFromCookie(cookieValue: string): AnvilAuthTokens | null {
        try {
            // Decode and parse session cookie
            const decodedValue = decodeURIComponent(cookieValue);
            const equalIndex = decodedValue.indexOf('=');

            if (equalIndex === -1) {
                // Simple session token
                return {
                    sessionToken: decodedValue,
                    cookieToken: cookieValue
                };
            }

            const sessionToken = decodedValue.substring(0, equalIndex);
            const encryptedData = decodedValue.substring(equalIndex + 1);

            // Validate session token format
            if (!this.isValidSessionToken(sessionToken)) {
                return null;
            }

            return {
                sessionToken,
                cookieToken: cookieValue,
                uplinkKey: this.extractUplinkKeyFromEncryptedData(encryptedData)
            };

        } catch (error) {
            this.log('Error parsing auth tokens from cookie:', error);
            return null;
        }
    }

    /**
     * Extract uplink key from encrypted session data
     */
    private extractUplinkKeyFromEncryptedData(encryptedData: string): string | undefined {
        // In real Anvil, uplink keys are embedded in encrypted session data
        // For bridge compatibility, we'll generate a consistent uplink key
        // based on the session token and encrypted data

        if (encryptedData && encryptedData.length > 10) {
            // Generate consistent uplink key from session data
            return this.generateUplinkKey(encryptedData);
        }

        return undefined;
    }

    /**
     * Generate uplink key for WebSocket authentication
     */
    generateUplinkKey(seed?: string): string {
        // Generate base32-like uplink key (21 characters)
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';

        // Use seed for consistency if provided
        let seedHash = 0;
        if (seed) {
            for (let i = 0; i < seed.length; i++) {
                seedHash = ((seedHash << 5) - seedHash + seed.charCodeAt(i)) & 0xffffffff;
            }
        }

        for (let i = 0; i < this.config.uplinkKeyLength; i++) {
            const randomValue = seed
                ? Math.abs(seedHash + i * 31) % chars.length
                : Math.floor(Math.random() * chars.length);
            result += chars[randomValue];
        }

        return result;
    }

    /**
     * Validate session token format
     */
    isValidSessionToken(token: string): boolean {
        if (!this.config.validateTokenFormat) {
            return true;
        }

        // Anvil session tokens are 32-character alphanumeric
        const sessionPattern = /^[A-Z0-9]{32}$/;
        return sessionPattern.test(token);
    }

    /**
     * Validate uplink key format
     */
    isValidUplinkKey(key: string): boolean {
        if (!this.config.validateTokenFormat) {
            return true;
        }

        // Uplink keys are base32-like strings
        const uplinkPattern = new RegExp(`^[A-Z2-7]{${this.config.uplinkKeyLength}}$`);
        return uplinkPattern.test(key);
    }

    /**
     * Parse URL token from request parameters
     */
    parseUrlToken(urlParams: URLSearchParams): string | null {
        const urlToken = urlParams.get('_anvil_session');
        if (!urlToken) {
            return null;
        }

        // URL tokens can be "SESSIONID=KEY" or just "SESSIONID"
        const sessionId = urlToken.split('=')[0];
        return this.isValidSessionToken(sessionId) ? sessionId : null;
    }

    /**
     * Create authentication tokens for a session
     */
    createAuthTokens(sessionToken: string, options: {
        uplinkKey?: string;
        generateUplink?: boolean;
        cookieToken?: string;
        urlToken?: string;
    } = {}): AnvilAuthTokens {

        const tokens: AnvilAuthTokens = {
            sessionToken,
            cookieToken: options.cookieToken,
            urlToken: options.urlToken,
            temporaryTokens: new Set()
        };

        // Generate or use provided uplink key
        if (options.generateUplink || options.uplinkKey) {
            tokens.uplinkKey = options.uplinkKey || this.generateUplinkKey(sessionToken);
        }

        return tokens;
    }

    /**
     * Validate authentication tokens
     */
    validateTokens(tokens: AnvilAuthTokens): AnvilTokenValidation {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate session token
        if (!tokens.sessionToken) {
            errors.push('Session token is required');
        } else if (!this.isValidSessionToken(tokens.sessionToken)) {
            errors.push('Invalid session token format');
        }

        // Validate uplink key if present
        if (tokens.uplinkKey && !this.isValidUplinkKey(tokens.uplinkKey)) {
            warnings.push('Invalid uplink key format');
        }

        // Check token consistency
        if (tokens.cookieToken && tokens.urlToken &&
            tokens.cookieToken !== tokens.urlToken) {
            warnings.push('Cookie and URL tokens differ');
        }

        return {
            valid: errors.length === 0,
            tokenType: this.determineTokenType(tokens),
            sessionId: tokens.sessionToken,
            errors,
            warnings
        };
    }

    /**
     * Determine primary token type
     */
    private determineTokenType(tokens: AnvilAuthTokens): AnvilTokenValidation['tokenType'] {
        if (tokens.burnedToken) return 'burned';
        if (tokens.cookieToken) return 'cookie';
        if (tokens.urlToken) return 'url';
        if (tokens.uplinkKey) return 'uplink';
        if (tokens.temporaryTokens && tokens.temporaryTokens.size > 0) return 'temporary';
        if (tokens.sessionToken) return 'session';
        return 'unknown';
    }

    /**
     * Create authentication headers for Anvil server requests
     */
    createAuthHeaders(tokens: AnvilAuthTokens, options: {
        includeUserAgent?: boolean;
        customHeaders?: Record<string, string>;
    } = {}): AuthenticationHeaders {

        const headers: AuthenticationHeaders = {};

        // Add session token
        if (tokens.sessionToken) {
            headers['Session-Token'] = tokens.sessionToken;
            headers['X-Anvil-Session'] = tokens.sessionToken;
        }

        // Add uplink key for WebSocket authentication
        if (tokens.uplinkKey) {
            headers['Uplink-Key'] = tokens.uplinkKey;
        }

        // Add cookie if available
        if (tokens.cookieToken) {
            headers['Cookie'] = `anvil-session=${tokens.cookieToken}`;
        }

        // Add user agent
        if (options.includeUserAgent !== false) {
            headers['User-Agent'] = 'Anvil-NextJS-Bridge/1.0';
        }

        // Add custom headers
        if (options.customHeaders) {
            Object.assign(headers, options.customHeaders);
        }

        return headers;
    }

    /**
     * Set authentication state for a session
     */
    setAuthState(sessionToken: string, authState: Partial<AnvilAuthState>): void {
        const existing = this.authSessions.get(sessionToken) || {
            isAuthenticated: false
        };

        const updated: AnvilAuthState = {
            ...existing,
            ...authState,
            lastActivity: Date.now()
        };

        // Set login time if becoming authenticated
        if (authState.isAuthenticated && !existing.isAuthenticated) {
            updated.loginTime = Date.now();
        }

        this.authSessions.set(sessionToken, updated);
        this.scheduleAuthExpiry(sessionToken);

        this.log(`Auth state updated for ${sessionToken}: authenticated=${updated.isAuthenticated}, userId=${updated.userId}`);
    }

    /**
     * Get authentication state for a session
     */
    getAuthState(sessionToken: string): AnvilAuthState | null {
        const authState = this.authSessions.get(sessionToken);

        if (authState) {
            // Update last activity
            authState.lastActivity = Date.now();
            this.authSessions.set(sessionToken, authState);
        }

        return authState || null;
    }

    /**
     * Check if session is authenticated
     */
    isAuthenticated(sessionToken: string): boolean {
        const authState = this.getAuthState(sessionToken);
        return authState?.isAuthenticated || false;
    }

    /**
     * Cache authentication tokens
     */
    cacheTokens(sessionToken: string, tokens: AnvilAuthTokens): void {
        this.tokenCache.set(sessionToken, tokens);
        this.scheduleTokenExpiry(sessionToken);
    }

    /**
     * Get cached tokens
     */
    getCachedTokens(sessionToken: string): AnvilAuthTokens | null {
        return this.tokenCache.get(sessionToken) || null;
    }

    /**
     * Add temporary token
     */
    addTemporaryToken(sessionToken: string, tempToken: string): boolean {
        const tokens = this.getCachedTokens(sessionToken);
        if (!tokens) {
            return false;
        }

        if (!tokens.temporaryTokens) {
            tokens.temporaryTokens = new Set();
        }

        // Limit temporary tokens
        if (tokens.temporaryTokens.size >= this.config.maxTemporaryTokens) {
            // Remove oldest (first) token
            const firstToken = tokens.temporaryTokens.values().next().value;
            if (firstToken) {
                tokens.temporaryTokens.delete(firstToken);
            }
        }

        tokens.temporaryTokens.add(tempToken);
        this.cacheTokens(sessionToken, tokens);

        this.log(`Added temporary token for ${sessionToken}: ${tempToken}`);
        return true;
    }

    /**
     * Check if token is temporary
     */
    isTemporaryToken(sessionToken: string, token: string): boolean {
        const tokens = this.getCachedTokens(sessionToken);
        return tokens?.temporaryTokens?.has(token) || false;
    }

    /**
     * Mark token as burned
     */
    burnToken(sessionToken: string, token: string): void {
        const tokens = this.getCachedTokens(sessionToken);
        if (tokens) {
            tokens.burnedToken = token;
            this.cacheTokens(sessionToken, tokens);
            this.log(`Token burned for ${sessionToken}: ${token}`);
        }
    }

    /**
     * Check if token is burned
     */
    isBurnedToken(sessionToken: string, token: string): boolean {
        const tokens = this.getCachedTokens(sessionToken);
        return tokens?.burnedToken === token;
    }

    /**
     * Clear authentication for a session
     */
    clearAuth(sessionToken: string): void {
        this.authSessions.delete(sessionToken);
        this.tokenCache.delete(sessionToken);

        const timer = this.tokenExpiryTimers.get(sessionToken);
        if (timer) {
            clearTimeout(timer);
            this.tokenExpiryTimers.delete(sessionToken);
        }

        this.log(`Cleared auth for ${sessionToken}`);
    }

    /**
     * Schedule authentication expiry
     */
    private scheduleAuthExpiry(sessionToken: string): void {
        // Clear existing timer
        const existingTimer = this.tokenExpiryTimers.get(sessionToken);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new expiry timer
        const expiryMs = this.config.tokenExpiryMinutes * 60 * 1000;
        const timer = setTimeout(() => {
            this.clearAuth(sessionToken);
            this.log(`Auth expired for ${sessionToken}`);
        }, expiryMs);

        this.tokenExpiryTimers.set(sessionToken, timer);
    }

    /**
     * Schedule token cache expiry
     */
    private scheduleTokenExpiry(sessionToken: string): void {
        // Tokens expire after auth expiry time
        this.scheduleAuthExpiry(sessionToken);
    }

    /**
     * Get authentication statistics
     */
    getAuthStats() {
        const authenticatedSessions = Array.from(this.authSessions.values())
            .filter(auth => auth.isAuthenticated);

        return {
            totalSessions: this.authSessions.size,
            authenticatedSessions: authenticatedSessions.length,
            cachedTokens: this.tokenCache.size,
            activeTimers: this.tokenExpiryTimers.size,
            config: this.config
        };
    }

    /**
     * Clear all authentication data
     */
    clearAll(): void {
        this.authSessions.clear();
        this.tokenCache.clear();

        for (const timer of this.tokenExpiryTimers.values()) {
            clearTimeout(timer);
        }
        this.tokenExpiryTimers.clear();

        this.log('Cleared all authentication data');
    }

    /**
     * Debug logging
     */
    private log(message: string, ...args: any[]): void {
        if (this.config.debug) {
            console.log(`[AnvilAuthManager] ${message}`, ...args);
        }
    }

    /**
     * Extract all authentication information from request
     */
    extractAuthFromRequest(cookies?: string, urlParams?: URLSearchParams, headers?: Record<string, string>): {
        tokens: AnvilAuthTokens | null;
        sessionToken: string | null;
        sources: string[];
    } {

        const sources: string[] = [];
        let tokens: AnvilAuthTokens | null = null;
        let sessionToken: string | null = null;

        // Try to extract from cookies first
        if (cookies) {
            const cookieMatch = cookies.match(/anvil-session=([^;]+)/);
            if (cookieMatch && cookieMatch[1]) {
                tokens = this.parseAuthTokensFromCookie(cookieMatch[1]);
                if (tokens) {
                    sessionToken = tokens.sessionToken;
                    sources.push('cookie');
                }
            }
        }

        // Try URL parameters if no cookie tokens
        if (!tokens && urlParams) {
            const urlToken = this.parseUrlToken(urlParams);
            if (urlToken) {
                sessionToken = urlToken;
                tokens = this.createAuthTokens(urlToken, { urlToken });
                sources.push('url');
            }
        }

        // Check headers for additional auth info
        if (headers && tokens) {
            if (headers['uplink-key']) {
                tokens.uplinkKey = headers['uplink-key'];
                sources.push('header');
            }
        }

        return { tokens, sessionToken, sources };
    }
}

export default AnvilAuthManager; 