/**
 * Standalone WebSocket Server for Anvil Bridge
 * 
 * This server runs separately from NextJS and handles WebSocket connections
 * between browser clients and the Anvil server at ws://localhost:3030/_/uplink
 */

const WebSocket = require('ws');
const http = require('http');
const url = require('url');
const path = require('path');

// JavaScript implementation of Anvil Authentication Manager
class AnvilAuthManager {
    constructor(config = {}) {
        this.config = {
            tokenExpiryMinutes: config.tokenExpiryMinutes || 30,
            uplinkKeyLength: config.uplinkKeyLength || 21,
            maxTemporaryTokens: config.maxTemporaryTokens || 10,
            validateTokenFormat: config.validateTokenFormat ?? true,
            debug: config.debug || false
        };

        this.authSessions = new Map();
        this.tokenCache = new Map();
        this.tokenExpiryTimers = new Map();
    }

    parseAuthTokensFromCookie(cookieValue) {
        try {
            const decodedValue = decodeURIComponent(cookieValue);
            const equalIndex = decodedValue.indexOf('=');

            if (equalIndex === -1) {
                return {
                    sessionToken: decodedValue,
                    cookieToken: cookieValue
                };
            }

            const sessionToken = decodedValue.substring(0, equalIndex);
            const encryptedData = decodedValue.substring(equalIndex + 1);

            if (!this.isValidSessionToken(sessionToken)) {
                return null;
            }

            return {
                sessionToken,
                cookieToken: cookieValue,
                uplinkKey: this.generateUplinkKey(encryptedData)
            };

        } catch (error) {
            console.error('Error parsing auth tokens from cookie:', error);
            return null;
        }
    }

    generateUplinkKey(seed) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';

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

    isValidSessionToken(token) {
        if (!this.config.validateTokenFormat) return true;
        const sessionPattern = /^[A-Z0-9]{32}$/;
        return sessionPattern.test(token);
    }

    isValidUplinkKey(key) {
        if (!this.config.validateTokenFormat) return true;
        const uplinkPattern = new RegExp(`^[A-Z2-7]{${this.config.uplinkKeyLength}}$`);
        return uplinkPattern.test(key);
    }

    createAuthHeaders(tokens, options = {}) {
        const headers = {};

        if (tokens.sessionToken) {
            headers['Session-Token'] = tokens.sessionToken;
            headers['X-Anvil-Session'] = tokens.sessionToken;
        }

        if (tokens.uplinkKey) {
            headers['Uplink-Key'] = tokens.uplinkKey;
        }

        if (tokens.cookieToken) {
            headers['Cookie'] = `anvil-session=${tokens.cookieToken}`;
        }

        if (options.includeUserAgent !== false) {
            headers['User-Agent'] = 'Anvil-NextJS-Bridge/1.0';
        }

        return headers;
    }

    setAuthState(sessionToken, authState) {
        const existing = this.authSessions.get(sessionToken) || { isAuthenticated: false };

        const updated = {
            ...existing,
            ...authState,
            lastActivity: Date.now()
        };

        if (authState.isAuthenticated && !existing.isAuthenticated) {
            updated.loginTime = Date.now();
        }

        this.authSessions.set(sessionToken, updated);

        if (this.config.debug) {
            console.log(`[AnvilAuthManager] Auth state updated for ${sessionToken}: authenticated=${updated.isAuthenticated}`);
        }
    }

    getAuthState(sessionToken) {
        const authState = this.authSessions.get(sessionToken);

        if (authState) {
            authState.lastActivity = Date.now();
            this.authSessions.set(sessionToken, authState);
        }

        return authState || null;
    }

    isAuthenticated(sessionToken) {
        const authState = this.getAuthState(sessionToken);
        return authState?.isAuthenticated || false;
    }

    cacheTokens(sessionToken, tokens) {
        this.tokenCache.set(sessionToken, tokens);
    }

    getCachedTokens(sessionToken) {
        return this.tokenCache.get(sessionToken) || null;
    }

    extractAuthFromRequest(cookies, urlParams, headers) {
        const sources = [];
        let tokens = null;
        let sessionToken = null;

        // Try cookies first
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

        // Try URL parameters
        if (!tokens && urlParams) {
            const urlToken = urlParams.get('_anvil_session');
            if (urlToken) {
                const sessionId = urlToken.split('=')[0];
                if (this.isValidSessionToken(sessionId)) {
                    sessionToken = sessionId;
                    tokens = { sessionToken: sessionId, urlToken };
                    sources.push('url');
                }
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

    getAuthStats() {
        return {
            totalSessions: this.authSessions.size,
            authenticatedSessions: Array.from(this.authSessions.values()).filter(auth => auth.isAuthenticated).length,
            cachedTokens: this.tokenCache.size,
            config: this.config
        };
    }
}

// JavaScript implementation of Anvil Session Manager
class AnvilSessionManager {
    constructor(config = {}) {
        this.config = {
            cookieName: config.cookieName || 'anvil-session',
            httpOnly: config.httpOnly ?? true,
            secure: config.secure ?? false,
            sameSite: config.sameSite || 'lax',
            domain: config.domain || '',
            path: config.path || '/',
            maxAge: config.maxAge || 86400 // 24 hours
        };

        this.sessionCache = new Map();
        this.sessionTimeouts = new Map();
    }

    parseSessionFromCookies(cookieHeader) {
        if (!cookieHeader) return null;

        const cookies = this.parseCookieHeader(cookieHeader);
        const sessionCookie = cookies.find(c => c.name === this.config.cookieName);

        if (!sessionCookie) return null;

        return this.parseAnvilSessionCookie(sessionCookie.value);
    }

    parseAnvilSessionCookie(cookieValue) {
        try {
            // Decode URL-encoded cookie value
            const decodedValue = decodeURIComponent(cookieValue);

            // Anvil session format: "SESSIONID=EncryptedData" (after URL decoding %3D becomes =)
            const equalIndex = decodedValue.indexOf('=');

            let sessionId, encryptedData;
            if (equalIndex !== -1) {
                sessionId = decodedValue.substring(0, equalIndex);
                encryptedData = decodedValue.substring(equalIndex + 1);
            } else {
                sessionId = decodedValue;
                encryptedData = undefined;
            }

            // Validate session ID format (32-character alphanumeric)
            if (!this.isValidSessionId(sessionId)) return null;

            return {
                sessionId,
                encryptedData,
                isAuthenticated: false,
                origin: undefined
            };

        } catch (error) {
            console.error('Error parsing Anvil session cookie:', error);
            return null;
        }
    }

    isValidSessionId(sessionId) {
        // Anvil session IDs are 32-character alphanumeric strings
        const sessionIdPattern = /^[A-Z0-9]{32}$/;
        return sessionIdPattern.test(sessionId);
    }

    extractSessionId(cookieHeader, urlParams) {
        // Try cookie first
        const sessionFromCookie = this.parseSessionFromCookies(cookieHeader);
        if (sessionFromCookie) {
            return sessionFromCookie.sessionId;
        }

        // Try URL parameter
        if (urlParams) {
            const urlSessionToken = urlParams.get('_anvil_session');
            if (urlSessionToken) {
                const sessionId = urlSessionToken.split('=')[0];
                if (this.isValidSessionId(sessionId)) {
                    return sessionId;
                }
            }
        }

        return null;
    }

    parseCookieHeader(cookieHeader) {
        const cookies = [];
        const cookiePairs = cookieHeader.split(';');

        for (const pair of cookiePairs) {
            const trimmedPair = pair.trim();
            const equalIndex = trimmedPair.indexOf('=');

            if (equalIndex === -1) continue;

            const name = trimmedPair.substring(0, equalIndex).trim();
            const value = trimmedPair.substring(equalIndex + 1).trim();

            if (this.isCookieAttribute(name)) continue;

            cookies.push({ name, value });
        }

        return cookies;
    }

    isCookieAttribute(name) {
        const attributes = ['domain', 'path', 'expires', 'max-age', 'httponly', 'secure', 'samesite'];
        return attributes.includes(name.toLowerCase());
    }

    cacheSession(sessionData) {
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

    getCachedSession(sessionId) {
        const sessionData = this.sessionCache.get(sessionId);

        if (!sessionData) return null;

        // Check if session has expired
        if (sessionData.expiresAt && sessionData.expiresAt < Date.now()) {
            this.sessionCache.delete(sessionId);
            this.sessionTimeouts.delete(sessionId);
            return null;
        }

        return sessionData;
    }

    getStats() {
        return {
            cachedSessions: this.sessionCache.size,
            activeTimeouts: this.sessionTimeouts.size,
            config: this.config
        };
    }
}

// JavaScript version of connection manager functionality
class ConnectionManager {
    constructor(config = {}) {
        this.config = {
            heartbeatInterval: config.heartbeatInterval || 30000,        // 30 seconds
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
            reconnectBaseDelay: config.reconnectBaseDelay || 1000,       // 1 second
            maxReconnectDelay: config.maxReconnectDelay || 30000,        // 30 seconds
            connectionTimeout: config.connectionTimeout || 15000,        // 15 seconds
            messageQueueLimit: config.messageQueueLimit || 100,
            debug: config.debug || false
        };

        this.state = {
            status: 'disconnected',
            lastHeartbeat: 0,
            reconnectAttempts: 0,
            totalConnections: 0,
            messagesQueued: 0,
            uptime: 0
        };

        this.messageQueue = [];
        this.connectionStartTime = 0;
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
    }

    start() {
        if (this.state.status !== 'disconnected') {
            this.log('Connection manager already active');
            return;
        }

        this.connectionStartTime = Date.now();
        this.setState('connecting');
        this.log('Starting connection manager');
    }

    stop() {
        this.log('Stopping connection manager');
        this.clearTimers();
        this.setState('disconnected');
        this.state.reconnectAttempts = 0;
    }

    onConnectionEstablished(sessionId) {
        this.log('Connection established');
        this.state.sessionId = sessionId;
        this.state.totalConnections++;
        this.state.reconnectAttempts = 0;
        this.setState('connected');

        // Start heartbeat timer
        this.startHeartbeat();

        // Process queued messages
        this.processMessageQueue();
    }

    onConnectionLost(reason = 'Unknown') {
        this.log(`Connection lost: ${reason}`);
        this.clearTimers();

        // Attempt reconnection if not exceeded max attempts
        if (this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnection();
        } else {
            this.log('Max reconnection attempts exceeded');
            this.setState('failed');
        }
    }

    queueMessage(message, priority = 'normal') {
        if (this.messageQueue.length >= this.config.messageQueueLimit) {
            this.log('Message queue full, dropping oldest message');
            this.messageQueue.shift();
        }

        const queuedMessage = {
            message,
            timestamp: Date.now(),
            attempts: 0,
            priority
        };

        // Insert by priority (high priority first)
        if (priority === 'high') {
            this.messageQueue.unshift(queuedMessage);
        } else {
            this.messageQueue.push(queuedMessage);
        }

        this.state.messagesQueued = this.messageQueue.length;
        this.log(`Message queued (${priority}): ${message.type} - Queue size: ${this.messageQueue.length}`);

        return true;
    }

    processMessageQueue() {
        if (this.state.status !== 'connected' || this.messageQueue.length === 0) {
            return;
        }

        this.log(`Processing ${this.messageQueue.length} queued messages`);

        const messages = [...this.messageQueue];
        this.messageQueue = [];
        this.state.messagesQueued = 0;

        return messages;
    }

    startHeartbeat() {
        this.clearHeartbeatTimer();

        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);

        this.log(`Heartbeat started (${this.config.heartbeatInterval}ms interval)`);
    }

    sendHeartbeat() {
        const now = Date.now();
        this.state.lastHeartbeat = now;

        const heartbeatMessage = {
            type: 'PING',
            id: this.generateHeartbeatId(),
            sessionId: this.state.sessionId,
            timestamp: now
        };

        this.log('Heartbeat sent');
        return heartbeatMessage;
    }

    handleHeartbeatResponse(message) {
        if (message.type === 'PONG') {
            const latency = Date.now() - (message.timestamp || 0);
            this.log(`Heartbeat response received (latency: ${latency}ms)`);
        }
    }

    scheduleReconnection() {
        this.state.reconnectAttempts++;
        this.setState('reconnecting');

        const delay = Math.min(
            this.config.reconnectBaseDelay * Math.pow(2, this.state.reconnectAttempts - 1),
            this.config.maxReconnectDelay
        );

        this.log(`Scheduling reconnection attempt ${this.state.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.log(`Attempting reconnection ${this.state.reconnectAttempts}`);
            this.setState('connecting');
            return { shouldReconnect: true };
        }, delay);
    }

    isHeartbeatOverdue() {
        if (this.state.status !== 'connected' || this.state.lastHeartbeat === 0) {
            return false;
        }

        const timeSinceLastHeartbeat = Date.now() - this.state.lastHeartbeat;
        const overdueThreshold = this.config.heartbeatInterval * 2.5; // 2.5x interval

        return timeSinceLastHeartbeat > overdueThreshold;
    }

    getStats() {
        // Count queued message types
        const queuedMessageTypes = {};
        this.messageQueue.forEach(item => {
            const type = item.message.type;
            queuedMessageTypes[type] = (queuedMessageTypes[type] || 0) + 1;
        });

        return {
            ...this.state,
            uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
            queuedMessageTypes
        };
    }

    clearTimers() {
        this.clearHeartbeatTimer();
        this.clearReconnectTimer();
    }

    clearHeartbeatTimer() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    setState(status) {
        const previousStatus = this.state.status;
        this.state.status = status;

        if (previousStatus !== status) {
            this.log(`State changed: ${previousStatus} → ${status}`);
        }
    }

    generateHeartbeatId() {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `hb_${timestamp}_${random}`;
    }

    log(message) {
        if (this.config.debug) {
            console.log(`[ConnectionManager] ${message}`);
        }
    }

    getHealthStatus() {
        if (this.state.status === 'connected') {
            if (this.isHeartbeatOverdue()) {
                return 'warning';
            }
            return 'healthy';
        }

        if (this.state.status === 'reconnecting' && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
            return 'warning';
        }

        return 'critical';
    }
}

// Import the TypeScript message handler (requires ts-node or compilation)
// For now, we'll implement the core message handling in JavaScript
class MessageHandler {
    constructor(config = {}) {
        this.config = {
            sessionId: null,
            uplinkKey: null,
            clientId: null,
            debug: false,
            ...config
        };
        this.messageCounter = 0;
        this.lastHeartbeat = 0;
        this.messageQueue = [];
    }

    generateMessageId() {
        this.messageCounter++;
        const timestamp = Date.now().toString(36);
        const counter = this.messageCounter.toString(36).padStart(3, '0');
        const random = Math.random().toString(36).substr(2, 5);
        return `msg_${timestamp}_${counter}_${random}`;
    }

    parseMessage(data) {
        try {
            if (typeof data === 'string') {
                const parsed = JSON.parse(data);
                return {
                    valid: this.validateMessage(parsed),
                    message: parsed,
                    binary: false,
                    size: data.length
                };
            }

            if (Buffer.isBuffer(data)) {
                try {
                    const jsonStr = data.toString('utf8');
                    const parsed = JSON.parse(jsonStr);
                    return {
                        valid: this.validateMessage(parsed),
                        message: parsed,
                        binary: false,
                        size: data.length
                    };
                } catch (e) {
                    return {
                        valid: false,
                        binary: true,
                        size: data.length,
                        error: 'Binary data detected'
                    };
                }
            }

            return { valid: false, error: 'Unsupported data type' };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    validateMessage(message) {
        if (!message || typeof message !== 'object') return false;
        if (typeof message.type !== 'string') return false;
        return true;
    }

    serializeMessage(message) {
        const serializedMessage = {
            ...message,
            id: message.id || this.generateMessageId(),
            timestamp: message.timestamp || Date.now()
        };

        if (this.config.sessionId && !serializedMessage.sessionId) {
            serializedMessage.sessionId = this.config.sessionId;
        }

        return JSON.stringify(serializedMessage);
    }

    createHeartbeatMessage() {
        this.lastHeartbeat = Date.now();
        return {
            type: 'PING',
            id: this.generateMessageId(),
            sessionId: this.config.sessionId,
            timestamp: this.lastHeartbeat
        };
    }

    shouldSendHeartbeat() {
        const now = Date.now();
        const heartbeatInterval = 30000; // 30 seconds
        return (now - this.lastHeartbeat) >= heartbeatInterval;
    }

    extractSessionFromCookie(cookieHeader) {
        if (!cookieHeader) return null;
        const sessionMatch = cookieHeader.match(/anvil-session=([^;]+)/);
        if (sessionMatch) {
            const sessionData = decodeURIComponent(sessionMatch[1]);
            return sessionData.split('%3D')[0];
        }
        return null;
    }

    createErrorMessage(requestId, error, errorType = 'ClientError') {
        return {
            type: 'ERROR',
            id: this.generateMessageId(),
            sessionId: this.config.sessionId,
            payload: {
                requestId,
                error: {
                    type: errorType,
                    message: error
                }
            },
            timestamp: Date.now()
        };
    }
}

class AnvilWebSocketBridge {
    constructor(config = {}) {
        this.config = {
            port: config.port || 3001,
            anvilServerUrl: config.anvilServerUrl || 'ws://localhost:3030/_/uplink',
            debug: config.debug || process.env.NODE_ENV === 'development',
            ...config
        };

        // Initialize session manager
        this.sessionManager = new AnvilSessionManager({
            cookieName: 'anvil-session',
            debug: this.config.debug
        });

        // Initialize authentication manager
        this.authManager = new AnvilAuthManager({
            debug: this.config.debug,
            validateTokenFormat: true
        });

        this.server = null;
        this.wss = null;
        this.clients = new Map(); // client -> anvil connection mapping
        this.anvilConnections = new Map(); // anvil -> client mapping
        this.messageLog = [];
        this.stats = {
            totalConnections: 0,
            activeConnections: 0,
            messagesProxied: 0,
            errors: 0
        };
    }

    start() {
        // Create HTTP server for WebSocket upgrade
        this.server = http.createServer();

        // Create WebSocket server
        this.wss = new WebSocket.Server({
            server: this.server,
            path: '/',
            perMessageDeflate: false
        });

        this.wss.on('connection', (clientWs, request) => {
            this.handleClientConnection(clientWs, request);
        });

        this.server.listen(this.config.port, () => {
            console.log(`🚀 Anvil WebSocket Bridge listening on port ${this.config.port}`);
            console.log(`📡 Proxying to Anvil server: ${this.config.anvilServerUrl}`);
            console.log(`🔗 Client connections via: ws://localhost:${this.config.port}/`);
        });

        // Graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down WebSocket bridge...');
            this.stop();
        });
    }

    async handleClientConnection(clientWs, request) {
        const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.stats.totalConnections++;
        this.stats.activeConnections++;

        console.log(`👤 Client connected: ${clientId} from ${request.socket.remoteAddress}`);

        // Extract session info from headers/cookies
        const cookieHeader = request.headers.cookie;
        const sessionId = this.extractSessionFromHeaders(request);

        // Create message handler for this client
        const messageHandler = new MessageHandler({
            sessionId,
            clientId,
            debug: process.env.NODE_ENV === 'development'
        });

        // Create connection manager for this client
        const connectionManager = new ConnectionManager({
            heartbeatInterval: 30000,
            maxReconnectAttempts: 5,
            debug: process.env.NODE_ENV === 'development'
        });

        try {
            // Get cached authentication tokens for header injection
            const cachedTokens = this.authManager.getCachedTokens(sessionId);
            const authHeaders = cachedTokens ? this.authManager.createAuthHeaders(cachedTokens) : {};

            // Create connection to Anvil server with auth headers
            const anvilWs = new WebSocket(this.config.anvilServerUrl, {
                headers: authHeaders
            });

            // Store connection mapping with message handler and connection manager
            this.clients.set(clientWs, { anvilWs, clientId, messageHandler, connectionManager });
            this.anvilConnections.set(anvilWs, { clientWs, clientId, messageHandler, connectionManager });

            // Start connection manager
            connectionManager.start();

            // Handle Anvil connection events
            anvilWs.on('open', () => {
                console.log(`📡 Anvil connection established for client: ${clientId}`);
                this.logMessage(clientId, 'connection', 'Anvil server connected');

                // Notify connection manager of successful connection
                connectionManager.onConnectionEstablished(sessionId);

                // Set up heartbeat callback to send through Anvil connection
                connectionManager.onMessage = (heartbeatMessage) => {
                    if (anvilWs.readyState === WebSocket.OPEN) {
                        const serialized = messageHandler.serializeMessage(heartbeatMessage);
                        anvilWs.send(serialized);
                        this.logMessage(clientId, 'heartbeat→anvil', heartbeatMessage);
                    }
                };

                // Process any queued messages
                const queuedMessages = connectionManager.processMessageQueue();
                if (queuedMessages && queuedMessages.length > 0) {
                    console.log(`📤 Sending ${queuedMessages.length} queued messages for ${clientId}`);
                    queuedMessages.forEach(queuedMsg => {
                        if (anvilWs.readyState === WebSocket.OPEN) {
                            const serialized = messageHandler.serializeMessage(queuedMsg.message);
                            anvilWs.send(serialized);
                        }
                    });
                }
            });

            anvilWs.on('message', (data) => {
                try {
                    // Parse and validate message from Anvil
                    const parsedResult = messageHandler.parseMessage(data);

                    if (parsedResult.valid && parsedResult.message) {
                        // Process and forward valid message
                        if (clientWs.readyState === WebSocket.OPEN) {
                            clientWs.send(data); // Send original data to maintain compatibility
                            this.stats.messagesProxied++;

                            // Log parsed message for debugging  
                            this.logMessage(clientId, 'anvil→client', parsedResult.message);

                            // Handle special message types
                            this.handleSpecialMessage(clientId, parsedResult.message, 'from_anvil');

                            // Handle heartbeat responses
                            if (parsedResult.message.type === 'PONG') {
                                connectionManager.handleHeartbeatResponse(parsedResult.message);
                            }
                        }
                    } else if (parsedResult.error && !parsedResult.binary) {
                        console.warn(`⚠️ Invalid message from Anvil for ${clientId}:`, parsedResult.error);
                        if (parsedResult.binary) {
                            // Forward binary data as-is for now
                            if (clientWs.readyState === WebSocket.OPEN) {
                                clientWs.send(data);
                                this.stats.messagesProxied++;
                                this.logMessage(clientId, 'anvil→client', { type: 'binary', size: parsedResult.size });
                            }
                        }
                    }
                } catch (error) {
                    console.error(`❌ Error processing Anvil→Client message for ${clientId}:`, error);
                    this.stats.errors++;
                }
            });

            anvilWs.on('close', (code, reason) => {
                console.log(`📡 Anvil connection closed for client ${clientId}: ${code} ${reason}`);
                this.logMessage(clientId, 'connection', `Anvil disconnected: ${code} ${reason}`);

                // Notify connection manager of disconnection
                connectionManager.onConnectionLost(`Anvil closed: ${code} ${reason}`);

                // Close client connection if Anvil disconnects
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.close(1001, 'Anvil server disconnected');
                }
            });

            anvilWs.on('error', (error) => {
                console.error(`❌ Anvil connection error for client ${clientId}:`, error);
                this.stats.errors++;
                this.logMessage(clientId, 'error', `Anvil error: ${error.message}`);

                // Close client connection on Anvil error
                if (clientWs.readyState === WebSocket.OPEN) {
                    clientWs.close(1011, 'Anvil server error');
                }
            });

            // Handle client events
            clientWs.on('message', (data) => {
                try {
                    // Parse and validate message from client
                    const parsedResult = messageHandler.parseMessage(data);

                    if (parsedResult.valid && parsedResult.message) {
                        // Process valid message before forwarding
                        const processedMessage = this.processClientMessage(parsedResult.message, messageHandler);

                        if (anvilWs.readyState === WebSocket.OPEN) {
                            const serializedMessage = messageHandler.serializeMessage(processedMessage);
                            anvilWs.send(serializedMessage);
                            this.stats.messagesProxied++;

                            // Log processed message for debugging
                            this.logMessage(clientId, 'client→anvil', processedMessage);

                            // Handle special message types
                            this.handleSpecialMessage(clientId, processedMessage, 'to_anvil');
                        } else {
                            console.warn(`⚠️ Cannot forward message, Anvil not connected for client ${clientId}`);
                            // Queue message for retry when connection is restored
                            connectionManager.queueMessage(processedMessage, 'normal');
                            console.log(`📥 Message queued for retry: ${processedMessage.type}`);
                        }
                    } else {
                        console.warn(`⚠️ Invalid message from client ${clientId}:`, parsedResult.error);
                        // Send error response to client
                        const errorMessage = {
                            type: 'ERROR',
                            id: messageHandler.generateMessageId(),
                            payload: {
                                requestId: parsedResult.message?.id || 'unknown',
                                error: {
                                    type: 'ClientError',
                                    message: parsedResult.error || 'Invalid message format'
                                }
                            },
                            timestamp: Date.now()
                        };
                        clientWs.send(messageHandler.serializeMessage(errorMessage));
                    }
                } catch (error) {
                    console.error(`❌ Error processing Client→Anvil message for ${clientId}:`, error);
                    this.stats.errors++;
                }
            });

            clientWs.on('close', (code, reason) => {
                console.log(`👤 Client disconnected: ${clientId}: ${code} ${reason}`);
                this.stats.activeConnections--;
                this.logMessage(clientId, 'connection', `Client disconnected: ${code} ${reason}`);

                // Stop connection manager
                connectionManager.stop();

                // Clean up connections
                this.clients.delete(clientWs);
                this.anvilConnections.delete(anvilWs);

                // Close Anvil connection
                if (anvilWs.readyState === WebSocket.OPEN) {
                    anvilWs.close();
                }
            });

            clientWs.on('error', (error) => {
                console.error(`❌ Client connection error for ${clientId}:`, error);
                this.stats.errors++;
                this.logMessage(clientId, 'error', `Client error: ${error.message}`);
            });

        } catch (error) {
            console.error(`❌ Failed to establish Anvil connection for client ${clientId}:`, error);
            this.stats.errors++;
            clientWs.close(1011, 'Failed to connect to Anvil server');
        }
    }

    logMessage(clientId, direction, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            clientId,
            direction,
            data: this.sanitizeLogData(data)
        };

        this.messageLog.push(logEntry);

        // Keep only last 1000 messages to prevent memory issues
        if (this.messageLog.length > 1000) {
            this.messageLog = this.messageLog.slice(-1000);
        }

        // Detailed logging for development
        if (process.env.NODE_ENV === 'development') {
            console.log(`📝 [${clientId}] ${direction}:`, this.formatLogData(data));
        }
    }

    sanitizeLogData(data) {
        if (Buffer.isBuffer(data)) {
            try {
                const parsed = JSON.parse(data.toString());
                return { type: 'json', content: parsed };
            } catch (e) {
                return { type: 'binary', size: data.length };
            }
        }

        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                return { type: 'json', content: parsed };
            } catch (e) {
                return { type: 'text', content: data.slice(0, 200) }; // Truncate long text
            }
        }

        return { type: 'unknown', content: String(data).slice(0, 100) };
    }

    formatLogData(data) {
        const sanitized = this.sanitizeLogData(data);
        if (sanitized.type === 'json') {
            return JSON.stringify(sanitized.content, null, 2);
        }
        return sanitized.content;
    }

    getStatus() {
        return {
            server: {
                running: this.server?.listening || false,
                port: this.config.port,
                anvilServerUrl: this.config.anvilServerUrl
            },
            connections: {
                active: this.stats.activeConnections,
                total: this.stats.totalConnections
            },
            sessions: this.sessionManager.getStats(),
            authentication: this.authManager.getAuthStats(),
            stats: this.stats,
            recentMessages: this.messageLog.slice(-10) // Last 10 messages
        };
    }

    stop() {
        if (this.wss) {
            // Close all client connections
            this.wss.clients.forEach(ws => {
                ws.close(1001, 'Server shutting down');
            });
            this.wss.close();
        }

        if (this.server) {
            this.server.close();
        }

        console.log('✅ WebSocket bridge stopped');
        process.exit(0);
    }

    // Helper method to extract session from request headers
    extractSessionFromHeaders(request) {
        const cookieHeader = request.headers.cookie;
        const url = request.url;

        // Parse URL parameters for session token
        const urlParams = url ? new URLSearchParams(url.split('?')[1] || '') : null;

        // Extract authentication using auth manager
        const authResult = this.authManager.extractAuthFromRequest(cookieHeader, urlParams, request.headers);

        if (authResult.tokens && authResult.sessionToken) {
            // Cache authentication tokens
            this.authManager.cacheTokens(authResult.sessionToken, authResult.tokens);

            // Also cache in session manager for backward compatibility
            const sessionData = this.sessionManager.parseSessionFromCookies(cookieHeader);
            if (sessionData) {
                this.sessionManager.cacheSession(sessionData);
            }

            console.log(`🔐 Auth extracted: ${authResult.sessionToken} from [${authResult.sources.join(', ')}]`);
            console.log(`   Uplink key: ${authResult.tokens.uplinkKey ? '***present***' : 'none'}`);
        }

        return authResult.sessionToken;
    }

    // Process client messages before forwarding to Anvil
    processClientMessage(message, messageHandler) {
        // Ensure message has proper structure
        const processedMessage = {
            ...message,
            id: message.id || messageHandler.generateMessageId(),
            timestamp: message.timestamp || Date.now()
        };

        // Add session info if available
        if (messageHandler.config.sessionId && !processedMessage.sessionId) {
            processedMessage.sessionId = messageHandler.config.sessionId;
        }

        return processedMessage;
    }

    // Handle special message types for protocol compliance
    handleSpecialMessage(clientId, message, direction) {
        if (!message || !message.type) return;

        switch (message.type) {
            case 'PING':
                if (direction === 'from_anvil') {
                    console.log(`💓 Heartbeat received from Anvil for ${clientId}`);
                }
                break;

            case 'PONG':
                if (direction === 'to_anvil') {
                    console.log(`💓 Heartbeat sent to Anvil for ${clientId}`);
                }
                break;

            case 'SESSION_INIT':
                console.log(`🔐 Session initialization for ${clientId}`);
                break;

            case 'AUTH':
                console.log(`🔑 Authentication message for ${clientId}`);
                break;

            case 'ERROR':
                console.error(`🚨 Error message for ${clientId}:`, message.payload?.error);
                break;

            case 'CALL':
                if (this.config.debug) {
                    console.log(`📞 Server call for ${clientId}:`, message.payload?.function);
                }
                break;

            case 'RESPONSE':
                if (this.config.debug) {
                    console.log(`📋 Server response for ${clientId}`);
                }
                break;

            default:
                if (this.config.debug) {
                    console.log(`📝 Message type '${message.type}' for ${clientId}`);
                }
        }
    }
}

// Start server if run directly
if (require.main === module) {
    const config = {
        port: process.env.WS_BRIDGE_PORT || 3001,
        anvilServerUrl: process.env.ANVIL_WEBSOCKET_URL || 'ws://localhost:3030/_/uplink'
    };

    console.log('🌉 Starting Anvil WebSocket Bridge...');
    console.log('📋 Configuration:', config);

    const bridge = new AnvilWebSocketBridge(config);
    bridge.start();
}

module.exports = AnvilWebSocketBridge; 