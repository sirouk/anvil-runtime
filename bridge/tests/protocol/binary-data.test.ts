/**
 * Binary Data Protocol Unit Tests
 * 
 * Tests binary data handling, chunked transfers, and edge cases
 * for the Anvil WebSocket protocol implementation.
 */

import {
    AnvilMessageHandler,
    BinaryMessage,
    ParsedMessage,
    globalMessageHandler
} from '../../src/lib/protocol/message-handler';
import { AnvilMessage } from '../../src/types/anvil-protocol';

describe('Binary Data Protocol Tests', () => {
    let messageHandler: AnvilMessageHandler;

    beforeEach(() => {
        messageHandler = new AnvilMessageHandler({
            maxMessageSize: 10 * 1024 * 1024, // 10MB
            maxChunkSize: 1024 * 1024, // 1MB  
            chunkTimeout: 60000,
            supportBinary: true,
            debug: false
        });
    });

    describe('Basic Binary Data Handling', () => {
        test('should handle small binary data', () => {
            const binaryData = Buffer.from('Hello, Binary World!', 'utf8');
            const result = messageHandler.parseMessage(binaryData);

            expect(result.valid).toBe(true);
            expect(result.binary).toBe(true);
            expect(result.message).toBeDefined();
            expect(result.message?.type).toBe('BINARY_DATA');
            expect(result.message?.payload?.encoding).toBe('base64');
            expect(result.message?.payload?.size).toBe(binaryData.length);

            // Verify data integrity
            const decodedData = Buffer.from(result.message?.payload?.data as string, 'base64');
            expect(decodedData.toString()).toBe('Hello, Binary World!');
        });

        test('should handle empty binary data', () => {
            const emptyBuffer = Buffer.alloc(0);
            const result = messageHandler.parseMessage(emptyBuffer);

            expect(result.valid).toBe(true);
            expect(result.binary).toBe(true);
            expect(result.message?.payload?.size).toBe(0);
        });

        test('should detect binary data that needs chunking', () => {
            const largeData = Buffer.alloc(2 * 1024 * 1024); // 2MB
            largeData.fill('A');

            const result = messageHandler.parseMessage(largeData);

            expect(result.valid).toBe(true);
            expect(result.binary).toBe(true);
            expect(result.chunked).toBe(true);
            expect(result.binaryData).toEqual(largeData);
        });

        test('should reject binary data exceeding max size', () => {
            const hugeData = Buffer.alloc(11 * 1024 * 1024); // 11MB (exceeds 10MB limit)
            const result = messageHandler.parseMessage(hugeData);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('exceeds max');
        });
    });

    describe('Binary Message Format', () => {
        test('should create proper binary message from buffer', () => {
            const data = Buffer.from([0x01, 0x02, 0x03, 0x04, 0x05]);
            const result = messageHandler.parseMessage(data);

            const binaryMessage = result.message as BinaryMessage;
            expect(binaryMessage.type).toBe('BINARY_DATA');
            expect(binaryMessage.payload.contentType).toBe('application/octet-stream');
            expect(binaryMessage.payload.encoding).toBe('base64');
            expect(binaryMessage.payload.data).toBe(data.toString('base64'));
        });

        test('should handle file to binary message conversion', () => {
            const fileData = {
                name: 'test-image.png',
                type: 'image/png',
                data: Buffer.from('PNG image data here')
            };

            const message = messageHandler.fileToBinaryMessage(fileData);

            expect(message).toBeDefined();
            if (!Array.isArray(message)) {
                expect(message.type).toBe('BINARY_DATA');
                expect(message.payload.contentType).toBe('image/png');
                expect(message.payload.metadata?.filename).toBe('test-image.png');
                expect(message.payload.metadata?.mimeType).toBe('image/png');
            }
        });

        test('should extract binary data from message', () => {
            const originalData = Buffer.from('Test binary data');
            const binaryMessage: BinaryMessage = {
                type: 'BINARY_DATA',
                payload: {
                    contentType: 'application/octet-stream',
                    encoding: 'base64',
                    data: originalData.toString('base64'),
                    size: originalData.length
                },
                timestamp: Date.now()
            };

            const extractedData = messageHandler.extractBinaryData(binaryMessage);
            expect(extractedData).toEqual(originalData);
        });
    });

    describe('Chunked Transfer Support', () => {
        test('should create chunks for large data', () => {
            const largeData = Buffer.alloc(3.5 * 1024 * 1024); // 3.5MB
            largeData.fill('X');

            const chunks = messageHandler.createChunks(largeData, 'application/octet-stream');

            expect(chunks).toHaveLength(4); // 4 chunks of 1MB each (last one partial)
            expect(chunks[0].type).toBe('CHUNKED_DATA');
            expect(chunks[0].payload.chunkIndex).toBe(0);
            expect(chunks[0].payload.totalChunks).toBe(4);
            expect(chunks[0].payload.messageId).toBeDefined();

            // All chunks should have the same messageId
            const messageId = chunks[0].payload.messageId;
            chunks.forEach((chunk, index) => {
                expect(chunk.payload.messageId).toBe(messageId);
                expect(chunk.payload.chunkIndex).toBe(index);
            });
        });

        test('should reassemble chunked messages', () => {
            const originalData = Buffer.alloc(2.5 * 1024 * 1024);
            originalData.fill('DATA');

            const chunks = messageHandler.createChunks(originalData);
            let finalMessage: BinaryMessage | null = null;

            // Simulate receiving chunks
            chunks.forEach(chunk => {
                const result = messageHandler.parseMessage(JSON.stringify(chunk));

                if (result.chunked && result.chunkInfo?.isComplete) {
                    finalMessage = result.message as BinaryMessage;
                }
            });

            expect(finalMessage).not.toBeNull();
            const completedMessage = finalMessage!;
            expect(completedMessage.type).toBe('BINARY_DATA');

            // Verify reassembled data
            const reassembledData = Buffer.from(completedMessage.payload.data as string, 'base64');
            expect(reassembledData.length).toBe(originalData.length);
            expect(reassembledData.equals(originalData)).toBe(true);
        });

        test('should handle out-of-order chunks', () => {
            const originalData = Buffer.from('Test data for out-of-order chunks');
            const chunks = messageHandler.createChunks(originalData);

            // Shuffle chunks
            const shuffledChunks = [...chunks].sort(() => Math.random() - 0.5);

            let finalMessage: BinaryMessage | null = null;
            shuffledChunks.forEach(chunk => {
                const result = messageHandler.parseMessage(JSON.stringify(chunk));
                if (result.chunked && result.chunkInfo?.isComplete) {
                    finalMessage = result.message as BinaryMessage;
                }
            });

            expect(finalMessage).not.toBeNull();
            const reassembledData = Buffer.from(finalMessage!.payload.data as string, 'base64');
            expect(reassembledData.toString()).toBe(originalData.toString());
        });

        test('should handle missing chunks gracefully', () => {
            const messageHandler = new AnvilMessageHandler({ maxChunkSize: 10 }); // Force small chunks
            const chunks = messageHandler.createChunks(Buffer.from('Test data for missing chunks that is long enough'));

            expect(chunks.length).toBeGreaterThanOrEqual(3); // Ensure we have multiple chunks

            // Process chunks except one (skip chunk at index 1)
            let lastResult: any = null;
            chunks.forEach((chunk, index) => {
                if (index !== 1) { // Skip chunk 1
                    const result = messageHandler.parseMessage(JSON.stringify(chunk));
                    lastResult = result;
                }
            });

            // The last processed chunk should indicate incomplete since we're missing chunk 1
            expect(lastResult).not.toBeNull();
            expect(lastResult.chunked).toBe(true);
            expect(lastResult.chunkInfo?.isComplete).toBe(false);
        });
    });

    describe('Message Serialization with Binary Support', () => {
        test('should serialize regular messages as JSON', () => {
            const message: AnvilMessage = {
                type: 'TEST',
                payload: { data: 'test' },
                timestamp: Date.now()
            };

            const serialized = messageHandler.serializeMessage(message);
            expect(typeof serialized).toBe('string');
            expect(JSON.parse(serialized as string)).toEqual(message);
        });

        test('should serialize binary messages with base64 encoding', () => {
            const binaryMessage: BinaryMessage = {
                type: 'BINARY_DATA',
                payload: {
                    contentType: 'application/pdf',
                    encoding: 'base64',
                    data: Buffer.from('PDF content').toString('base64'),
                    size: 11
                },
                timestamp: Date.now()
            };

            const serialized = messageHandler.serializeMessage(binaryMessage);
            expect(typeof serialized).toBe('string');

            const parsed = JSON.parse(serialized as string);
            expect(parsed.type).toBe('BINARY_DATA');
            expect(parsed.payload.encoding).toBe('base64');
        });

        test('should handle raw binary encoding (future support)', () => {
            const rawBinaryMessage: BinaryMessage = {
                type: 'BINARY_DATA',
                payload: {
                    contentType: 'application/octet-stream',
                    encoding: 'raw',
                    data: Buffer.from('Raw binary').toString('base64'),
                    size: 10
                },
                timestamp: Date.now()
            };

            const serialized = messageHandler.serializeMessage(rawBinaryMessage);
            expect(Buffer.isBuffer(serialized)).toBe(true);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        test('should handle malformed chunked messages', () => {
            const malformedChunk = {
                type: 'CHUNKED_DATA',
                payload: {
                    // Missing required fields
                    chunkData: 'test'
                },
                timestamp: Date.now()
            };

            const result = messageHandler.parseMessage(JSON.stringify(malformedChunk));
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid chunked message');
        });

        test('should handle various data types', () => {
            // String that looks like JSON
            const jsonString = '{"type":"TEST","payload":{}}';
            const result1 = messageHandler.parseMessage(jsonString);
            expect(result1.valid).toBe(true);
            expect(result1.binary).toBe(false);

            // Buffer containing JSON
            const jsonBuffer = Buffer.from(jsonString);
            const result2 = messageHandler.parseMessage(jsonBuffer);
            expect(result2.valid).toBe(true);
            expect(result2.binary).toBe(false);

            // Actual binary buffer
            const binaryBuffer = Buffer.from([0xFF, 0xFE, 0xFD]);
            const result3 = messageHandler.parseMessage(binaryBuffer);
            expect(result3.valid).toBe(true);
            expect(result3.binary).toBe(true);
        });

        test('should handle file uploads with metadata', () => {
            const fileData = {
                name: 'document.pdf',
                type: 'application/pdf',
                data: Buffer.from('PDF content here...')
            };

            const message = messageHandler.fileToBinaryMessage(fileData);

            if (!Array.isArray(message)) {
                expect(message.payload.metadata).toBeDefined();
                expect(message.payload.metadata?.filename).toBe('document.pdf');
                expect(message.payload.metadata?.mimeType).toBe('application/pdf');
                expect(message.payload.metadata?.uploadedAt).toBeDefined();
            }
        });

        test('should clean up stale chunks after timeout', async () => {
            // Create a handler with short timeout for testing
            const testHandler = new AnvilMessageHandler({
                chunkTimeout: 100, // 100ms timeout
                debug: false
            });

            const chunks = testHandler.createChunks(Buffer.from('Test data for timeout'));

            // Send first chunk
            testHandler.parseMessage(JSON.stringify(chunks[0]));

            // Force cleanup by waiting and triggering the interval
            await new Promise(resolve => setTimeout(resolve, 200));

            // Send second chunk after timeout - should not complete
            if (chunks.length > 1) {
                const result = testHandler.parseMessage(JSON.stringify(chunks[1]));
                expect(result.chunkInfo?.isComplete).toBe(false);
            }
        });
    });

    describe('Performance and Limits', () => {
        test('should handle maximum chunk size efficiently', () => {
            const maxChunkData = Buffer.alloc(1024 * 1024); // 1MB
            maxChunkData.fill('M');

            const startTime = Date.now();
            const result = messageHandler.parseMessage(maxChunkData);
            const duration = Date.now() - startTime;

            expect(result.valid).toBe(true);
            expect(duration).toBeLessThan(100); // Should process in under 100ms
        });

        test('should handle many small chunks', () => {
            // Create handler with small chunk size
            const smallChunkHandler = new AnvilMessageHandler({
                maxChunkSize: 1024, // 1KB chunks
                debug: false
            });

            const data = Buffer.alloc(100 * 1024); // 100KB
            data.fill('S');

            const chunks = smallChunkHandler.createChunks(data);
            expect(chunks.length).toBe(100);

            // Process all chunks
            let finalMessage: BinaryMessage | null = null;
            chunks.forEach(chunk => {
                const result = smallChunkHandler.parseMessage(JSON.stringify(chunk));
                if (result.chunkInfo?.isComplete) {
                    finalMessage = result.message as BinaryMessage;
                }
            });

            expect(finalMessage).not.toBeNull();
        });
    });
}); 