/**
 * WebSocket Fallback to HTTP Polling
 * 
 * Provides automatic fallback from WebSocket to HTTP polling when
 * WebSocket connections fail, ensuring reliable real-time communication.
 */

import { globalErrorMonitor } from './error-monitor';
import { createRetryHandler, RetryStrategies } from './retry-handler';
import { globalCircuitBreakerManager } from './circuit-breaker';

export interface FallbackConfig {
    maxWebSocketAttempts: number; // Max attempts before falling back to polling
    pollingInterval: number; // Polling interval in milliseconds
    maxPollingInterval: number; // Maximum polling interval with backoff
    pollingBackoffMultiplier: number; // Backoff multiplier for polling
    webSocketRetryDelay: number; // Delay before retrying WebSocket
    healthCheckInterval: number; // Interval to check if WebSocket can be restored
    debug: boolean;
}

export interface ConnectionStats {
    connectionType: 'websocket' | 'polling' | 'disconnected';
    isConnected: boolean;
    webSocketAttempts: number;
    pollingInterval: number;
    lastWebSocketAttempt?: Date;
    lastSuccessfulMessage?: Date;
    totalMessages: number;
    failedMessages: number;
    connectionUptime: number;
}

export interface FallbackEvent {
    type: 'websocket_connected' | 'websocket_failed' | 'fallback_to_polling' | 'polling_started' | 'websocket_restored' | 'connection_lost';
    timestamp: Date;
    details?: any;
}

export type MessageHandler = (data: any) => void;
export type ErrorHandler = (error: Error) => void;
export type ConnectionHandler = (event: FallbackEvent) => void;

export class WebSocketFallback {
    private config: FallbackConfig;
    private websocket?: WebSocket;
    private pollingInterval?: NodeJS.Timeout;
    private healthCheckInterval?: NodeJS.Timeout;
    private connectionType: 'websocket' | 'polling' | 'disconnected' = 'disconnected';
    private isConnected: boolean = false;
    private webSocketAttempts: number = 0;
    private currentPollingInterval: number;
    private connectionStartTime?: Date;
    private retryHandler = createRetryHandler('standard', {
        retryableErrors: RetryStrategies.networkErrors,
        onRetry: (attempt, error, delay) => {
            globalErrorMonitor.warn('websocket', `WebSocket retry attempt ${attempt}`, error, { delay });
        }
    });

    // Event handlers
    private messageHandlers: MessageHandler[] = [];
    private errorHandlers: ErrorHandler[] = [];
    private connectionHandlers: ConnectionHandler[] = [];

    // Stats
    private stats: ConnectionStats = {
        connectionType: 'disconnected',
        isConnected: false,
        webSocketAttempts: 0,
        pollingInterval: 0,
        totalMessages: 0,
        failedMessages: 0,
        connectionUptime: 0
    };

    private url: string;
    private pollUrl: string;
    private sendUrl: string;

    constructor(
        websocketUrl: string,
        pollUrl: string,
        sendUrl: string,
        config: Partial<FallbackConfig> = {}
    ) {
        this.url = websocketUrl;
        this.pollUrl = pollUrl;
        this.sendUrl = sendUrl;

        this.config = {
            maxWebSocketAttempts: 5,
            pollingInterval: 5000, // 5 seconds
            maxPollingInterval: 30000, // 30 seconds
            pollingBackoffMultiplier: 1.5,
            webSocketRetryDelay: 10000, // 10 seconds
            healthCheckInterval: 60000, // 1 minute
            debug: false,
            ...config
        };

        this.currentPollingInterval = this.config.pollingInterval;
    }

    /**
     * Connect using WebSocket with fallback to polling
     */
    async connect(): Promise<void> {
        this.connectionStartTime = new Date();

        try {
            await this.connectWebSocket();
        } catch (error) {
            globalErrorMonitor.warn('websocket', 'Initial WebSocket connection failed, falling back to polling', error as Error);
            this.fallbackToPolling();
        }
    }

    /**
     * Disconnect from all connections
     */
    disconnect(): void {
        this.cleanup();
        this.connectionType = 'disconnected';
        this.isConnected = false;
        this.notifyConnectionHandlers({
            type: 'connection_lost',
            timestamp: new Date()
        });
    }

    /**
     * Send a message through the active connection
     */
    async send(data: any): Promise<void> {
        if (!this.isConnected) {
            throw new Error('No active connection available');
        }

        try {
            if (this.connectionType === 'websocket' && this.websocket) {
                await this.sendViaWebSocket(data);
            } else if (this.connectionType === 'polling') {
                await this.sendViaHTTP(data);
            } else {
                throw new Error('No valid connection method available');
            }

            this.stats.totalMessages++;
            this.stats.lastSuccessfulMessage = new Date();

        } catch (error) {
            this.stats.failedMessages++;
            globalErrorMonitor.error('websocket', 'Failed to send message', error as Error, { connectionType: this.connectionType });

            // If WebSocket send fails, try to reconnect or fallback
            if (this.connectionType === 'websocket') {
                this.handleWebSocketError(error as Error);
            }

            throw error;
        }
    }

    /**
     * Add message handler
     */
    onMessage(handler: MessageHandler): void {
        this.messageHandlers.push(handler);
    }

    /**
     * Add error handler
     */
    onError(handler: ErrorHandler): void {
        this.errorHandlers.push(handler);
    }

    /**
     * Add connection event handler
     */
    onConnection(handler: ConnectionHandler): void {
        this.connectionHandlers.push(handler);
    }

    /**
     * Get current connection statistics
     */
    getStats(): ConnectionStats {
        const uptime = this.connectionStartTime
            ? Date.now() - this.connectionStartTime.getTime()
            : 0;

        return {
            ...this.stats,
            connectionType: this.connectionType,
            isConnected: this.isConnected,
            pollingInterval: this.currentPollingInterval,
            connectionUptime: uptime
        };
    }

    /**
     * Force fallback to polling (for testing)
     */
    forceFallbackToPolling(): void {
        this.cleanup();
        this.fallbackToPolling();
    }

    /**
     * Attempt to restore WebSocket connection
     */
    async attemptWebSocketRestore(): Promise<boolean> {
        if (this.connectionType === 'websocket') {
            return true; // Already on WebSocket
        }

        try {
            // Stop polling temporarily
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = undefined;
            }

            await this.connectWebSocket();
            return true;
        } catch (error) {
            globalErrorMonitor.warn('websocket', 'WebSocket restore attempt failed', error as Error);
            // Resume polling
            this.startPolling();
            return false;
        }
    }

    /**
     * Connect via WebSocket
     */
    private async connectWebSocket(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.webSocketAttempts++;
                this.stats.webSocketAttempts = this.webSocketAttempts;
                this.stats.lastWebSocketAttempt = new Date();

                this.websocket = new WebSocket(this.url);

                this.websocket.onopen = () => {
                    this.connectionType = 'websocket';
                    this.isConnected = true;
                    this.webSocketAttempts = 0; // Reset on successful connection
                    this.currentPollingInterval = this.config.pollingInterval; // Reset polling interval

                    globalErrorMonitor.info('websocket', 'WebSocket connected successfully');
                    this.notifyConnectionHandlers({
                        type: 'websocket_connected',
                        timestamp: new Date()
                    });

                    this.startHealthCheck();
                    resolve();
                };

                this.websocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        this.notifyMessageHandlers(data);
                        this.stats.totalMessages++;
                        this.stats.lastSuccessfulMessage = new Date();
                    } catch (error) {
                        globalErrorMonitor.error('websocket', 'Failed to parse WebSocket message', error as Error);
                    }
                };

                this.websocket.onerror = (error) => {
                    globalErrorMonitor.error('websocket', 'WebSocket error', new Error('WebSocket error'));
                    this.notifyErrorHandlers(new Error('WebSocket connection error'));
                };

                this.websocket.onclose = (event) => {
                    this.isConnected = false;
                    globalErrorMonitor.warn('websocket', `WebSocket closed: ${event.code} ${event.reason}`);

                    if (this.webSocketAttempts < this.config.maxWebSocketAttempts) {
                        // Try to reconnect
                        setTimeout(() => {
                            this.connectWebSocket().catch(() => {
                                if (this.webSocketAttempts >= this.config.maxWebSocketAttempts) {
                                    this.fallbackToPolling();
                                }
                            });
                        }, this.config.webSocketRetryDelay);
                    } else {
                        this.fallbackToPolling();
                    }
                };

                // Timeout for connection
                setTimeout(() => {
                    if (this.websocket?.readyState !== WebSocket.OPEN) {
                        this.websocket?.close();
                        reject(new Error('WebSocket connection timeout'));
                    }
                }, 10000); // 10 second timeout

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Fallback to HTTP polling
     */
    private fallbackToPolling(): void {
        this.cleanup();
        this.connectionType = 'polling';
        this.isConnected = true;

        globalErrorMonitor.info('websocket', `Falling back to HTTP polling (interval: ${this.currentPollingInterval}ms)`);
        this.notifyConnectionHandlers({
            type: 'fallback_to_polling',
            timestamp: new Date(),
            details: { pollingInterval: this.currentPollingInterval }
        });

        this.startPolling();
        this.startHealthCheck();
    }

    /**
     * Start HTTP polling
     */
    private startPolling(): void {
        this.pollingInterval = setInterval(async () => {
            try {
                await globalCircuitBreakerManager.execute('http_polling', async () => {
                    const response = await fetch(this.pollUrl, {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`Polling request failed: ${response.status}`);
                    }

                    const data = await response.json();
                    if (data.messages && Array.isArray(data.messages)) {
                        data.messages.forEach((message: any) => {
                            this.notifyMessageHandlers(message);
                        });
                        this.stats.totalMessages += data.messages.length;
                        this.stats.lastSuccessfulMessage = new Date();
                    }

                    // Reset polling interval on success
                    if (this.currentPollingInterval > this.config.pollingInterval) {
                        this.currentPollingInterval = this.config.pollingInterval;
                        this.restartPolling();
                    }
                });

            } catch (error) {
                this.stats.failedMessages++;
                globalErrorMonitor.error('websocket', 'Polling request failed', error as Error);

                // Increase polling interval on failure (backoff)
                this.currentPollingInterval = Math.min(
                    this.currentPollingInterval * this.config.pollingBackoffMultiplier,
                    this.config.maxPollingInterval
                );
                this.restartPolling();
            }
        }, this.currentPollingInterval);

        this.notifyConnectionHandlers({
            type: 'polling_started',
            timestamp: new Date(),
            details: { pollingInterval: this.currentPollingInterval }
        });
    }

    /**
     * Restart polling with new interval
     */
    private restartPolling(): void {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.startPolling();
        }
    }

    /**
     * Start health check to attempt WebSocket restoration
     */
    private startHealthCheck(): void {
        this.healthCheckInterval = setInterval(async () => {
            if (this.connectionType === 'polling') {
                const restored = await this.attemptWebSocketRestore();
                if (restored) {
                    this.notifyConnectionHandlers({
                        type: 'websocket_restored',
                        timestamp: new Date()
                    });
                }
            }
        }, this.config.healthCheckInterval);
    }

    /**
     * Send message via WebSocket
     */
    private async sendViaWebSocket(data: any): Promise<void> {
        return new Promise((resolve, reject) => {
            if (!this.websocket || this.websocket.readyState !== WebSocket.OPEN) {
                reject(new Error('WebSocket not connected'));
                return;
            }

            try {
                this.websocket.send(JSON.stringify(data));
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Send message via HTTP
     */
    private async sendViaHTTP(data: any): Promise<void> {
        const response = await fetch(this.sendUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP send failed: ${response.status}`);
        }
    }

    /**
     * Handle WebSocket errors
     */
    private handleWebSocketError(error: Error): void {
        this.isConnected = false;
        this.notifyErrorHandlers(error);

        if (this.webSocketAttempts >= this.config.maxWebSocketAttempts) {
            this.fallbackToPolling();
        }
    }

    /**
     * Cleanup all connections and intervals
     */
    private cleanup(): void {
        if (this.websocket) {
            this.websocket.close();
            this.websocket = undefined;
        }

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = undefined;
        }

        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = undefined;
        }
    }

    /**
     * Notify message handlers
     */
    private notifyMessageHandlers(data: any): void {
        this.messageHandlers.forEach(handler => {
            try {
                handler(data);
            } catch (error) {
                globalErrorMonitor.error('websocket', 'Message handler error', error as Error);
            }
        });
    }

    /**
     * Notify error handlers
     */
    private notifyErrorHandlers(error: Error): void {
        this.errorHandlers.forEach(handler => {
            try {
                handler(error);
            } catch (handlerError) {
                globalErrorMonitor.error('websocket', 'Error handler error', handlerError as Error);
            }
        });
    }

    /**
     * Notify connection handlers
     */
    private notifyConnectionHandlers(event: FallbackEvent): void {
        this.connectionHandlers.forEach(handler => {
            try {
                handler(event);
            } catch (error) {
                globalErrorMonitor.error('websocket', 'Connection handler error', error as Error);
            }
        });
    }
} 