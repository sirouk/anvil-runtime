/**
 * Connection Pool Manager for WebSocket Proxy
 * 
 * Manages multiple Anvil server connections with:
 * - Connection pooling and reuse
 * - Load balancing across connections
 * - Graceful degradation strategies
 * - Health monitoring and failover
 */

import WebSocket from 'ws';
import { WebSocketProxy, WebSocketProxyConfig } from './websocket-proxy';
import { AnvilMessage } from '@/types/anvil-protocol';

export interface ConnectionPoolConfig {
    minConnections: number;
    maxConnections: number;
    connectionTimeout: number;
    idleTimeout: number;
    healthCheckInterval: number;
    loadBalancingStrategy: 'round-robin' | 'least-connections' | 'random';
    gracefulDegradation: {
        enabled: boolean;
        minHealthyConnections: number;
        degradedModeMaxClients: number;
        circuitBreakerThreshold: number;
        circuitBreakerResetTime: number;
    };
    debug?: boolean;
}

interface PooledConnection {
    id: string;
    proxy: WebSocketProxy;
    clientCount: number;
    lastUsed: number;
    health: 'healthy' | 'degraded' | 'unhealthy';
    failureCount: number;
    createdAt: number;
}

export class ConnectionPool {
    private config: ConnectionPoolConfig;
    private proxyConfig: WebSocketProxyConfig;
    private connections: Map<string, PooledConnection> = new Map();
    private clientToConnection: WeakMap<WebSocket, string> = new WeakMap();
    private healthCheckTimer: NodeJS.Timeout | null = null;
    private roundRobinIndex = 0;
    private isInDegradedMode = false;
    private circuitBreaker = {
        isOpen: false,
        failureCount: 0,
        lastFailureTime: 0,
    };

    constructor(proxyConfig: WebSocketProxyConfig, poolConfig?: Partial<ConnectionPoolConfig>) {
        this.proxyConfig = proxyConfig;
        this.config = {
            minConnections: 2,
            maxConnections: 10,
            connectionTimeout: 30000,
            idleTimeout: 300000, // 5 minutes
            healthCheckInterval: 30000,
            loadBalancingStrategy: 'least-connections',
            gracefulDegradation: {
                enabled: true,
                minHealthyConnections: 1,
                degradedModeMaxClients: 50,
                circuitBreakerThreshold: 5,
                circuitBreakerResetTime: 60000,
            },
            debug: false,
            ...poolConfig,
        };
    }

    /**
     * Initialize the connection pool
     */
    async initialize(): Promise<void> {
        console.log(`🏊 Initializing connection pool with ${this.config.minConnections} connections`);

        // Create initial connections
        const connectionPromises: Promise<void>[] = [];
        for (let i = 0; i < this.config.minConnections; i++) {
            connectionPromises.push(this.createConnection());
        }

        try {
            await Promise.all(connectionPromises);
        } catch (error) {
            console.error('Failed to initialize minimum connections:', error);
            throw new Error('Connection pool initialization failed');
        }

        // Start health monitoring
        this.startHealthMonitoring();
    }

    /**
     * Create a new pooled connection
     */
    private async createConnection(): Promise<void> {
        const connectionId = this.generateConnectionId();
        const proxy = new WebSocketProxy({
            ...this.proxyConfig,
            debug: this.config.debug,
        });

        try {
            await Promise.race([
                proxy.connectToAnvil(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Connection timeout')), this.config.connectionTimeout)
                )
            ]);

            const pooledConnection: PooledConnection = {
                id: connectionId,
                proxy,
                clientCount: 0,
                lastUsed: Date.now(),
                health: 'healthy',
                failureCount: 0,
                createdAt: Date.now(),
            };

            this.connections.set(connectionId, pooledConnection);

            if (this.config.debug) {
                console.log(`✅ Created connection ${connectionId}`);
            }
        } catch (error) {
            console.error(`Failed to create connection ${connectionId}:`, error);
            throw error;
        }
    }

    /**
     * Add a client to the pool
     */
    async addClient(clientWs: WebSocket): Promise<void> {
        // Check circuit breaker
        if (this.circuitBreaker.isOpen) {
            this.checkCircuitBreaker();
            if (this.circuitBreaker.isOpen) {
                throw new Error('Service temporarily unavailable - circuit breaker open');
            }
        }

        // Check degraded mode limits
        if (this.isInDegradedMode) {
            const totalClients = this.getTotalClientCount();
            if (totalClients >= this.config.gracefulDegradation.degradedModeMaxClients) {
                throw new Error('Service operating at reduced capacity - please try again later');
            }
        }

        // Select connection based on strategy
        const connection = await this.selectConnection();
        if (!connection) {
            throw new Error('No available connections in pool');
        }

        // Add client to selected connection
        connection.proxy.addClient(clientWs);
        connection.clientCount++;
        connection.lastUsed = Date.now();
        this.clientToConnection.set(clientWs, connection.id);

        // Monitor client disconnect
        clientWs.on('close', () => {
            this.removeClient(clientWs);
        });

        if (this.config.debug) {
            console.log(`Client added to connection ${connection.id} (${connection.clientCount} clients)`);
        }
    }

    /**
     * Remove a client from the pool
     */
    private removeClient(clientWs: WebSocket): void {
        const connectionId = this.clientToConnection.get(clientWs);
        if (!connectionId) return;

        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.clientCount--;
            connection.lastUsed = Date.now();

            // Check if connection can be removed (if above min and idle)
            if (this.connections.size > this.config.minConnections &&
                connection.clientCount === 0) {
                this.scheduleConnectionRemoval(connectionId);
            }
        }

        this.clientToConnection.delete(clientWs);
    }

    /**
     * Select a connection based on load balancing strategy
     */
    private async selectConnection(): Promise<PooledConnection | null> {
        const healthyConnections = Array.from(this.connections.values())
            .filter(conn => conn.health !== 'unhealthy');

        if (healthyConnections.length === 0) {
            // Try to create a new connection if below max
            if (this.connections.size < this.config.maxConnections) {
                try {
                    await this.createConnection();
                    return this.selectConnection(); // Retry selection
                } catch (error) {
                    console.error('Failed to create emergency connection:', error);
                }
            }
            return null;
        }

        switch (this.config.loadBalancingStrategy) {
            case 'round-robin':
                this.roundRobinIndex = (this.roundRobinIndex + 1) % healthyConnections.length;
                return healthyConnections[this.roundRobinIndex];

            case 'least-connections':
                return healthyConnections.reduce((least, current) =>
                    current.clientCount < least.clientCount ? current : least
                );

            case 'random':
                return healthyConnections[Math.floor(Math.random() * healthyConnections.length)];

            default:
                return healthyConnections[0];
        }
    }

    /**
     * Start health monitoring
     */
    private startHealthMonitoring(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        this.healthCheckTimer = setInterval(() => {
            this.performHealthChecks();
        }, this.config.healthCheckInterval);
    }

    /**
     * Perform health checks on all connections
     */
    private async performHealthChecks(): Promise<void> {
        const healthChecks = Array.from(this.connections.entries()).map(async ([id, connection]) => {
            try {
                // Check if connection is still alive
                const isHealthy = connection.proxy.isConnectedToAnvil();

                if (isHealthy) {
                    connection.health = 'healthy';
                    connection.failureCount = 0;
                } else {
                    connection.failureCount++;

                    if (connection.failureCount >= 3) {
                        connection.health = 'unhealthy';
                        await this.handleUnhealthyConnection(id);
                    } else {
                        connection.health = 'degraded';
                    }
                }
            } catch (error) {
                console.error(`Health check failed for connection ${id}:`, error);
                connection.health = 'unhealthy';
                connection.failureCount++;
            }
        });

        await Promise.all(healthChecks);

        // Update degraded mode status
        this.updateDegradedMode();
    }

    /**
     * Handle unhealthy connection
     */
    private async handleUnhealthyConnection(connectionId: string): Promise<void> {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        console.warn(`🚨 Connection ${connectionId} is unhealthy`);

        // If we have minimum healthy connections, remove the unhealthy one
        const healthyCount = Array.from(this.connections.values())
            .filter(conn => conn.health === 'healthy').length;

        if (healthyCount >= this.config.minConnections) {
            // Migrate clients to healthy connections
            if (connection.clientCount > 0) {
                console.log(`Migrating ${connection.clientCount} clients from unhealthy connection`);
                // Note: In real implementation, would need to handle client migration
            }

            // Remove unhealthy connection
            connection.proxy.disconnect();
            this.connections.delete(connectionId);

            // Try to create a replacement
            if (this.connections.size < this.config.minConnections) {
                try {
                    await this.createConnection();
                } catch (error) {
                    console.error('Failed to create replacement connection:', error);
                    this.recordCircuitBreakerFailure();
                }
            }
        } else {
            // Try to recover the connection
            try {
                await connection.proxy.connectToAnvil();
                connection.health = 'healthy';
                connection.failureCount = 0;
            } catch (error) {
                console.error('Failed to recover connection:', error);
                this.recordCircuitBreakerFailure();
            }
        }
    }

    /**
     * Update degraded mode based on pool health
     */
    private updateDegradedMode(): void {
        const healthyCount = Array.from(this.connections.values())
            .filter(conn => conn.health === 'healthy').length;

        const wasInDegradedMode = this.isInDegradedMode;
        this.isInDegradedMode = this.config.gracefulDegradation.enabled &&
            healthyCount < this.config.gracefulDegradation.minHealthyConnections;

        if (this.isInDegradedMode && !wasInDegradedMode) {
            console.warn('🔻 Entering degraded mode - operating at reduced capacity');
        } else if (!this.isInDegradedMode && wasInDegradedMode) {
            console.log('✅ Exiting degraded mode - normal operation restored');
        }
    }

    /**
     * Record circuit breaker failure
     */
    private recordCircuitBreakerFailure(): void {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();

        if (this.circuitBreaker.failureCount >= this.config.gracefulDegradation.circuitBreakerThreshold) {
            this.circuitBreaker.isOpen = true;
            console.error('⚡ Circuit breaker opened - rejecting new connections');
        }
    }

    /**
     * Check if circuit breaker can be reset
     */
    private checkCircuitBreaker(): void {
        if (!this.circuitBreaker.isOpen) return;

        const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime;
        if (timeSinceLastFailure >= this.config.gracefulDegradation.circuitBreakerResetTime) {
            this.circuitBreaker.isOpen = false;
            this.circuitBreaker.failureCount = 0;
            console.log('⚡ Circuit breaker reset - accepting connections');
        }
    }

    /**
     * Schedule connection removal after idle timeout
     */
    private scheduleConnectionRemoval(connectionId: string): void {
        setTimeout(() => {
            const connection = this.connections.get(connectionId);
            if (connection && connection.clientCount === 0 &&
                this.connections.size > this.config.minConnections) {

                const idleTime = Date.now() - connection.lastUsed;
                if (idleTime >= this.config.idleTimeout) {
                    connection.proxy.disconnect();
                    this.connections.delete(connectionId);

                    if (this.config.debug) {
                        console.log(`🗑️ Removed idle connection ${connectionId}`);
                    }
                }
            }
        }, this.config.idleTimeout);
    }

    /**
     * Get total client count across all connections
     */
    private getTotalClientCount(): number {
        return Array.from(this.connections.values())
            .reduce((total, conn) => total + conn.clientCount, 0);
    }

    /**
     * Generate unique connection ID
     */
    private generateConnectionId(): string {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get pool statistics
     */
    getStats(): {
        totalConnections: number;
        healthyConnections: number;
        degradedConnections: number;
        unhealthyConnections: number;
        totalClients: number;
        isInDegradedMode: boolean;
        circuitBreakerOpen: boolean;
    } {
        const connections = Array.from(this.connections.values());

        return {
            totalConnections: connections.length,
            healthyConnections: connections.filter(c => c.health === 'healthy').length,
            degradedConnections: connections.filter(c => c.health === 'degraded').length,
            unhealthyConnections: connections.filter(c => c.health === 'unhealthy').length,
            totalClients: this.getTotalClientCount(),
            isInDegradedMode: this.isInDegradedMode,
            circuitBreakerOpen: this.circuitBreaker.isOpen,
        };
    }

    /**
     * Shutdown the connection pool
     */
    async shutdown(): Promise<void> {
        console.log('🛑 Shutting down connection pool');

        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }

        // Disconnect all connections
        const disconnectPromises = Array.from(this.connections.values()).map(conn => {
            return new Promise<void>((resolve) => {
                conn.proxy.disconnect();
                resolve();
            });
        });

        await Promise.all(disconnectPromises);
        this.connections.clear();
    }
} 