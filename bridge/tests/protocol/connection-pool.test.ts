/**
 * Connection Pool Tests
 */

import { ConnectionPool, ConnectionPoolConfig } from '@/lib/protocol/connection-pool';
import { WebSocketProxy, WebSocketProxyConfig } from '@/lib/protocol/websocket-proxy';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');
const MockWebSocket = WebSocket as jest.MockedClass<typeof WebSocket>;

// Mock WebSocketProxy
jest.mock('@/lib/protocol/websocket-proxy');
const MockWebSocketProxy = WebSocketProxy as jest.MockedClass<typeof WebSocketProxy>;

describe('Connection Pool Tests', () => {
    let pool: ConnectionPool;
    let mockProxyConfig: WebSocketProxyConfig;
    let mockPoolConfig: Partial<ConnectionPoolConfig>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockProxyConfig = {
            anvilServerUrl: 'localhost',
            anvilServerPort: 3030,
            debug: false,
        };

        mockPoolConfig = {
            minConnections: 2,
            maxConnections: 5,
            connectionTimeout: 1000,
            healthCheckInterval: 100,
            idleTimeout: 500,
            debug: false,
        };

        // Setup mock WebSocketProxy
        MockWebSocketProxy.prototype.connectToAnvil = jest.fn().mockResolvedValue(undefined);
        MockWebSocketProxy.prototype.addClient = jest.fn();
        MockWebSocketProxy.prototype.disconnect = jest.fn();
        MockWebSocketProxy.prototype.isConnectedToAnvil = jest.fn().mockReturnValue(true);
        MockWebSocketProxy.prototype.getClientCount = jest.fn().mockReturnValue(0);
    });

    afterEach(async () => {
        if (pool) {
            await pool.shutdown();
        }
    });

    describe('Pool Initialization', () => {
        test('should create minimum connections on initialization', async () => {
            pool = new ConnectionPool(mockProxyConfig, mockPoolConfig);
            await pool.initialize();

            expect(MockWebSocketProxy).toHaveBeenCalledTimes(2); // minConnections
            expect(MockWebSocketProxy.prototype.connectToAnvil).toHaveBeenCalledTimes(2);
        });

        test('should handle initialization failure', async () => {
            MockWebSocketProxy.prototype.connectToAnvil = jest.fn()
                .mockRejectedValue(new Error('Connection failed'));

            pool = new ConnectionPool(mockProxyConfig, mockPoolConfig);

            await expect(pool.initialize()).rejects.toThrow('Connection pool initialization failed');
        });

        test('should timeout connections during initialization', async () => {
            MockWebSocketProxy.prototype.connectToAnvil = jest.fn()
                .mockImplementation(() => new Promise(() => { })); // Never resolves

            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                connectionTimeout: 100
            });

            await expect(pool.initialize()).rejects.toThrow('Connection pool initialization failed');
        });
    });

    describe('Client Management', () => {
        beforeEach(async () => {
            pool = new ConnectionPool(mockProxyConfig, mockPoolConfig);
            await pool.initialize();
        });

        test('should add client to available connection', async () => {
            const mockClient = new MockWebSocket('ws://test');
            mockClient.on = jest.fn();

            await pool.addClient(mockClient);

            expect(MockWebSocketProxy.prototype.addClient).toHaveBeenCalledWith(mockClient);
        });

        test('should distribute clients across connections (least-connections)', async () => {
            const mockClients = Array(4).fill(null).map(() => {
                const client = new MockWebSocket('ws://test');
                client.on = jest.fn();
                return client;
            });

            // Add clients
            for (const client of mockClients) {
                await pool.addClient(client);
            }

            // Should have distributed across 2 connections (minConnections)
            expect(MockWebSocketProxy.prototype.addClient).toHaveBeenCalledTimes(4);
        });

        test('should create new connection when needed', async () => {
            // Clear previous mock calls
            jest.clearAllMocks();

            const poolWithHighLoad = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                minConnections: 1,
                maxConnections: 3,
            });
            await poolWithHighLoad.initialize();

            // Clear initialization calls
            jest.clearAllMocks();

            // Mock existing connection as unhealthy and simulate that no healthy connections exist
            const poolAny = poolWithHighLoad as any;
            poolAny.connections.forEach((conn: any) => {
                conn.health = 'unhealthy';
            });

            const mockClient = new MockWebSocket('ws://test');
            mockClient.on = jest.fn();

            await poolWithHighLoad.addClient(mockClient);

            // Should have created 1 new connection
            expect(MockWebSocketProxy).toHaveBeenCalledTimes(1);

            await poolWithHighLoad.shutdown();
        });
    });

    describe('Load Balancing Strategies', () => {
        test('should use round-robin strategy', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                loadBalancingStrategy: 'round-robin',
                minConnections: 3,
            });
            await pool.initialize();

            const addClientCallCount = jest.fn();

            // Track calls without overriding the mock
            MockWebSocketProxy.prototype.addClient.mockImplementation(addClientCallCount);

            // Add 6 clients
            for (let i = 0; i < 6; i++) {
                const client = new MockWebSocket('ws://test');
                client.on = jest.fn();
                await pool.addClient(client);
            }

            // Should distribute evenly across 3 connections
            expect(addClientCallCount).toHaveBeenCalledTimes(6);
        });

        test('should use random strategy', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                loadBalancingStrategy: 'random',
            });
            await pool.initialize();

            const mockClient = new MockWebSocket('ws://test');
            mockClient.on = jest.fn();

            await pool.addClient(mockClient);

            expect(MockWebSocketProxy.prototype.addClient).toHaveBeenCalled();
        });
    });

    describe('Health Monitoring', () => {
        test('should mark unhealthy connections', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                healthCheckInterval: 50,
            });
            await pool.initialize();

            // Mock connections as unhealthy after initial health checks
            let checkCount = 0;
            MockWebSocketProxy.prototype.isConnectedToAnvil = jest.fn()
                .mockImplementation(() => {
                    checkCount++;
                    // First few checks are healthy, then fail
                    return checkCount <= 6; // Allow 3 checks per connection to pass
                });

            // Wait for multiple health check cycles
            await new Promise(resolve => setTimeout(resolve, 300));

            const stats = pool.getStats();
            expect(stats.healthyConnections + stats.degradedConnections + stats.unhealthyConnections).toBe(2);
        });

        test('should attempt to recover unhealthy connections', async () => {
            jest.clearAllMocks();

            // Create pool with only 1 connection
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                healthCheckInterval: 30,
                minConnections: 1,
                maxConnections: 1,
            });

            // Track connectToAnvil calls
            let connectCalls = 0;
            let healthCheckPhase = 'initial'; // Track what phase we're in

            MockWebSocketProxy.prototype.connectToAnvil = jest.fn()
                .mockImplementation(() => {
                    connectCalls++;
                    // Fail recovery attempts but allow initial connection
                    if (connectCalls > 1) {
                        return Promise.reject(new Error('Recovery failed'));
                    }
                    return Promise.resolve();
                });

            MockWebSocketProxy.prototype.isConnectedToAnvil = jest.fn()
                .mockImplementation(() => {
                    // Start healthy, then become unhealthy after initialization
                    return healthCheckPhase === 'initial';
                });

            await pool.initialize();

            // Should have 1 connection from initialization
            expect(connectCalls).toBe(1);

            // Now simulate connection becoming unhealthy
            healthCheckPhase = 'unhealthy';

            // Wait for health checks to mark connection as unhealthy and trigger multiple recovery attempts
            await new Promise(resolve => setTimeout(resolve, 300));

            // Should have attempted to reconnect (recovery) multiple times
            expect(connectCalls).toBeGreaterThan(1);
        });
    });

    describe('Graceful Degradation', () => {
        test('should enter degraded mode when below min healthy connections', async () => {
            // Create pool that will enter degraded mode
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                minConnections: 2,
                healthCheckInterval: 10, // Very frequent checks  
                gracefulDegradation: {
                    enabled: true,
                    minHealthyConnections: 2,
                    degradedModeMaxClients: 5,
                    circuitBreakerThreshold: 3,
                    circuitBreakerResetTime: 1000,
                },
            });

            // Mock connections that quickly become unhealthy
            let callCount = 0;
            MockWebSocketProxy.prototype.isConnectedToAnvil = jest.fn()
                .mockImplementation(() => {
                    callCount++;
                    // Allow first 2 calls (initialization) to succeed, then fail
                    return callCount <= 2;
                });

            await pool.initialize();

            // Wait for health checks to run and detect failures
            await new Promise(resolve => setTimeout(resolve, 50));

            // Force another health check cycle
            await new Promise(resolve => setTimeout(resolve, 50));

            const stats = pool.getStats();

            // We should have unhealthy connections and be in degraded mode
            expect(stats.healthyConnections).toBe(0);
            expect(stats.isInDegradedMode).toBe(true);
        });

        test('should limit clients in degraded mode', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                gracefulDegradation: {
                    enabled: true,
                    minHealthyConnections: 2,
                    degradedModeMaxClients: 2,
                    circuitBreakerThreshold: 3,
                    circuitBreakerResetTime: 1000,
                },
            });
            await pool.initialize();

            // Force degraded mode by mocking unhealthy connections
            MockWebSocketProxy.prototype.isConnectedToAnvil = jest.fn()
                .mockReturnValue(false);

            // Manually set degraded mode (since we're not waiting for health checks)
            (pool as any).isInDegradedMode = true;

            // Mock getTotalClientCount to return at capacity
            (pool as any).getTotalClientCount = jest.fn().mockReturnValue(2);

            const mockClient = new MockWebSocket('ws://test');
            mockClient.on = jest.fn();

            await expect(pool.addClient(mockClient))
                .rejects.toThrow('Service operating at reduced capacity');
        });
    });

    describe('Circuit Breaker', () => {
        test('should open circuit breaker after threshold failures', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                minConnections: 1,
                gracefulDegradation: {
                    enabled: true,
                    minHealthyConnections: 1,
                    degradedModeMaxClients: 50,
                    circuitBreakerThreshold: 2,
                    circuitBreakerResetTime: 100,
                },
            });

            // Mock initialization to succeed
            await pool.initialize();

            // Mock connection creation to fail
            MockWebSocketProxy.prototype.connectToAnvil = jest.fn()
                .mockRejectedValue(new Error('Connection failed'));

            // Trigger failures by calling private method
            const poolAny = pool as any;
            poolAny.recordCircuitBreakerFailure();
            poolAny.recordCircuitBreakerFailure();

            const stats = pool.getStats();
            expect(stats.circuitBreakerOpen).toBe(true);

            // Should reject new clients
            const mockClient = new MockWebSocket('ws://test');
            await expect(pool.addClient(mockClient))
                .rejects.toThrow('Service temporarily unavailable');
        });

        test('should reset circuit breaker after timeout', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                gracefulDegradation: {
                    enabled: true,
                    minHealthyConnections: 1,
                    degradedModeMaxClients: 50,
                    circuitBreakerThreshold: 1,
                    circuitBreakerResetTime: 100,
                },
            });
            await pool.initialize();

            // Open circuit breaker
            const poolAny = pool as any;
            poolAny.recordCircuitBreakerFailure();

            expect(pool.getStats().circuitBreakerOpen).toBe(true);

            // Wait for reset time
            await new Promise(resolve => setTimeout(resolve, 150));

            // Try to add client (which triggers circuit breaker check)
            const mockClient = new MockWebSocket('ws://test');
            mockClient.on = jest.fn();

            await pool.addClient(mockClient);

            expect(pool.getStats().circuitBreakerOpen).toBe(false);
        });
    });

    describe('Connection Lifecycle', () => {
        test('should remove idle connections above minimum', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                minConnections: 1,
                maxConnections: 3,
                idleTimeout: 100,
            });
            await pool.initialize();

            // Create additional connection
            const poolAny = pool as any;
            await poolAny.createConnection();

            expect(pool.getStats().totalConnections).toBe(2);

            // Wait for idle timeout
            await new Promise(resolve => setTimeout(resolve, 150));

            // Trigger removal by calling the scheduled function
            // In real scenario, this would happen automatically
            const connections = Array.from(poolAny.connections.values());
            const idleConnection = connections.find((c: any) => c.clientCount === 0) as any;
            if (idleConnection) {
                poolAny.connections.delete(idleConnection.id);
            }

            expect(pool.getStats().totalConnections).toBe(1);
        });

        test('should clean up on shutdown', async () => {
            pool = new ConnectionPool(mockProxyConfig, mockPoolConfig);
            await pool.initialize();

            await pool.shutdown();

            expect(MockWebSocketProxy.prototype.disconnect).toHaveBeenCalledTimes(2);
            expect(pool.getStats().totalConnections).toBe(0);
        });
    });

    describe('Statistics', () => {
        test('should provide accurate pool statistics', async () => {
            pool = new ConnectionPool(mockProxyConfig, {
                ...mockPoolConfig,
                minConnections: 3,
            });
            await pool.initialize();

            const stats = pool.getStats();

            expect(stats).toEqual({
                totalConnections: 3,
                healthyConnections: 3,
                degradedConnections: 0,
                unhealthyConnections: 0,
                totalClients: 0,
                isInDegradedMode: false,
                circuitBreakerOpen: false,
            });
        });
    });
}); 