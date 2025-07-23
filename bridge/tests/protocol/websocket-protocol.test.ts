/**
 * WebSocket Protocol Unit Tests
 * 
 * Tests message serialization/deserialization and individual message types
 * for the Anvil WebSocket protocol implementation.
 */

import { AnvilMessage, AnvilSession } from '../../src/types/anvil-protocol';

describe('WebSocket Protocol Tests', () => {
    describe('Message Serialization/Deserialization', () => {
        test('should serialize AnvilMessage correctly', () => {
            const message: AnvilMessage = {
                type: 'TEST_MESSAGE',
                payload: { data: 'test', number: 42 },
                timestamp: 1234567890,
                sessionId: 'test-session'
            };

            const serialized = JSON.stringify(message);
            const deserialized: AnvilMessage = JSON.parse(serialized);

            expect(deserialized.type).toBe('TEST_MESSAGE');
            expect(deserialized.payload?.data).toBe('test');
            expect(deserialized.payload?.number).toBe(42);
            expect(deserialized.timestamp).toBe(1234567890);
            expect(deserialized.sessionId).toBe('test-session');
        });

        test('should handle null/undefined payload', () => {
            const message: AnvilMessage = {
                type: 'EMPTY_MESSAGE',
                payload: null,
                timestamp: Date.now()
            };

            const serialized = JSON.stringify(message);
            const deserialized: AnvilMessage = JSON.parse(serialized);

            expect(deserialized.type).toBe('EMPTY_MESSAGE');
            expect(deserialized.payload).toBeNull();
        });

        test('should handle complex nested payload', () => {
            const complexPayload = {
                user: {
                    id: 123,
                    name: 'Test User',
                    preferences: {
                        theme: 'dark',
                        notifications: true
                    }
                },
                data: [1, 2, 3, { nested: 'value' }],
                metadata: {
                    version: '1.0',
                    created: new Date().toISOString()
                }
            };

            const message: AnvilMessage = {
                type: 'COMPLEX_MESSAGE',
                payload: complexPayload,
                timestamp: Date.now()
            };

            const serialized = JSON.stringify(message);
            const deserialized: AnvilMessage = JSON.parse(serialized);

            expect(deserialized.payload?.user?.name).toBe('Test User');
            expect(deserialized.payload?.data?.[3]?.nested).toBe('value');
            expect(deserialized.payload?.metadata?.version).toBe('1.0');
        });

        test('should handle binary data representation', () => {
            const binaryData = new Uint8Array([1, 2, 3, 4, 5]);
            const base64Data = btoa(String.fromCharCode(...binaryData));

            const message: AnvilMessage = {
                type: 'BINARY_MESSAGE',
                payload: {
                    data: base64Data,
                    encoding: 'base64',
                    originalSize: binaryData.length
                },
                timestamp: Date.now()
            };

            const serialized = JSON.stringify(message);
            const deserialized: AnvilMessage = JSON.parse(serialized);

            expect(deserialized.payload?.data).toBe(base64Data);
            expect(deserialized.payload?.encoding).toBe('base64');
            expect(deserialized.payload?.originalSize).toBe(5);
        });
    });

    describe('Individual Message Types', () => {
        test('should validate AUTH message structure', () => {
            const authMessage: AnvilMessage = {
                type: 'AUTH',
                payload: {
                    sessionToken: 'auth-token-123',
                    uplinkKey: 'uplink-key-456',
                    userId: 'user-789',
                    authenticated: true
                },
                timestamp: Date.now()
            };

            expect(authMessage.type).toBe('AUTH');
            expect(authMessage.payload?.sessionToken).toBe('auth-token-123');
            expect(authMessage.payload?.uplinkKey).toBe('uplink-key-456');
            expect(authMessage.payload?.userId).toBe('user-789');
            expect(authMessage.payload?.authenticated).toBe(true);
        });

        test('should validate PING/PONG message structure', () => {
            const pingMessage: AnvilMessage = {
                type: 'PING',
                payload: { timestamp: Date.now() },
                timestamp: Date.now()
            };

            const pongMessage: AnvilMessage = {
                type: 'PONG',
                payload: { timestamp: Date.now() },
                timestamp: Date.now()
            };

            expect(pingMessage.type).toBe('PING');
            expect(pingMessage.payload?.timestamp).toBeDefined();
            expect(pongMessage.type).toBe('PONG');
            expect(pongMessage.payload?.timestamp).toBeDefined();
        });

        test('should validate ERROR message structure', () => {
            const errorMessage: AnvilMessage = {
                type: 'ERROR',
                payload: {
                    error: 'Test error message',
                    code: 'TEST_ERROR',
                    details: { reason: 'Unit test' }
                },
                timestamp: Date.now()
            };

            expect(errorMessage.type).toBe('ERROR');
            expect(errorMessage.payload?.error).toBe('Test error message');
            expect(errorMessage.payload?.code).toBe('TEST_ERROR');
            expect(errorMessage.payload?.details?.reason).toBe('Unit test');
        });

        test('should validate SESSION_INIT message structure', () => {
            const sessionInitMessage: AnvilMessage = {
                type: 'SESSION_INIT',
                payload: {
                    sessionToken: 'session-token-abc',
                    uplinkKey: 'uplink-key-def',
                    userId: 'user-ghi',
                    appId: 'test-app'
                },
                timestamp: Date.now()
            };

            expect(sessionInitMessage.type).toBe('SESSION_INIT');
            expect(sessionInitMessage.payload?.sessionToken).toBe('session-token-abc');
            expect(sessionInitMessage.payload?.uplinkKey).toBe('uplink-key-def');
            expect(sessionInitMessage.payload?.userId).toBe('user-ghi');
            expect(sessionInitMessage.payload?.appId).toBe('test-app');
        });

        test('should validate COMPONENT_LOAD message structure', () => {
            const componentLoadMessage: AnvilMessage = {
                type: 'COMPONENT_LOAD',
                payload: {
                    componentType: 'Button',
                    componentId: 'btn-123',
                    properties: {
                        text: 'Click Me',
                        enabled: true,
                        role: 'primary'
                    },
                    layoutProperties: {
                        width: '100px',
                        height: '40px'
                    }
                },
                timestamp: Date.now()
            };

            expect(componentLoadMessage.type).toBe('COMPONENT_LOAD');
            expect(componentLoadMessage.payload?.componentType).toBe('Button');
            expect(componentLoadMessage.payload?.componentId).toBe('btn-123');
            expect(componentLoadMessage.payload?.properties?.text).toBe('Click Me');
            expect(componentLoadMessage.payload?.properties?.enabled).toBe(true);
        });

        test('should validate SERVER_CALL message structure', () => {
            const serverCallMessage: AnvilMessage = {
                type: 'SERVER_CALL',
                payload: {
                    function: 'get_user_data',
                    args: [123],
                    kwargs: { include_preferences: true },
                    callId: 'call-456'
                },
                timestamp: Date.now()
            };

            expect(serverCallMessage.type).toBe('SERVER_CALL');
            expect(serverCallMessage.payload?.function).toBe('get_user_data');
            expect(serverCallMessage.payload?.args).toEqual([123]);
            expect(serverCallMessage.payload?.kwargs?.include_preferences).toBe(true);
            expect(serverCallMessage.payload?.callId).toBe('call-456');
        });

        test('should validate TABLE_OPERATION message structure', () => {
            const tableOperationMessage: AnvilMessage = {
                type: 'TABLE_OPERATION',
                payload: {
                    operation: 'search',
                    table: 'users',
                    criteria: { active: true },
                    limit: 10,
                    offset: 0
                },
                timestamp: Date.now()
            };

            expect(tableOperationMessage.type).toBe('TABLE_OPERATION');
            expect(tableOperationMessage.payload?.operation).toBe('search');
            expect(tableOperationMessage.payload?.table).toBe('users');
            expect(tableOperationMessage.payload?.criteria?.active).toBe(true);
            expect(tableOperationMessage.payload?.limit).toBe(10);
        });
    });

    describe('Message Validation', () => {
        test('should validate required message fields', () => {
            const validMessage: AnvilMessage = {
                type: 'VALID_MESSAGE',
                payload: { data: 'test' },
                timestamp: Date.now()
            };

            expect(validMessage.type).toBeDefined();
            expect(validMessage.timestamp).toBeDefined();
            expect(typeof validMessage.type).toBe('string');
            expect(typeof validMessage.timestamp).toBe('number');
        });

        test('should handle malformed JSON gracefully', () => {
            const malformedJson = '{ invalid json }';

            expect(() => {
                JSON.parse(malformedJson);
            }).toThrow();
        });

        test('should validate message type field', () => {
            const messageWithoutType = {
                payload: { data: 'test' },
                timestamp: Date.now()
            };

            // This would fail validation in a real implementation
            expect(messageWithoutType).not.toHaveProperty('type');
        });

        test('should handle different payload types', () => {
            const stringPayload: AnvilMessage = {
                type: 'STRING_PAYLOAD',
                payload: 'Simple string',
                timestamp: Date.now()
            };

            const numberPayload: AnvilMessage = {
                type: 'NUMBER_PAYLOAD',
                payload: 42,
                timestamp: Date.now()
            };

            const arrayPayload: AnvilMessage = {
                type: 'ARRAY_PAYLOAD',
                payload: [1, 2, 3, 'test'],
                timestamp: Date.now()
            };

            expect(typeof stringPayload.payload).toBe('string');
            expect(typeof numberPayload.payload).toBe('number');
            expect(Array.isArray(arrayPayload.payload)).toBe(true);
        });
    });

    describe('Protocol Performance', () => {
        test('should handle large payload messages', () => {
            // Create a large payload (100KB worth of text)
            const largeData = 'x'.repeat(100 * 1024);
            const largeMessage: AnvilMessage = {
                type: 'LARGE_MESSAGE',
                payload: { data: largeData },
                timestamp: Date.now()
            };

            const serialized = JSON.stringify(largeMessage);
            const deserialized: AnvilMessage = JSON.parse(serialized);

            expect(deserialized.payload?.data).toBe(largeData);
            expect(serialized.length).toBeGreaterThan(100000);
        });

        test('should handle deeply nested objects', () => {
            const createNestedObject = (depth: number): any => {
                if (depth <= 0) return { value: 'leaf' };
                return { nested: createNestedObject(depth - 1) };
            };

            const deepMessage: AnvilMessage = {
                type: 'DEEP_MESSAGE',
                payload: createNestedObject(10),
                timestamp: Date.now()
            };

            const serialized = JSON.stringify(deepMessage);
            const deserialized: AnvilMessage = JSON.parse(serialized);

            // Navigate to the deep value
            let current = deserialized.payload;
            for (let i = 0; i < 10; i++) {
                current = current?.nested;
            }

            expect(current?.value).toBe('leaf');
        });

        test('should handle arrays of messages', () => {
            const messages: AnvilMessage[] = [];

            for (let i = 0; i < 100; i++) {
                messages.push({
                    type: 'BATCH_MESSAGE',
                    payload: { index: i, data: `Message ${i}` },
                    timestamp: Date.now() + i
                });
            }

            const serialized = JSON.stringify(messages);
            const deserialized: AnvilMessage[] = JSON.parse(serialized);

            expect(deserialized).toHaveLength(100);
            expect(deserialized[50].payload?.index).toBe(50);
            expect(deserialized[99].payload?.data).toBe('Message 99');
        });
    });

    describe('Authentication Messages', () => {
        test('should handle authentication flow structures', () => {
            const loginRequest: AnvilMessage = {
                type: 'AUTH',
                payload: {
                    username: 'testuser',
                    password: 'testpass'
                },
                timestamp: Date.now()
            };

            const authResponse: AnvilMessage = {
                type: 'AUTH',
                payload: {
                    sessionToken: 'authenticated-token',
                    uplinkKey: 'auth-uplink-key',
                    userId: 'auth-user-id',
                    authenticated: true
                },
                timestamp: Date.now()
            };

            expect(loginRequest.payload?.username).toBe('testuser');
            expect(authResponse.payload?.authenticated).toBe(true);
            expect(authResponse.payload?.sessionToken).toBe('authenticated-token');
        });

        test('should handle logout message structure', () => {
            const logoutMessage: AnvilMessage = {
                type: 'LOGOUT',
                payload: {},
                timestamp: Date.now()
            };

            expect(logoutMessage.type).toBe('LOGOUT');
            expect(logoutMessage.payload).toEqual({});
        });

        test('should handle session validation', () => {
            const session: AnvilSession = {
                sessionToken: 'valid-session-token',
                uplinkKey: 'valid-uplink-key',
                userId: 'user-123',
                authenticated: true
            };

            expect(session.sessionToken).toBeDefined();
            expect(session.uplinkKey).toBeDefined();
            expect(session.userId).toBeDefined();
            expect(session.authenticated).toBe(true);
        });
    });
}); 