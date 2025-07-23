/**
 * Client-side Anvil WebSocket API
 * 
 * Provides a React-friendly interface for connecting to the Anvil server
 * through the NextJS bridge proxy. This wrapper handles connection management,
 * message serialization, and provides hooks for React components.
 */

import { AnvilMessage, AnvilSession } from '@/types/anvil-protocol';
import { trafficRecorder } from './traffic-recorder';

export interface AnvilClientConfig {
    websocketUrl?: string;
    bridgeUrl?: string;
    autoReconnect?: boolean;
    reconnectDelay?: number;
    maxReconnectAttempts?: number;
    heartbeatInterval?: number;
    debug?: boolean;
    recordTraffic?: boolean;
}

export interface AnvilClientState {
    connected: boolean;
    connecting: boolean;
    error: string | null;
    session: AnvilSession | null;
    lastHeartbeat: Date | null;
    reconnectAttempts: number;
}

export type AnvilEventType =
    | 'connected'
    | 'disconnected'
    | 'message'
    | 'error'
    | 'session_established'
    | 'heartbeat';

export type AnvilEventHandler<T = any> = (data: T) => void;

export class AnvilClient {
    private config: Required<AnvilClientConfig>;
    private websocket: WebSocket | null = null;
    private state: AnvilClientState;
    private eventHandlers: Map<AnvilEventType, Set<AnvilEventHandler>> = new Map();
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private messageQueue: AnvilMessage[] = [];
    private sessionId: string | null = null;

    constructor(config: AnvilClientConfig = {}) {
        this.config = {
            websocketUrl: config.websocketUrl || process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
            bridgeUrl: config.bridgeUrl || process.env.NEXT_PUBLIC_BRIDGE_URL || 'http://localhost:3000',
            autoReconnect: config.autoReconnect ?? true,
            reconnectDelay: config.reconnectDelay || 2000,
            maxReconnectAttempts: config.maxReconnectAttempts || 5,
            heartbeatInterval: config.heartbeatInterval || 30000,
            debug: config.debug ?? false,
            recordTraffic: config.recordTraffic ?? false
        };

        this.state = {
            connected: false,
            connecting: false,
            error: null,
            session: null,
            lastHeartbeat: null,
            reconnectAttempts: 0
        };

        // Initialize event handler maps
        const eventTypes: AnvilEventType[] = ['connected', 'disconnected', 'message', 'error', 'session_established', 'heartbeat'];
        eventTypes.forEach(type => {
            this.eventHandlers.set(type, new Set());
        });

        if (this.config.debug) {
            console.log('🔌 AnvilClient initialized with config:', this.config);
        }
    }

    /**
     * Connect to the Anvil server through the bridge proxy
     */
    async connect(): Promise<void> {
        if (this.state.connected || this.state.connecting) {
            if (this.config.debug) {
                console.log('🔌 Already connected or connecting');
            }
            return;
        }

        this.updateState({ connecting: true, error: null });

        try {
            await this.establishWebSocketConnection();

            if (this.config.recordTraffic) {
                this.sessionId = `anvil_client_${Date.now()}`;
                trafficRecorder.startRecording(this.sessionId, 'bridge', {
                    userAgent: navigator.userAgent,
                    appName: 'anvil-client',
                    version: '1.0.0'
                });
            }

        } catch (error) {
            this.updateState({
                connecting: false,
                error: error instanceof Error ? error.message : 'Unknown connection error'
            });
            this.emit('error', error);

            if (this.config.autoReconnect && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
                this.scheduleReconnect();
            }

            throw error;
        }
    }

    /**
     * Disconnect from the Anvil server
     */
    disconnect(): void {
        if (this.config.debug) {
            console.log('🔌 Disconnecting from Anvil server');
        }

        this.stopHeartbeat();
        this.clearReconnectTimer();

        if (this.websocket) {
            this.websocket.close();
            this.websocket = null;
        }

        if (this.config.recordTraffic && this.sessionId) {
            trafficRecorder.stopRecording(this.sessionId);
        }

        this.updateState({
            connected: false,
            connecting: false,
            session: null,
            reconnectAttempts: 0
        });

        this.emit('disconnected');
    }

    /**
     * Send a message to the Anvil server
     */
    async sendMessage(message: Partial<AnvilMessage>): Promise<void> {
        const fullMessage: AnvilMessage = {
            type: message.type || 'UNKNOWN',
            payload: message.payload,
            timestamp: Date.now(),
            sessionId: this.state.session?.sessionToken,
            ...message
        };

        if (!this.state.connected || !this.websocket) {
            if (this.config.debug) {
                console.log('🔌 Queueing message (not connected):', fullMessage.type);
            }
            this.messageQueue.push(fullMessage);
            return;
        }

        try {
            const messageString = JSON.stringify(fullMessage);
            this.websocket.send(messageString);

            if (this.config.recordTraffic && this.sessionId) {
                trafficRecorder.recordWebSocketMessage(this.sessionId, 'client->server', fullMessage);
            }

            if (this.config.debug) {
                console.log('📤 Sent message:', fullMessage.type, fullMessage);
            }
        } catch (error) {
            console.error('❌ Failed to send message:', error);
            this.emit('error', error);
        }
    }

    /**
     * Add event listener
     */
    on<T = any>(event: AnvilEventType, handler: AnvilEventHandler<T>): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.add(handler);
        }
    }

    /**
     * Remove event listener
     */
    off<T = any>(event: AnvilEventType, handler: AnvilEventHandler<T>): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.delete(handler);
        }
    }

    /**
     * Get current connection state
     */
    getState(): AnvilClientState {
        return { ...this.state };
    }

    /**
     * Check if client is connected
     */
    isConnected(): boolean {
        return this.state.connected;
    }

    /**
     * Get current session information
     */
    getSession(): AnvilSession | null {
        return this.state.session;
    }

    /**
     * Establish WebSocket connection
     */
    private async establishWebSocketConnection(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                if (this.config.debug) {
                    console.log('🔌 Connecting to WebSocket:', this.config.websocketUrl);
                }

                this.websocket = new WebSocket(this.config.websocketUrl);

                this.websocket.onopen = () => {
                    if (this.config.debug) {
                        console.log('✅ WebSocket connected');
                    }

                    this.updateState({
                        connected: true,
                        connecting: false,
                        error: null,
                        reconnectAttempts: 0
                    });

                    this.startHeartbeat();
                    this.processMessageQueue();
                    this.emit('connected');
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.websocket.onclose = (event) => {
                    if (this.config.debug) {
                        console.log('🔌 WebSocket closed:', event.code, event.reason);
                    }

                    const wasConnected = this.state.connected;
                    this.updateState({
                        connected: false,
                        connecting: false
                    });

                    this.stopHeartbeat();

                    if (wasConnected) {
                        this.emit('disconnected');

                        if (this.config.autoReconnect && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
                            this.scheduleReconnect();
                        }
                    }
                };

                this.websocket.onerror = (error) => {
                    console.error('❌ WebSocket error:', error);

                    this.updateState({
                        connecting: false,
                        error: 'WebSocket connection error'
                    });

                    this.emit('error', error);
                    reject(new Error('WebSocket connection failed'));
                };

                // Connection timeout
                setTimeout(() => {
                    if (this.websocket && this.websocket.readyState === WebSocket.CONNECTING) {
                        this.websocket.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000); // 10 second timeout

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Handle incoming WebSocket message
     */
    private handleMessage(data: string): void {
        try {
            const message: AnvilMessage = JSON.parse(data);

            if (this.config.recordTraffic && this.sessionId) {
                trafficRecorder.recordWebSocketMessage(this.sessionId, 'server->client', message);
            }

            if (this.config.debug) {
                console.log('📥 Received message:', message.type, message);
            }

            // Handle special message types
            switch (message.type) {
                case 'AUTH':
                case 'SESSION_INIT':
                    if (message.payload?.sessionToken) {
                        this.updateState({
                            session: {
                                sessionToken: message.payload.sessionToken,
                                uplinkKey: message.payload.uplinkKey,
                                userId: message.payload.userId,
                                authenticated: true
                            }
                        });
                        this.emit('session_established', this.state.session);
                    }
                    break;

                case 'PONG':
                case 'HEARTBEAT':
                    this.updateState({ lastHeartbeat: new Date() });
                    this.emit('heartbeat', { timestamp: new Date() });
                    break;

                case 'ERROR':
                    this.emit('error', new Error(message.payload?.error || 'Server error'));
                    break;
            }

            // Emit generic message event
            this.emit('message', message);

        } catch (error) {
            console.error('❌ Failed to parse message:', error, data);
            this.emit('error', error);
        }
    }

    /**
     * Start heartbeat mechanism
     */
    private startHeartbeat(): void {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.state.connected) {
                this.sendMessage({
                    type: 'PING',
                    payload: { timestamp: Date.now() }
                });
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat mechanism
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Schedule reconnection attempt
     */
    private scheduleReconnect(): void {
        this.clearReconnectTimer();

        const delay = this.config.reconnectDelay * Math.pow(2, this.state.reconnectAttempts);

        if (this.config.debug) {
            console.log(`🔄 Scheduling reconnect in ${delay}ms (attempt ${this.state.reconnectAttempts + 1})`);
        }

        this.reconnectTimer = setTimeout(() => {
            this.updateState({ reconnectAttempts: this.state.reconnectAttempts + 1 });
            this.connect().catch(error => {
                console.error('❌ Reconnect failed:', error);
            });
        }, delay);
    }

    /**
     * Clear reconnection timer
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    /**
     * Process queued messages
     */
    private processMessageQueue(): void {
        while (this.messageQueue.length > 0 && this.state.connected) {
            const message = this.messageQueue.shift();
            if (message) {
                this.sendMessage(message);
            }
        }
    }

    /**
     * Update internal state and trigger state change events
     */
    private updateState(updates: Partial<AnvilClientState>): void {
        this.state = { ...this.state, ...updates };
    }

    /**
     * Emit event to all registered handlers
     */
    private emit<T = any>(event: AnvilEventType, data?: T): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`❌ Error in ${event} handler:`, error);
                }
            });
        }
    }
}

// React hooks for AnvilClient
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * React hook for using AnvilClient
 */
export function useAnvilClient(config?: AnvilClientConfig): {
    client: AnvilClient;
    state: AnvilClientState;
    connect: () => Promise<void>;
    disconnect: () => void;
    sendMessage: (message: Partial<AnvilMessage>) => Promise<void>;
    isConnected: boolean;
} {
    const clientRef = useRef<AnvilClient | null>(null);
    const [state, setState] = useState<AnvilClientState>({
        connected: false,
        connecting: false,
        error: null,
        session: null,
        lastHeartbeat: null,
        reconnectAttempts: 0
    });

    // Initialize client
    if (!clientRef.current) {
        clientRef.current = new AnvilClient(config);
    }

    const client = clientRef.current;

    // Set up event listeners
    useEffect(() => {
        const updateState = () => setState(client.getState());

        client.on('connected', updateState);
        client.on('disconnected', updateState);
        client.on('error', updateState);
        client.on('session_established', updateState);

        // Initial state
        updateState();

        return () => {
            client.off('connected', updateState);
            client.off('disconnected', updateState);
            client.off('error', updateState);
            client.off('session_established', updateState);
        };
    }, [client]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (clientRef.current) {
                clientRef.current.disconnect();
            }
        };
    }, []);

    const connect = useCallback(() => client.connect(), [client]);
    const disconnect = useCallback(() => client.disconnect(), [client]);
    const sendMessage = useCallback((message: Partial<AnvilMessage>) => client.sendMessage(message), [client]);

    return {
        client,
        state,
        connect,
        disconnect,
        sendMessage,
        isConnected: state.connected
    };
}

/**
 * React hook for listening to specific Anvil messages
 */
export function useAnvilMessage<T = any>(
    client: AnvilClient,
    messageType: string,
    handler: (message: AnvilMessage) => void
): void {
    useEffect(() => {
        const messageHandler = (message: AnvilMessage) => {
            if (message.type === messageType) {
                handler(message);
            }
        };

        client.on('message', messageHandler);
        return () => client.off('message', messageHandler);
    }, [client, messageType, handler]);
}

/**
 * React hook for Anvil session management
 */
export function useAnvilSession(client: AnvilClient): {
    session: AnvilSession | null;
    isAuthenticated: boolean;
    login: (credentials: any) => Promise<void>;
    logout: () => Promise<void>;
} {
    const [session, setSession] = useState<AnvilSession | null>(null);

    useEffect(() => {
        const sessionHandler = (newSession: AnvilSession) => {
            setSession(newSession);
        };

        client.on('session_established', sessionHandler);

        // Get initial session
        setSession(client.getSession());

        return () => client.off('session_established', sessionHandler);
    }, [client]);

    const login = useCallback(async (credentials: any) => {
        await client.sendMessage({
            type: 'AUTH',
            payload: credentials
        });
    }, [client]);

    const logout = useCallback(async () => {
        await client.sendMessage({
            type: 'LOGOUT',
            payload: {}
        });
        setSession(null);
    }, [client]);

    return {
        session,
        isAuthenticated: !!session?.authenticated,
        login,
        logout
    };
}

// Global client instance for app-wide usage
let globalAnvilClient: AnvilClient | null = null;

/**
 * Get or create global AnvilClient instance
 */
export function getGlobalAnvilClient(config?: AnvilClientConfig): AnvilClient {
    if (!globalAnvilClient) {
        globalAnvilClient = new AnvilClient({
            debug: process.env.NODE_ENV === 'development',
            recordTraffic: process.env.NODE_ENV === 'development',
            ...config
        });
    }
    return globalAnvilClient;
}

/**
 * Cleanup global client (useful for testing)
 */
export function resetGlobalAnvilClient(): void {
    if (globalAnvilClient) {
        globalAnvilClient.disconnect();
        globalAnvilClient = null;
    }
} 