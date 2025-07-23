/**
 * WebSocket proxy for communicating with Anvil server
 * Handles bidirectional message relay between NextJS client and Anvil uplink
 * with full binary data and chunked transfer support
 */

import WebSocket from 'ws';
import { AnvilMessage, AnvilSession } from '@/types/anvil-protocol';
import { globalMessageHandler, BinaryMessage } from './message-handler';

export interface WebSocketProxyConfig {
    anvilServerUrl: string;
    anvilServerPort: number;
    heartbeatInterval?: number;
    maxRetries?: number;
    retryDelay?: number;
    supportBinary?: boolean;
    debug?: boolean;
}

export class WebSocketProxy {
    private config: WebSocketProxyConfig;
    private anvilConnection: WebSocket | null = null;
    private clientConnections: Set<WebSocket> = new Set();
    private session: AnvilSession | null = null;
    private heartbeatTimer: NodeJS.Timeout | null = null;
    private retryCount = 0;
    private chunkQueues: Map<WebSocket, BinaryMessage[]> = new Map();

    constructor(config: WebSocketProxyConfig) {
        this.config = {
            heartbeatInterval: 30000, // 30 seconds
            maxRetries: 5,
            retryDelay: 2000, // 2 seconds
            supportBinary: true,
            debug: false,
            ...config,
        };
    }

    /**
     * Connect to Anvil server
     */
    async connectToAnvil(): Promise<void> {
        const url = `ws://${this.config.anvilServerUrl}:${this.config.anvilServerPort}/_/uplink`;

        return new Promise((resolve, reject) => {
            try {
                this.anvilConnection = new WebSocket(url);

                // Enable binary data support
                this.anvilConnection.binaryType = 'nodebuffer';

                this.anvilConnection.on('open', () => {
                    console.log('Connected to Anvil server:', url);
                    this.retryCount = 0;
                    this.startHeartbeat();
                    resolve();
                });

                this.anvilConnection.on('message', (data: WebSocket.RawData) => {
                    this.handleAnvilMessage(data);
                });

                this.anvilConnection.on('close', (code: number, reason: Buffer) => {
                    console.log('Anvil connection closed:', code, reason.toString());
                    this.stopHeartbeat();
                    this.attemptReconnect();
                });

                this.anvilConnection.on('error', (error: Error) => {
                    console.error('Anvil connection error:', error);
                    reject(error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Add a client connection
     */
    addClient(clientWs: WebSocket): void {
        this.clientConnections.add(clientWs);

        // Enable binary data support
        clientWs.binaryType = 'nodebuffer';

        clientWs.on('message', (data: WebSocket.RawData) => {
            this.handleClientMessage(data, clientWs);
        });

        clientWs.on('close', () => {
            this.clientConnections.delete(clientWs);
            this.chunkQueues.delete(clientWs);
        });

        clientWs.on('error', (error: Error) => {
            console.error('Client connection error:', error);
            this.clientConnections.delete(clientWs);
            this.chunkQueues.delete(clientWs);
        });
    }

    /**
     * Handle message from Anvil server and relay to clients
     */
    private handleAnvilMessage(data: WebSocket.RawData): void {
        try {
            // Convert RawData to Buffer or string
            const messageData = this.normalizeRawData(data);
            const parseResult = globalMessageHandler.parseMessage(messageData);

            if (!parseResult.valid && !parseResult.chunked) {
                console.error('Invalid message from Anvil:', parseResult.error);
                return;
            }

            // Handle chunked messages
            if (parseResult.chunked && parseResult.chunkInfo) {
                if (this.config.debug) {
                    console.log(`📦 Received chunk ${parseResult.chunkInfo.chunkIndex + 1}/${parseResult.chunkInfo.totalChunks}`);
                }

                // If chunk is complete, parseResult will have the complete message
                if (parseResult.chunkInfo.isComplete && parseResult.message) {
                    this.processAnvilMessage(parseResult.message);
                }
                // Otherwise, chunk is being accumulated by message handler
                return;
            }

            // Handle regular messages
            if (parseResult.message) {
                this.processAnvilMessage(parseResult.message);
            }

        } catch (error) {
            console.error('Error handling Anvil message:', error);
        }
    }

    /**
     * Process a complete message from Anvil
     */
    private processAnvilMessage(message: AnvilMessage): void {
        // Update session if this is an auth response
        if (message.type === 'AUTH' && message.payload?.sessionToken) {
            this.session = {
                sessionToken: message.payload.sessionToken,
                uplinkKey: message.payload.uplinkKey,
                userId: message.payload.userId,
                authenticated: true,
            };
        }

        // Relay to all connected clients
        this.clientConnections.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    // Serialize message (handles both JSON and binary)
                    const serialized = globalMessageHandler.serializeMessage(message);
                    client.send(serialized);

                    if (this.config.debug && message.type === 'BINARY_DATA') {
                        console.log(`📤 Sent binary data to client: ${message.payload?.size} bytes`);
                    }
                } catch (error) {
                    console.error('Error sending to client:', error);
                }
            }
        });
    }

    /**
     * Handle message from client and relay to Anvil server
     */
    private handleClientMessage(data: WebSocket.RawData, client: WebSocket): void {
        try {
            const messageData = this.normalizeRawData(data);
            const parseResult = globalMessageHandler.parseMessage(messageData);

            if (!parseResult.valid && !parseResult.binary && !parseResult.chunked) {
                console.error('Invalid message from client:', parseResult.error);
                return;
            }

            // Handle raw binary data that needs chunking
            if (parseResult.binary && parseResult.chunked && parseResult.binaryData) {
                if (this.config.debug) {
                    console.log(`📦 Creating chunks for ${parseResult.size} bytes of binary data`);
                }

                const chunks = globalMessageHandler.createChunks(parseResult.binaryData);
                this.sendChunkedMessage(chunks, client);
                return;
            }

            // Handle chunked messages
            if (parseResult.chunked && parseResult.chunkInfo) {
                // Forward chunk to Anvil
                if (this.anvilConnection && this.anvilConnection.readyState === WebSocket.OPEN) {
                    this.anvilConnection.send(messageData);
                }
                return;
            }

            // Handle regular messages
            if (parseResult.message) {
                this.processClientMessage(parseResult.message, client);
            }

        } catch (error) {
            console.error('Error handling client message:', error);
        }
    }

    /**
     * Process a complete message from client
     */
    private processClientMessage(message: AnvilMessage, client: WebSocket): void {
        // Inject session info if available
        if (this.session && message.type !== 'AUTH') {
            message.sessionId = this.session.sessionToken;
        }

        // Forward to Anvil server
        if (this.anvilConnection && this.anvilConnection.readyState === WebSocket.OPEN) {
            try {
                const serialized = globalMessageHandler.serializeMessage(message);
                this.anvilConnection.send(serialized);

                if (this.config.debug && message.type === 'BINARY_DATA') {
                    console.log(`📤 Sent binary data to Anvil: ${message.payload?.size} bytes`);
                }
            } catch (error) {
                console.error('Error sending to Anvil:', error);

                // Send error back to client
                const errorMessage: AnvilMessage = {
                    type: 'ERROR',
                    payload: { error: 'Failed to forward message to Anvil server' },
                    timestamp: Date.now()
                };
                client.send(JSON.stringify(errorMessage));
            }
        } else {
            // Send error back to client if no Anvil connection
            const errorMessage: AnvilMessage = {
                type: 'ERROR',
                payload: { error: 'No connection to Anvil server' },
                timestamp: Date.now()
            };
            client.send(JSON.stringify(errorMessage));
        }
    }

    /**
     * Send chunked message
     */
    private sendChunkedMessage(chunks: BinaryMessage[], client: WebSocket): void {
        // Queue chunks for this client
        if (!this.chunkQueues.has(client)) {
            this.chunkQueues.set(client, []);
        }

        const queue = this.chunkQueues.get(client)!;
        queue.push(...chunks);

        // Process queue
        this.processChunkQueue(client);
    }

    /**
     * Process queued chunks for a client
     */
    private processChunkQueue(client: WebSocket): void {
        const queue = this.chunkQueues.get(client);
        if (!queue || queue.length === 0) return;

        // Send chunks in order
        while (queue.length > 0 && this.anvilConnection?.readyState === WebSocket.OPEN) {
            const chunk = queue.shift()!;
            try {
                const serialized = globalMessageHandler.serializeMessage(chunk);
                this.anvilConnection.send(serialized);

                if (this.config.debug) {
                    console.log(`📤 Sent chunk ${chunk.payload.chunkIndex! + 1}/${chunk.payload.totalChunks}`);
                }
            } catch (error) {
                console.error('Error sending chunk:', error);
                // Re-queue chunk for retry
                queue.unshift(chunk);
                break;
            }
        }
    }

    /**
     * Normalize WebSocket RawData to Buffer or string
     */
    private normalizeRawData(data: WebSocket.RawData): Buffer | string {
        if (typeof data === 'string') {
            return data;
        } else if (Buffer.isBuffer(data)) {
            return data;
        } else if (data instanceof ArrayBuffer) {
            return Buffer.from(data);
        } else if (data instanceof Array) {
            // Array of Buffers
            return Buffer.concat(data);
        } else {
            // For any other type, try to convert to string
            return String(data);
        }
    }

    /**
     * Start heartbeat to Anvil server
     */
    private startHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
        }

        this.heartbeatTimer = setInterval(() => {
            if (this.anvilConnection && this.anvilConnection.readyState === WebSocket.OPEN) {
                const ping: AnvilMessage = {
                    type: 'PING',
                    timestamp: Date.now(),
                };
                this.anvilConnection.send(JSON.stringify(ping));
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Stop heartbeat timer
     */
    private stopHeartbeat(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Attempt to reconnect to Anvil server
     */
    private async attemptReconnect(): Promise<void> {
        if (this.retryCount >= this.config.maxRetries!) {
            console.error('Max reconnection attempts reached');
            return;
        }

        this.retryCount++;
        console.log(`Attempting to reconnect (${this.retryCount}/${this.config.maxRetries})...`);

        setTimeout(async () => {
            try {
                await this.connectToAnvil();
            } catch (error) {
                console.error('Reconnection failed:', error);
            }
        }, this.config.retryDelay! * this.retryCount);
    }

    /**
     * Close all connections
     */
    disconnect(): void {
        this.stopHeartbeat();

        if (this.anvilConnection) {
            this.anvilConnection.close();
            this.anvilConnection = null;
        }

        this.clientConnections.forEach(client => {
            client.close();
        });
        this.clientConnections.clear();
        this.chunkQueues.clear();
    }

    /**
     * Get current session
     */
    getSession(): AnvilSession | null {
        return this.session;
    }

    /**
     * Check if connected to Anvil server
     */
    isConnectedToAnvil(): boolean {
        return this.anvilConnection?.readyState === WebSocket.OPEN;
    }

    /**
     * Get number of connected clients
     */
    getClientCount(): number {
        return this.clientConnections.size;
    }
} 