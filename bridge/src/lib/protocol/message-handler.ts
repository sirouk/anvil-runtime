/**
 * Anvil Message Handler
 * 
 * Handles message parsing, validation, serialization, and binary data support
 * for the Anvil WebSocket protocol.
 */

import { AnvilMessage } from '@/types/anvil-protocol';

export interface ParsedMessage {
    valid: boolean;
    message?: AnvilMessage;
    binary?: boolean;
    binaryData?: Buffer;
    size: number;
    error?: string;
    chunked?: boolean;
    chunkInfo?: ChunkInfo;
}

export interface ChunkInfo {
    messageId: string;
    chunkIndex: number;
    totalChunks: number;
    isComplete: boolean;
}

export interface BinaryMessage extends AnvilMessage {
    type: 'BINARY_DATA' | 'CHUNKED_DATA';
    payload: {
        contentType: string;
        encoding: 'base64' | 'raw';
        data?: string; // base64 encoded for single message
        chunkData?: string; // base64 encoded for chunked message
        size: number;
        messageId?: string; // for chunked transfers
        chunkIndex?: number;
        totalChunks?: number;
        metadata?: Record<string, any>;
    };
}

export class AnvilMessageHandler {
    private chunkBuffers: Map<string, {
        chunks: Map<number, Buffer>;
        totalChunks: number;
        contentType: string;
        metadata?: Record<string, any>;
        timestamp: number;
    }> = new Map();

    private readonly config: {
        maxMessageSize: number;
        maxChunkSize: number;
        chunkTimeout: number;
        supportBinary: boolean;
        debug: boolean;
    };

    constructor(config?: Partial<typeof AnvilMessageHandler.prototype.config>) {
        this.config = {
            maxMessageSize: 100 * 1024 * 1024, // 100MB max message size
            maxChunkSize: 1 * 1024 * 1024, // 1MB max chunk size
            chunkTimeout: 60000, // 60 seconds timeout for chunked transfers
            supportBinary: true,
            debug: false,
            ...config
        };

        // Clean up stale chunks periodically
        setInterval(() => this.cleanupStaleChunks(), 30000);
    }

    /**
     * Parse incoming WebSocket message data (supports both text and binary)
     */
    parseMessage(data: Buffer | string): ParsedMessage {
        try {
            // Handle string data (JSON messages)
            if (typeof data === 'string') {
                const parsed = JSON.parse(data);

                // Check if it's a chunked binary message
                if (parsed.type === 'CHUNKED_DATA') {
                    return this.handleChunkedMessage(parsed);
                }

                return {
                    valid: this.validateMessage(parsed),
                    message: parsed,
                    binary: false,
                    size: data.length
                };
            }

            // Handle Buffer data
            if (Buffer.isBuffer(data)) {
                // Try to parse as JSON first
                try {
                    const jsonStr = data.toString('utf8');
                    const parsed = JSON.parse(jsonStr);

                    // Check if it's a chunked binary message
                    if (parsed.type === 'CHUNKED_DATA') {
                        return this.handleChunkedMessage(parsed);
                    }

                    return {
                        valid: this.validateMessage(parsed),
                        message: parsed,
                        binary: false,
                        size: data.length
                    };
                } catch (e) {
                    // It's actual binary data
                    if (this.config.supportBinary) {
                        return this.handleBinaryData(data);
                    } else {
                        return {
                            valid: false,
                            binary: true,
                            size: data.length,
                            error: 'Binary data not supported'
                        };
                    }
                }
            }

            return {
                valid: false,
                size: 0,
                error: 'Unsupported data type'
            };

        } catch (error) {
            return {
                valid: false,
                size: data instanceof Buffer ? data.length : data.length,
                error: error instanceof Error ? error.message : 'Parse error'
            };
        }
    }

    /**
     * Handle raw binary data by converting to Anvil's binary message format
     */
    private handleBinaryData(data: Buffer): ParsedMessage {
        if (data.length > this.config.maxMessageSize) {
            return {
                valid: false,
                binary: true,
                size: data.length,
                error: `Binary data size ${data.length} exceeds max ${this.config.maxMessageSize}`
            };
        }

        // For large binary data, we should chunk it
        if (data.length > this.config.maxChunkSize) {
            // Return info that this needs to be chunked
            return {
                valid: true,
                binary: true,
                binaryData: data,
                size: data.length,
                chunked: true
            };
        }

        // Convert to Anvil binary message format
        const binaryMessage: BinaryMessage = {
            type: 'BINARY_DATA',
            payload: {
                contentType: 'application/octet-stream',
                encoding: 'base64',
                data: data.toString('base64'),
                size: data.length
            },
            timestamp: Date.now()
        };

        return {
            valid: true,
            message: binaryMessage,
            binary: true,
            size: data.length
        };
    }

    /**
     * Handle chunked binary messages
     */
    private handleChunkedMessage(message: BinaryMessage): ParsedMessage {
        const { messageId, chunkIndex, totalChunks, chunkData } = message.payload;

        if (!messageId || chunkIndex === undefined || !totalChunks || !chunkData) {
            return {
                valid: false,
                size: 0,
                error: 'Invalid chunked message format'
            };
        }

        // Initialize chunk buffer if needed
        if (!this.chunkBuffers.has(messageId)) {
            this.chunkBuffers.set(messageId, {
                chunks: new Map(),
                totalChunks,
                contentType: message.payload.contentType,
                metadata: message.payload.metadata,
                timestamp: Date.now()
            });
        }

        const chunkBuffer = this.chunkBuffers.get(messageId)!;

        // Store chunk
        const chunkDataBuffer = Buffer.from(chunkData, 'base64');
        chunkBuffer.chunks.set(chunkIndex, chunkDataBuffer);

        if (this.config.debug) {
            console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for message ${messageId}`);
        }

        // Check if all chunks received
        if (chunkBuffer.chunks.size === totalChunks) {
            // Verify we have all sequential chunks
            let hasAllChunks = true;
            for (let i = 0; i < totalChunks; i++) {
                if (!chunkBuffer.chunks.has(i)) {
                    hasAllChunks = false;
                    break;
                }
            }

            if (!hasAllChunks) {
                // Missing chunks detected
                return {
                    valid: true,
                    size: chunkDataBuffer.length,
                    chunked: true,
                    chunkInfo: {
                        messageId,
                        chunkIndex,
                        totalChunks,
                        isComplete: false
                    }
                };
            }

            // Reassemble complete message
            const completeData = this.reassembleChunks(messageId);

            if (completeData) {
                // Clean up
                this.chunkBuffers.delete(messageId);

                // Return complete binary message
                const completeBinaryMessage: BinaryMessage = {
                    type: 'BINARY_DATA',
                    payload: {
                        contentType: chunkBuffer.contentType,
                        encoding: 'base64',
                        data: completeData.toString('base64'),
                        size: completeData.length,
                        metadata: chunkBuffer.metadata
                    },
                    timestamp: Date.now()
                };

                return {
                    valid: true,
                    message: completeBinaryMessage,
                    binary: true,
                    size: completeData.length,
                    chunked: true,
                    chunkInfo: {
                        messageId,
                        chunkIndex,
                        totalChunks,
                        isComplete: true
                    }
                };
            }
        }

        // Not complete yet
        return {
            valid: true,
            size: chunkDataBuffer.length,
            chunked: true,
            chunkInfo: {
                messageId,
                chunkIndex,
                totalChunks,
                isComplete: false
            }
        };
    }

    /**
     * Reassemble chunks into complete buffer
     */
    private reassembleChunks(messageId: string): Buffer | null {
        const chunkBuffer = this.chunkBuffers.get(messageId);
        if (!chunkBuffer) return null;

        const chunks: Buffer[] = [];
        for (let i = 0; i < chunkBuffer.totalChunks; i++) {
            const chunk = chunkBuffer.chunks.get(i);
            if (!chunk) {
                console.error(`Missing chunk ${i} for message ${messageId}`);
                return null;
            }
            chunks.push(chunk);
        }

        return Buffer.concat(chunks);
    }

    /**
     * Clean up stale chunk buffers
     */
    private cleanupStaleChunks(): void {
        const now = Date.now();
        const staleIds: string[] = [];

        this.chunkBuffers.forEach((buffer, messageId) => {
            if (now - buffer.timestamp > this.config.chunkTimeout) {
                staleIds.push(messageId);
            }
        });

        staleIds.forEach(id => {
            if (this.config.debug) {
                console.log(`🗑️ Cleaning up stale chunks for message ${id}`);
            }
            this.chunkBuffers.delete(id);
        });
    }

    /**
     * Validate message structure
     */
    validateMessage(message: any): boolean {
        if (!message || typeof message !== 'object') {
            return false;
        }

        // Must have type field
        if (!message.type || typeof message.type !== 'string') {
            return false;
        }

        // Timestamp is optional but if present must be number
        if (message.timestamp !== undefined && typeof message.timestamp !== 'number') {
            return false;
        }

        return true;
    }

    /**
     * Serialize message for sending (with binary support)
     */
    serializeMessage(message: AnvilMessage | BinaryMessage): string | Buffer {
        // If it's a binary message with raw data, handle specially
        if (message.type === 'BINARY_DATA' && message.payload &&
            'data' in message.payload && message.payload.encoding === 'raw') {
            // Return raw binary buffer
            return Buffer.from(message.payload.data, 'base64');
        }

        // Regular JSON serialization
        return JSON.stringify(message);
    }

    /**
     * Create chunks from large binary data
     */
    createChunks(data: Buffer, contentType: string = 'application/octet-stream', metadata?: Record<string, any>): BinaryMessage[] {
        const messageId = this.generateMessageId();
        const totalChunks = Math.ceil(data.length / this.config.maxChunkSize);
        const chunks: BinaryMessage[] = [];

        if (this.config.debug) {
            console.log(`📦 Creating ${totalChunks} chunks for ${data.length} bytes of data`);
        }

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.config.maxChunkSize;
            const end = Math.min((i + 1) * this.config.maxChunkSize, data.length);
            const chunkData = data.slice(start, end);

            const chunkMessage: BinaryMessage = {
                type: 'CHUNKED_DATA',
                payload: {
                    contentType,
                    encoding: 'base64',
                    chunkData: chunkData.toString('base64'),
                    size: chunkData.length,
                    messageId,
                    chunkIndex: i,
                    totalChunks,
                    metadata
                },
                timestamp: Date.now()
            };

            chunks.push(chunkMessage);
        }

        return chunks;
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Convert file to binary message format
     */
    fileToBinaryMessage(file: {
        name: string;
        type: string;
        data: Buffer | ArrayBuffer;
    }): BinaryMessage | BinaryMessage[] {
        const buffer = Buffer.isBuffer(file.data)
            ? file.data
            : Buffer.from(file.data);

        const metadata = {
            filename: file.name,
            mimeType: file.type,
            uploadedAt: new Date().toISOString()
        };

        // Check if chunking is needed
        if (buffer.length > this.config.maxChunkSize) {
            return this.createChunks(buffer, file.type, metadata);
        }

        // Single message
        return {
            type: 'BINARY_DATA',
            payload: {
                contentType: file.type,
                encoding: 'base64',
                data: buffer.toString('base64'),
                size: buffer.length,
                metadata
            },
            timestamp: Date.now()
        };
    }

    /**
     * Extract binary data from message
     */
    extractBinaryData(message: BinaryMessage): Buffer | null {
        if (message.type === 'BINARY_DATA' && message.payload.data) {
            try {
                return Buffer.from(message.payload.data,
                    message.payload.encoding === 'base64' ? 'base64' : 'utf8'
                );
            } catch (error) {
                console.error('Failed to extract binary data:', error);
                return null;
            }
        }
        return null;
    }
}

// Export singleton instance for convenience
export const globalMessageHandler = new AnvilMessageHandler({
    debug: process.env.NODE_ENV === 'development'
}); 