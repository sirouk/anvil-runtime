/**
 * Anvil Session Manager
 * 
 * Handles Anvil session cookies, session ID extraction, authentication,
 * and session persistence across WebSocket connections
 */

export interface AnvilSessionData {
    sessionId: string;
    encryptedData?: string;
    isAuthenticated: boolean;
    userId?: string;
    userEmail?: string;
    expiresAt?: number;
    origin?: string;
}

export interface SessionCookieConfig {
    cookieName?: string;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
    domain?: string;
    path?: string;
    maxAge?: number;
}

export interface ParsedCookie {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: Date;
    maxAge?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
}

export interface SessionValidationResult {
    valid: boolean;
    sessionId?: string;
    errors: string[];
    warnings: string[];
}

export class AnvilSessionManager {
    private config: Required<SessionCookieConfig>;
    private sessionCache: Map<string, AnvilSessionData> = new Map();
    private sessionTimeouts: Map<string, NodeJS.Timeout> = new Map();

    constructor(config: SessionCookieConfig = {}) {
        this.config = {
            cookieName: config.cookieName || 'anvil-session',
            httpOnly: config.httpOnly ?? true,
            secure: config.secure ?? false,
            sameSite: config.sameSite || 'lax',
            domain: config.domain || '',
            path: config.path || '/',
            maxAge: config.maxAge || 86400 // 24 hours
        };
    }

    /**
     * Parse Anvil session cookie from request headers
     */
    parseSessionFromCookies(cookieHeader?: string): AnvilSessionData | null {
        if (!cookieHeader) {
            return null;
        }

        const cookies = this.parseCookieHeader(cookieHeader);
        const sessionCookie = cookies.find(c => c.name === this.config.cookieName);

        if (!sessionCookie) {
            return null;
        }

        return this.parseAnvilSessionCookie(sessionCookie.value);
    }

    /**
     * Parse individual Anvil session cookie value
     */
    parseAnvilSessionCookie(cookieValue: string): AnvilSessionData | null {
        try {
            // Decode URL-encoded cookie value
            const decodedValue = decodeURIComponent(cookieValue);

            // Anvil session format: "SESSIONID%3DEncryptedData" or "SESSIONID=EncryptedData"
            // The %3D is URL-encoded "="
            const parts = decodedValue.split(/[=%]3D/);

            if (parts.length < 1) {
                return null;
            }

            const sessionId = parts[0];
            const encryptedData = parts.length > 1 ? parts.slice(1).join('=') : undefined;

            // Validate session ID format (32-character alphanumeric)
            if (!this.isValidSessionId(sessionId)) {
                return null;
            }

            return {
                sessionId,
                encryptedData,
                isAuthenticated: false, // Will be determined by server validation
                origin: undefined
            };

        } catch (error) {
            console.error('Error parsing Anvil session cookie:', error);
            return null;
        }
    }

    /**
     * Validate session ID format
     */
    isValidSessionId(sessionId: string): boolean {
        // Anvil session IDs are 32-character alphanumeric strings
        const sessionIdPattern = /^[A-Z0-9]{32}$/;
        return sessionIdPattern.test(sessionId);
    }

    /**
     * Extract session ID from various sources
     */
    extractSessionId(cookieHeader?: string, urlParams?: URLSearchParams): string | null {
        // Try cookie first
        const sessionFromCookie = this.parseSessionFromCookies(cookieHeader);
        if (sessionFromCookie) {
            return sessionFromCookie.sessionId;
        }

        // Try URL parameter
        if (urlParams) {
            const urlSessionToken = urlParams.get('_anvil_session');
            if (urlSessionToken) {
                // URL session tokens can be in format "SESSIONID=..." or just "SESSIONID"
                const sessionId = urlSessionToken.split('=')[0];
                if (this.isValidSessionId(sessionId)) {
                    return sessionId;
                }
            }
        }

        return null;
    }

    /**
     * Create session cookie for response
     */
    createSessionCookie(sessionData: AnvilSessionData): string {
        const { sessionId, encryptedData } = sessionData;

        // Reconstruct Anvil session cookie format
        const cookieValue = encryptedData
            ? `${sessionId}%3D${encryptedData}`
            : sessionId;

        const cookieParts = [`${this.config.cookieName}=${cookieValue}`];

        if (this.config.path) {
            cookieParts.push(`Path=${this.config.path}`);
        }

        if (this.config.domain) {
            cookieParts.push(`Domain=${this.config.domain}`);
        }

        if (this.config.maxAge > 0) {
            cookieParts.push(`Max-Age=${this.config.maxAge}`);
        }

        if (this.config.httpOnly) {
            cookieParts.push('HttpOnly');
        }

        if (this.config.secure) {
            cookieParts.push('Secure');
        }

        if (this.config.sameSite) {
            cookieParts.push(`SameSite=${this.config.sameSite}`);
        }

        return cookieParts.join('; ');
    }

    /**
     * Validate session against Anvil server format
     */
    validateSession(sessionData: AnvilSessionData): SessionValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate session ID
        if (!sessionData.sessionId) {
            errors.push('Session ID is required');
        } else if (!this.isValidSessionId(sessionData.sessionId)) {
            errors.push('Invalid session ID format (expected 32-character alphanumeric)');
        }

        // Check session expiry
        if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
            errors.push('Session has expired');
        }

        // Warn about missing encrypted data (might indicate incomplete session)
        if (!sessionData.encryptedData) {
            warnings.push('Session missing encrypted data - may be incomplete');
        }

        return {
            valid: errors.length === 0,
            sessionId: sessionData.sessionId,
            errors,
            warnings
        };
    }

    /**
     * Cache session data for quick access
     */
    cacheSession(sessionData: AnvilSessionData): void {
        const { sessionId } = sessionData;

        // Clear existing timeout
        const existingTimeout = this.sessionTimeouts.get(sessionId);
        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        // Cache session data
        this.sessionCache.set(sessionId, {
            ...sessionData,
            expiresAt: sessionData.expiresAt || Date.now() + (this.config.maxAge * 1000)
        });

        // Set expiry timeout
        const expiryTime = sessionData.expiresAt || Date.now() + (this.config.maxAge * 1000);
        const timeout = setTimeout(() => {
            this.sessionCache.delete(sessionId);
            this.sessionTimeouts.delete(sessionId);
        }, expiryTime - Date.now());

        this.sessionTimeouts.set(sessionId, timeout);
    }

    /**
     * Get cached session data
     */
    getCachedSession(sessionId: string): AnvilSessionData | null {
        const sessionData = this.sessionCache.get(sessionId);

        if (!sessionData) {
            return null;
        }

        // Check if session has expired
        if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
            this.sessionCache.delete(sessionId);
            this.sessionTimeouts.delete(sessionId);
            return null;
        }

        return sessionData;
    }

    /**
     * Remove session from cache
     */
    removeSession(sessionId: string): void {
        this.sessionCache.delete(sessionId);

        const timeout = this.sessionTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.sessionTimeouts.delete(sessionId);
        }
    }

    /**
     * Parse cookie header into individual cookies
     */
    private parseCookieHeader(cookieHeader: string): ParsedCookie[] {
        const cookies: ParsedCookie[] = [];

        // Split by semicolon and process each cookie
        const cookiePairs = cookieHeader.split(';');

        for (const pair of cookiePairs) {
            const trimmedPair = pair.trim();
            const equalIndex = trimmedPair.indexOf('=');

            if (equalIndex === -1) {
                continue; // Skip invalid cookie pairs
            }

            const name = trimmedPair.substring(0, equalIndex).trim();
            const value = trimmedPair.substring(equalIndex + 1).trim();

            // Skip cookie attributes (they don't have names we care about)
            if (this.isCookieAttribute(name)) {
                continue;
            }

            cookies.push({
                name,
                value
            });
        }

        return cookies;
    }

    /**
     * Check if a name is a cookie attribute rather than a cookie name
     */
    private isCookieAttribute(name: string): boolean {
        const attributes = ['domain', 'path', 'expires', 'max-age', 'httponly', 'secure', 'samesite'];
        return attributes.includes(name.toLowerCase());
    }

    /**
     * Generate new session ID
     */
    generateSessionId(): string {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 32; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Create new session data
     */
    createNewSession(options: Partial<AnvilSessionData> = {}): AnvilSessionData {
        return {
            sessionId: this.generateSessionId(),
            isAuthenticated: false,
            ...options,
            expiresAt: options.expiresAt || Date.now() + (this.config.maxAge * 1000)
        };
    }

    /**
     * Get session statistics
     */
    getStats() {
        return {
            cachedSessions: this.sessionCache.size,
            activeTimeouts: this.sessionTimeouts.size,
            config: this.config
        };
    }

    /**
     * Clear all cached sessions
     */
    clearCache(): void {
        this.sessionCache.clear();

        for (const timeout of this.sessionTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.sessionTimeouts.clear();
    }

    /**
     * Update session authentication status
     */
    updateSessionAuth(sessionId: string, authData: {
        isAuthenticated: boolean;
        userId?: string;
        userEmail?: string;
    }): boolean {
        const sessionData = this.sessionCache.get(sessionId);
        if (!sessionData) {
            return false;
        }

        Object.assign(sessionData, authData);
        this.sessionCache.set(sessionId, sessionData);
        return true;
    }

    /**
     * Extract all session IDs from multiple sources
     */
    extractAllSessionIds(cookieHeader?: string, urlParams?: URLSearchParams): string[] {
        const sessionIds: string[] = [];

        // From cookies
        const cookieSessionId = this.extractSessionId(cookieHeader);
        if (cookieSessionId) {
            sessionIds.push(cookieSessionId);
        }

        // From URL parameters
        const urlSessionId = this.extractSessionId(undefined, urlParams);
        if (urlSessionId && !sessionIds.includes(urlSessionId)) {
            sessionIds.push(urlSessionId);
        }

        return sessionIds;
    }
}

export default AnvilSessionManager; 