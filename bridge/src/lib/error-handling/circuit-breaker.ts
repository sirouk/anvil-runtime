/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by detecting failing services and temporarily
 * blocking requests to give the service time to recover.
 */

export interface CircuitBreakerConfig {
    failureThreshold: number; // Number of failures before opening circuit
    successThreshold: number; // Number of successes needed to close circuit
    timeout: number; // Time in ms to wait before trying again (half-open state)
    monitor: (event: CircuitBreakerEvent) => void; // Monitoring callback
    name: string; // Name for logging/monitoring
}

export interface CircuitBreakerEvent {
    circuitName: string;
    state: CircuitState;
    timestamp: Date;
    error?: Error;
    duration?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStats {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime?: Date;
    lastSuccessTime?: Date;
    totalRequests: number;
    totalFailures: number;
    totalSuccesses: number;
    averageResponseTime: number;
}

export class CircuitBreaker {
    private config: CircuitBreakerConfig;
    private state: CircuitState = 'CLOSED';
    private failureCount: number = 0;
    private successCount: number = 0;
    private lastFailureTime?: Date;
    private lastSuccessTime?: Date;
    private nextAttemptTime?: Date;
    private totalRequests: number = 0;
    private totalFailures: number = 0;
    private totalSuccesses: number = 0;
    private responseTimes: number[] = [];

    constructor(config: CircuitBreakerConfig) {
        this.config = config;
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        const startTime = Date.now();

        if (this.shouldReject()) {
            const error = new Error(`Circuit breaker ${this.config.name} is OPEN`);
            this.notifyMonitor({
                circuitName: this.config.name,
                state: this.state,
                timestamp: new Date(),
                error
            });
            throw error;
        }

        this.totalRequests++;

        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            this.onSuccess(duration);
            return result;
        } catch (error) {
            const duration = Date.now() - startTime;
            this.onFailure(error as Error, duration);
            throw error;
        }
    }

    /**
     * Check if requests should be rejected
     */
    private shouldReject(): boolean {
        if (this.state === 'CLOSED') {
            return false;
        }

        if (this.state === 'OPEN') {
            if (this.nextAttemptTime && Date.now() < this.nextAttemptTime.getTime()) {
                return true;
            }
            // Try to transition to half-open
            this.state = 'HALF_OPEN';
            this.successCount = 0;
            this.notifyMonitor({
                circuitName: this.config.name,
                state: this.state,
                timestamp: new Date()
            });
            return false;
        }

        // HALF_OPEN state - allow requests but monitor closely
        return false;
    }

    /**
     * Handle successful execution
     */
    private onSuccess(duration: number): void {
        this.lastSuccessTime = new Date();
        this.totalSuccesses++;
        this.successCount++;
        this.recordResponseTime(duration);

        if (this.state === 'HALF_OPEN') {
            if (this.successCount >= this.config.successThreshold) {
                this.state = 'CLOSED';
                this.failureCount = 0;
                this.notifyMonitor({
                    circuitName: this.config.name,
                    state: this.state,
                    timestamp: new Date(),
                    duration
                });
            }
        } else if (this.state === 'CLOSED') {
            // Reset failure count on success
            this.failureCount = 0;
        }
    }

    /**
     * Handle failed execution
     */
    private onFailure(error: Error, duration: number): void {
        this.lastFailureTime = new Date();
        this.totalFailures++;
        this.failureCount++;
        this.recordResponseTime(duration);

        if (this.state === 'HALF_OPEN') {
            // Go back to open state on any failure in half-open
            this.state = 'OPEN';
            this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
        } else if (this.state === 'CLOSED') {
            if (this.failureCount >= this.config.failureThreshold) {
                this.state = 'OPEN';
                this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
            }
        }

        this.notifyMonitor({
            circuitName: this.config.name,
            state: this.state,
            timestamp: new Date(),
            error,
            duration
        });
    }

    /**
     * Record response time for monitoring
     */
    private recordResponseTime(duration: number): void {
        this.responseTimes.push(duration);
        // Keep only last 100 response times for average calculation
        if (this.responseTimes.length > 100) {
            this.responseTimes = this.responseTimes.slice(-100);
        }
    }

    /**
     * Notify monitoring callback
     */
    private notifyMonitor(event: CircuitBreakerEvent): void {
        try {
            this.config.monitor(event);
        } catch (error) {
            console.error('Circuit breaker monitor callback failed:', error);
        }
    }

    /**
     * Get current circuit breaker statistics
     */
    getStats(): CircuitBreakerStats {
        const averageResponseTime = this.responseTimes.length > 0
            ? this.responseTimes.reduce((sum, time) => sum + time, 0) / this.responseTimes.length
            : 0;

        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            lastFailureTime: this.lastFailureTime,
            lastSuccessTime: this.lastSuccessTime,
            totalRequests: this.totalRequests,
            totalFailures: this.totalFailures,
            totalSuccesses: this.totalSuccesses,
            averageResponseTime
        };
    }

    /**
     * Force circuit to open state (for testing or manual intervention)
     */
    forceOpen(): void {
        this.state = 'OPEN';
        this.nextAttemptTime = new Date(Date.now() + this.config.timeout);
        this.notifyMonitor({
            circuitName: this.config.name,
            state: this.state,
            timestamp: new Date()
        });
    }

    /**
     * Force circuit to closed state (for testing or manual intervention)
     */
    forceClose(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.nextAttemptTime = undefined;
        this.notifyMonitor({
            circuitName: this.config.name,
            state: this.state,
            timestamp: new Date()
        });
    }

    /**
     * Reset all statistics
     */
    reset(): void {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = undefined;
        this.lastSuccessTime = undefined;
        this.nextAttemptTime = undefined;
        this.totalRequests = 0;
        this.totalFailures = 0;
        this.totalSuccesses = 0;
        this.responseTimes = [];
    }
}

/**
 * Circuit Breaker Manager for managing multiple circuit breakers
 */
export class CircuitBreakerManager {
    private circuitBreakers: Map<string, CircuitBreaker> = new Map();
    private defaultConfig: Partial<CircuitBreakerConfig>;

    constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
        this.defaultConfig = {
            failureThreshold: 5,
            successThreshold: 3,
            timeout: 60000, // 1 minute
            monitor: () => { }, // no-op by default
            ...defaultConfig
        };
    }

    /**
     * Get or create a circuit breaker
     */
    getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
        if (!this.circuitBreakers.has(name)) {
            const fullConfig = {
                ...this.defaultConfig,
                ...config,
                name
            } as CircuitBreakerConfig;

            this.circuitBreakers.set(name, new CircuitBreaker(fullConfig));
        }

        return this.circuitBreakers.get(name)!;
    }

    /**
     * Execute function with circuit breaker protection
     */
    async execute<T>(
        name: string,
        fn: () => Promise<T>,
        config?: Partial<CircuitBreakerConfig>
    ): Promise<T> {
        const circuitBreaker = this.getCircuitBreaker(name, config);
        return circuitBreaker.execute(fn);
    }

    /**
     * Get stats for all circuit breakers
     */
    getAllStats(): Map<string, CircuitBreakerStats> {
        const stats = new Map<string, CircuitBreakerStats>();
        for (const [name, circuitBreaker] of this.circuitBreakers) {
            stats.set(name, circuitBreaker.getStats());
        }
        return stats;
    }

    /**
     * Force all circuits to closed state
     */
    resetAll(): void {
        for (const circuitBreaker of this.circuitBreakers.values()) {
            circuitBreaker.reset();
        }
    }
}

// Default global circuit breaker manager
export const globalCircuitBreakerManager = new CircuitBreakerManager({
    monitor: (event: CircuitBreakerEvent) => {
        console.log(`🔌 Circuit Breaker [${event.circuitName}]: ${event.state}`, {
            timestamp: event.timestamp,
            error: event.error?.message,
            duration: event.duration
        });
    }
}); 