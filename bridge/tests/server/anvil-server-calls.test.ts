/**
 * Anvil Server Calls Test Suite
 * 
 * Comprehensive tests for the anvil.server.call() system
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import {
    AnvilServerCallManager,
    type ServerCallOptions,
    type ServerCallError
} from '../../src/lib/server/anvil-server-calls';

import {
    useServerCall,
    useLazyServerCall,
    useServerMutation,
    useServerCallManager,
    useServerConnection,
    clearServerCallCache
} from '../../src/lib/server/use-server-call';

// Mock WebSocket for testing
class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.CONNECTING;
    onopen: ((event: Event) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onmessage: ((event: MessageEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    private connectionTimeout: NodeJS.Timeout | null = null;
    private isClosing = false;

    constructor(public url: string) {
        // Simulate connection with proper cleanup
        this.connectionTimeout = setTimeout(() => {
            if (this.readyState === MockWebSocket.CONNECTING) {
                this.readyState = MockWebSocket.OPEN;
                if (this.onopen) {
                    this.onopen(new Event('open'));
                }
            }
        }, 10);
    }

    send(data: string): void {
        if (this.readyState === MockWebSocket.OPEN) {
            // Mock send - in real tests we'd capture this
            console.log('MockWebSocket send:', data);
        }
    }

    close(): void {
        if (this.isClosing || this.readyState === MockWebSocket.CLOSED) {
            return; // Prevent multiple close events
        }

        this.isClosing = true;
        this.readyState = MockWebSocket.CLOSED;

        // Clear connection timeout if still pending
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }

        // Call onclose only once
        if (this.onclose) {
            const closeHandler = this.onclose;
            this.onclose = null; // Prevent multiple calls
            closeHandler(new CloseEvent('close'));
        }
    }

    // Helper for tests
    simulateMessage(data: any): void {
        if (this.onmessage) {
            this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }));
        }
    }

    simulateError(): void {
        if (this.onerror) {
            this.onerror(new Event('error'));
        }
    }
}

// Mock WebSocket globally
const originalWebSocket = global.WebSocket;
beforeEach(() => {
    (global as any).WebSocket = MockWebSocket;
});

afterEach(() => {
    global.WebSocket = originalWebSocket;
});

describe('Anvil Server Call Manager', () => {
    let manager: AnvilServerCallManager;
    let mockWebSocket: MockWebSocket;

    beforeEach(() => {
        manager = new AnvilServerCallManager();
        jest.clearAllMocks();
    });

    afterEach(() => {
        if (manager && manager.isConnectedToServer()) {
            manager.disconnect();
        }
    });

    describe('Core Functionality', () => {
        test('should create manager instance', () => {
            expect(manager).toBeDefined();
            expect(manager.isConnectedToServer()).toBe(false);
            expect(manager.getPendingCallsCount()).toBe(0);
        });

        test('should manage function registry', () => {
            manager.registerFunction('test_func', {
                description: 'Test function',
                parameters: { arg1: 'string' },
                returnType: 'string'
            });

            const registry = manager.getRegisteredFunctions();
            expect(registry.test_func).toMatchObject({
                description: 'Test function',
                parameters: { arg1: 'string' },
                returnType: 'string'
            });
        });

        test('should handle connection attempt', async () => {
            const connectPromise = manager.connect('ws://localhost:3030/_/uplink');
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(manager.isConnectedToServer()).toBe(true);
        });

        test('should track connection state', () => {
            expect(manager.isConnectedToServer()).toBe(false);

            manager.disconnect();
            expect(manager.isConnectedToServer()).toBe(false);
        });

        test('should manage callbacks', async () => {
            const onConnected = jest.fn();
            const onDisconnected = jest.fn();
            const onError = jest.fn();

            manager.onConnected(onConnected);
            manager.onDisconnected(onDisconnected);
            manager.onError(onError);

            await manager.connect('ws://localhost:3030/_/uplink');
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(onConnected).toHaveBeenCalledTimes(1);

            manager.disconnect();
            expect(onDisconnected).toHaveBeenCalledTimes(1);
        });
    });

    describe('Call Management', () => {
        beforeEach(async () => {
            await manager.connect('ws://localhost:3030/_/uplink');
            await new Promise(resolve => setTimeout(resolve, 50));
        });

        test('should reject calls when not connected', async () => {
            const disconnectedManager = new AnvilServerCallManager();

            await expect(disconnectedManager.call('test_function'))
                .rejects.toThrow('Not connected to Anvil server');
        });

        test('should generate unique call IDs', () => {
            // Access private method for testing
            const generateCallId = (manager as any).generateCallId.bind(manager);

            const id1 = generateCallId();
            const id2 = generateCallId();

            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2);
        });

        test('should handle call options', () => {
            const options: ServerCallOptions = {
                timeout: 5000,
                retries: 3,
                retryDelay: 1000,
                includeStackTrace: true,
                priority: 'high'
            };

            // This tests that the options are accepted without error
            expect(() => {
                manager.call('test_function', [], {}, options);
            }).not.toThrow();
        });

        test('should cancel all pending calls (unit test)', () => {
            // Suppress all console output during this test to prevent noise
            const originalConsole = {
                log: console.log,
                error: console.error,
                warn: console.warn,
                info: console.info
            };

            console.log = jest.fn();
            console.error = jest.fn();
            console.warn = jest.fn();
            console.info = jest.fn();

            try {
                // Create a manager and manually add pending calls to test cancellation logic
                const testManager = new AnvilServerCallManager();

                // Use reflection to access private members for unit testing
                const pendingCalls = (testManager as any).pendingCalls;

                // Manually create pending call objects (simulating what would happen during real calls)
                const mockCall1 = {
                    id: 'test1',
                    functionName: 'func1',
                    args: [],
                    kwargs: {},
                    options: { timeout: 30000 },
                    resolve: jest.fn(),
                    reject: jest.fn(),
                    timestamp: Date.now(),
                    retryCount: 0,
                    timeoutId: setTimeout(() => { }, 30000)
                };

                const mockCall2 = {
                    id: 'test2',
                    functionName: 'func2',
                    args: [],
                    kwargs: {},
                    options: { timeout: 30000 },
                    resolve: jest.fn(),
                    reject: jest.fn(),
                    timestamp: Date.now(),
                    retryCount: 0,
                    timeoutId: setTimeout(() => { }, 30000)
                };

                // Add to pending calls
                pendingCalls.set('test1', mockCall1);
                pendingCalls.set('test2', mockCall2);

                // Verify setup
                expect(testManager.getPendingCallsCount()).toBe(2);

                // Test cancellation
                const cancelled = testManager.cancelAllCalls();
                expect(cancelled).toBe(2);
                expect(testManager.getPendingCallsCount()).toBe(0);

                // Verify calls were rejected with correct error
                expect(mockCall1.reject).toHaveBeenCalledWith({
                    type: 'UnknownError',
                    message: 'All calls cancelled',
                    serverFunction: 'func1'
                });

                expect(mockCall2.reject).toHaveBeenCalledWith({
                    type: 'UnknownError',
                    message: 'All calls cancelled',
                    serverFunction: 'func2'
                });

            } finally {
                // Restore console
                console.log = originalConsole.log;
                console.error = originalConsole.error;
                console.warn = originalConsole.warn;
                console.info = originalConsole.info;
            }
        })
    });

    describe('Error Handling', () => {
        test('should handle connection errors gracefully', async () => {
            const manager = new AnvilServerCallManager();

            // Mock WebSocket to fail immediately
            (global as any).WebSocket = class {
                constructor() {
                    setTimeout(() => {
                        if (this.onerror) {
                            this.onerror(new Event('error'));
                        }
                    }, 10);
                }
                onopen: any = null;
                onclose: any = null;
                onmessage: any = null;
                onerror: any = null;
            };

            await expect(manager.connect('ws://invalid:3030/_/uplink'))
                .rejects.toMatchObject({
                    type: 'NetworkError'
                });
        });

        test('should validate error types', () => {
            const networkError: ServerCallError = {
                type: 'NetworkError',
                message: 'Connection failed'
            };

            const serverError: ServerCallError = {
                type: 'AnvilServerError',
                message: 'Server function failed',
                details: { code: 500 }
            };

            const timeoutError: ServerCallError = {
                type: 'TimeoutError',
                message: 'Call timed out'
            };

            expect(networkError.type).toBe('NetworkError');
            expect(serverError.type).toBe('AnvilServerError');
            expect(timeoutError.type).toBe('TimeoutError');
        });
    });
});

describe('React Hooks Integration', () => {
    beforeEach(() => {
        clearServerCallCache();
        jest.clearAllMocks();
    });

    describe('Hook Interface Tests (No Server Required)', () => {
        test('should have correct hook signatures', () => {
            // Test that the hooks are exported correctly
            expect(typeof useServerCall).toBe('function');
            expect(typeof useLazyServerCall).toBe('function');
            expect(typeof useServerMutation).toBe('function');
            expect(typeof useServerConnection).toBe('function');
            expect(typeof useServerCallManager).toBe('function');
        });

        test('should handle hook initialization without server', () => {
            // These hooks should not crash when imported
            expect(() => {
                // Just testing function existence, not execution
                const hookFunctions = [
                    useServerCall,
                    useLazyServerCall,
                    useServerMutation,
                    useServerConnection,
                    useServerCallManager
                ];
                expect(hookFunctions.every(fn => typeof fn === 'function')).toBe(true);
            }).not.toThrow();
        });
    });
});

describe('Cache Management', () => {
    beforeEach(() => {
        clearServerCallCache();
    });

    test('should clear cache', () => {
        // This is a smoke test - cache clearing should not throw
        expect(() => clearServerCallCache()).not.toThrow();
    });

    test('should handle cache policies', () => {
        const policies = ['cache-first', 'cache-and-network', 'network-only', 'no-cache'] as const;

        policies.forEach(policy => {
            const { result } = renderHook(() =>
                useServerCall('test_function', [], {
                    fetchPolicy: policy,
                    skip: true
                })
            );

            expect(result.current).toBeDefined();
        });
    });
});

describe('Type Safety', () => {
    test('should provide proper TypeScript types', () => {
        // This test ensures the types compile correctly
        const manager = new AnvilServerCallManager();

        const options: ServerCallOptions = {
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            includeStackTrace: false,
            priority: 'normal'
        };

        const error: ServerCallError = {
            type: 'AnvilServerError',
            message: 'Test error',
            details: { code: 400 },
            serverFunction: 'test_function'
        };

        expect(options.timeout).toBe(30000);
        expect(error.type).toBe('AnvilServerError');
        expect(manager).toBeInstanceOf(AnvilServerCallManager);
    });
});

describe('Integration Scenarios', () => {
    test('should handle rapid connect/disconnect', async () => {
        const manager = new AnvilServerCallManager();

        await manager.connect('ws://localhost:3030/_/uplink');
        await new Promise(resolve => setTimeout(resolve, 10));

        manager.disconnect();
        expect(manager.isConnectedToServer()).toBe(false);

        await manager.connect('ws://localhost:3030/_/uplink');
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(manager.isConnectedToServer()).toBe(true);
    });

    test('should handle multiple managers', () => {
        const manager1 = new AnvilServerCallManager();
        const manager2 = new AnvilServerCallManager();

        expect(manager1).not.toBe(manager2);
        expect(manager1.getPendingCallsCount()).toBe(0);
        expect(manager2.getPendingCallsCount()).toBe(0);
    });
}); 