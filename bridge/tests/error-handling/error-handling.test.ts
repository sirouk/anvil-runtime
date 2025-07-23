/**
 * Comprehensive test suite for Error Handling System
 */

import { CircuitBreaker, CircuitBreakerManager } from '../../src/lib/error-handling/circuit-breaker';
import { RetryHandler, RetryStrategies, createRetryHandler } from '../../src/lib/error-handling/retry-handler';
import { ErrorMonitor } from '../../src/lib/error-handling/error-monitor';
import { WebSocketFallback } from '../../src/lib/error-handling/websocket-fallback';

// Mock console methods to avoid noise in tests
const originalConsole = { ...console };
beforeEach(() => {
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
});

afterEach(() => {
    Object.assign(console, originalConsole);
});

describe('CircuitBreaker', () => {
    let circuitBreaker: CircuitBreaker;
    let mockFunction: jest.Mock;
    let events: any[] = [];

    beforeEach(() => {
        events = [];
        mockFunction = jest.fn();
        circuitBreaker = new CircuitBreaker({
            failureThreshold: 3,
            successThreshold: 2,
            timeout: 1000,
            monitor: (event) => events.push(event),
            name: 'test-circuit'
        });
    });

    describe('Circuit States', () => {
        test('should start in CLOSED state', () => {
            const stats = circuitBreaker.getStats();
            expect(stats.state).toBe('CLOSED');
            expect(stats.failureCount).toBe(0);
        });

        test('should transition to OPEN after failure threshold', async () => {
            mockFunction.mockRejectedValue(new Error('Test error'));

            // Trigger failures to exceed threshold
            for (let i = 0; i < 3; i++) {
                try {
                    await circuitBreaker.execute(mockFunction);
                } catch (error) {
                    // Expected to fail
                }
            }

            const stats = circuitBreaker.getStats();
            expect(stats.state).toBe('OPEN');
            expect(stats.failureCount).toBe(3);
        });

        test('should reject requests when OPEN', async () => {
            // Force circuit to open
            circuitBreaker.forceOpen();

            await expect(circuitBreaker.execute(mockFunction)).rejects.toThrow('Circuit breaker test-circuit is OPEN');
            expect(mockFunction).not.toHaveBeenCalled();
        });

        test('should transition to HALF_OPEN after timeout', async () => {
            // Use a circuit with short timeout for testing
            const quickCircuit = new CircuitBreaker({
                failureThreshold: 1,
                successThreshold: 1,
                timeout: 50, // 50ms timeout
                monitor: () => { },
                name: 'quick-test'
            });

            // Force to open
            quickCircuit.forceOpen();
            expect(quickCircuit.getStats().state).toBe('OPEN');

            // Wait for timeout
            await new Promise(resolve => setTimeout(resolve, 60));

            // Next execution should try HALF_OPEN
            mockFunction.mockResolvedValue('success');
            await quickCircuit.execute(mockFunction);

            expect(quickCircuit.getStats().state).toBe('CLOSED');
        });

        test('should track success and failure counts', async () => {
            mockFunction.mockResolvedValueOnce('success1')
                .mockRejectedValueOnce(new Error('fail1'))
                .mockResolvedValueOnce('success2');

            await circuitBreaker.execute(mockFunction);
            try {
                await circuitBreaker.execute(mockFunction);
            } catch (error) {
                // Expected failure
            }
            await circuitBreaker.execute(mockFunction);

            const stats = circuitBreaker.getStats();
            expect(stats.totalSuccesses).toBe(2);
            expect(stats.totalFailures).toBe(1);
        });
    });

    describe('Statistics and Monitoring', () => {
        test('should track response times', async () => {
            mockFunction.mockImplementation(() =>
                new Promise(resolve => setTimeout(() => resolve('success'), 10))
            );

            await circuitBreaker.execute(mockFunction);
            await circuitBreaker.execute(mockFunction);

            const stats = circuitBreaker.getStats();
            expect(stats.averageResponseTime).toBeGreaterThan(0);
        });

        test('should notify monitor on state changes', async () => {
            mockFunction.mockRejectedValue(new Error('Test error'));

            // Trigger failures to open circuit
            for (let i = 0; i < 3; i++) {
                try {
                    await circuitBreaker.execute(mockFunction);
                } catch (error) {
                    // Expected
                }
            }

            expect(events).toHaveLength(3); // One event per failure
            expect(events[2].state).toBe('OPEN');
        });

        test('should reset statistics correctly', () => {
            circuitBreaker.forceOpen();
            circuitBreaker.reset();

            const stats = circuitBreaker.getStats();
            expect(stats.state).toBe('CLOSED');
            expect(stats.totalRequests).toBe(0);
            expect(stats.totalFailures).toBe(0);
        });
    });
});

describe('RetryHandler', () => {
    let retryHandler: RetryHandler;
    let mockFunction: jest.Mock;

    beforeEach(() => {
        retryHandler = new RetryHandler({
            maxAttempts: 3,
            baseDelay: 10, // Short delays for testing
            maxDelay: 100,
            backoffMultiplier: 2,
            jitter: false, // Disable jitter for predictable tests
            retryableErrors: () => true, // Retry all errors for testing
            name: 'test-retry'
        });
        mockFunction = jest.fn();
    });

    describe('Retry Logic', () => {
        test('should succeed on first attempt', async () => {
            mockFunction.mockResolvedValue('success');

            const result = await retryHandler.execute(mockFunction);

            expect(result).toBe('success');
            expect(mockFunction).toHaveBeenCalledTimes(1);
        });

        test('should retry on failure and eventually succeed', async () => {
            mockFunction.mockRejectedValueOnce(new Error('fail1'))
                .mockRejectedValueOnce(new Error('fail2'))
                .mockResolvedValue('success');

            const result = await retryHandler.execute(mockFunction);

            expect(result).toBe('success');
            expect(mockFunction).toHaveBeenCalledTimes(3);
        });

        test('should throw error after max attempts', async () => {
            mockFunction.mockRejectedValue(new Error('persistent failure'));

            await expect(retryHandler.execute(mockFunction)).rejects.toThrow('persistent failure');
            expect(mockFunction).toHaveBeenCalledTimes(3);
        });

        test('should respect non-retryable errors', async () => {
            const nonRetryableHandler = new RetryHandler({
                maxAttempts: 3,
                baseDelay: 10,
                maxDelay: 100,
                backoffMultiplier: 2,
                jitter: false,
                retryableErrors: (error) => error.message !== 'non-retryable',
                name: 'non-retryable-test'
            });

            mockFunction.mockRejectedValue(new Error('non-retryable'));

            await expect(nonRetryableHandler.execute(mockFunction)).rejects.toThrow('non-retryable');
            expect(mockFunction).toHaveBeenCalledTimes(1);
        });

        test('should calculate exponential backoff delays', async () => {
            const handler = new RetryHandler({
                maxAttempts: 3,
                baseDelay: 100,
                maxDelay: 1000,
                backoffMultiplier: 2,
                jitter: false,
                retryableErrors: () => true,
                name: 'backoff-test'
            });

            mockFunction.mockRejectedValue(new Error('test'));

            const startTime = Date.now();
            try {
                await handler.execute(mockFunction);
            } catch (error) {
                // Expected to fail
            }
            const endTime = Date.now();

            // Should take at least baseDelay + (baseDelay * backoffMultiplier) = 100 + 200 = 300ms
            expect(endTime - startTime).toBeGreaterThanOrEqual(250); // Allow some margin
        });
    });

    describe('Statistics', () => {
        test('should track retry statistics', async () => {
            mockFunction.mockRejectedValueOnce(new Error('fail'))
                .mockResolvedValue('success');

            await retryHandler.execute(mockFunction);

            const stats = retryHandler.getStats();
            expect(stats.totalAttempts).toBe(1);
            expect(stats.totalRetries).toBe(1);
            expect(stats.successCount).toBe(1);
            expect(stats.averageAttempts).toBe(2);
        });

        test('should reset statistics correctly', () => {
            retryHandler.resetStats();

            const stats = retryHandler.getStats();
            expect(stats.totalAttempts).toBe(0);
            expect(stats.totalRetries).toBe(0);
            expect(stats.successCount).toBe(0);
        });
    });

    describe('Retry Strategies', () => {
        test('should identify network errors correctly', () => {
            const networkErrors = [
                new Error('network timeout'),
                new Error('connection refused'),
                new Error('fetch failed'),
                new Error('ECONNREFUSED')
            ];

            networkErrors.forEach(error => {
                expect(RetryStrategies.networkErrors(error)).toBe(true);
            });
        });

        test('should not retry client errors', () => {
            const clientErrors = [
                new Error('400 Bad Request'),
                new Error('401 Unauthorized'),
                new Error('404 Not Found')
            ];

            clientErrors.forEach(error => {
                expect(RetryStrategies.networkErrors(error)).toBe(false);
            });
        });

        test('should identify server errors correctly', () => {
            const serverErrors = [
                new Error('500 Internal Server Error'),
                new Error('502 Bad Gateway'),
                new Error('503 Service Unavailable')
            ];

            serverErrors.forEach(error => {
                expect(RetryStrategies.serverErrors(error)).toBe(true);
            });
        });
    });

    describe('Predefined Configurations', () => {
        test('should create retry handler with quick config', () => {
            const quickHandler = createRetryHandler('quick');
            expect(quickHandler).toBeInstanceOf(RetryHandler);
        });

        test('should create retry handler with standard config', () => {
            const standardHandler = createRetryHandler('standard');
            expect(standardHandler).toBeInstanceOf(RetryHandler);
        });

        test('should override config values', () => {
            const customHandler = createRetryHandler('quick', {
                maxAttempts: 10,
                name: 'custom-quick'
            });
            expect(customHandler).toBeInstanceOf(RetryHandler);
        });
    });
});

describe('ErrorMonitor', () => {
    let errorMonitor: ErrorMonitor;

    beforeEach(() => {
        errorMonitor = new ErrorMonitor(100); // Small event limit for testing
    });

    describe('Error Logging', () => {
        test('should log errors with different levels', () => {
            const debugId = errorMonitor.debug('unknown', 'Debug message');
            const infoId = errorMonitor.info('network', 'Info message');
            const warnId = errorMonitor.warn('authentication', 'Warning message');
            const errorId = errorMonitor.error('proxy', 'Error message');
            const fatalId = errorMonitor.fatal('circuit_breaker', 'Fatal message');

            expect(debugId).toBeDefined();
            expect(infoId).toBeDefined();
            expect(warnId).toBeDefined();
            expect(errorId).toBeDefined();
            expect(fatalId).toBeDefined();

            const metrics = errorMonitor.getMetrics();
            expect(metrics.totalErrors).toBe(5);
            expect(metrics.errorsByLevel.debug).toBe(1);
            expect(metrics.errorsByLevel.fatal).toBe(1);
        });

        test('should categorize errors correctly', () => {
            errorMonitor.error('network', 'Network error');
            errorMonitor.error('authentication', 'Auth error');
            errorMonitor.error('proxy', 'Proxy error');

            const metrics = errorMonitor.getMetrics();
            expect(metrics.errorsByCategory.network).toBe(1);
            expect(metrics.errorsByCategory.authentication).toBe(1);
            expect(metrics.errorsByCategory.proxy).toBe(1);
        });

        test('should generate fingerprints for error grouping', () => {
            // Log multiple errors to test fingerprinting
            errorMonitor.error('network', 'Connection timeout', new Error('ECONNREFUSED'));
            errorMonitor.error('network', 'Connection timeout', new Error('ECONNREFUSED'));
            errorMonitor.error('network', 'Different error', new Error('Different'));

            const metrics = errorMonitor.getMetrics();
            // Should have grouped errors (could be 2 or 3 depending on fingerprint logic)
            expect(metrics.topErrors.length).toBeGreaterThanOrEqual(2);
            expect(metrics.topErrors.length).toBeLessThanOrEqual(3);

            // Should track total errors correctly
            expect(metrics.totalErrors).toBe(3);
        });
    });

    describe('Error Search', () => {
        beforeEach(() => {
            errorMonitor.clear(); // Start fresh for each test

            errorMonitor.error('network', 'Network error 1');
            errorMonitor.warn('authentication', 'Auth warning');
            errorMonitor.error('proxy', 'Proxy error');
        });

        test('should search by error level', () => {
            const errors = errorMonitor.searchErrors({ level: 'error' });
            expect(errors).toHaveLength(2);
            expect(errors.every(e => e.level === 'error')).toBe(true);
        });

        test('should search by category', () => {
            const networkErrors = errorMonitor.searchErrors({ category: 'network' });
            expect(networkErrors).toHaveLength(1);
            expect(networkErrors[0].category).toBe('network');
        });

        test('should search by message content', () => {
            const authErrors = errorMonitor.searchErrors({ message: 'auth' });
            expect(authErrors).toHaveLength(1);
            expect(authErrors[0].message.toLowerCase()).toContain('auth');
        });

        test('should search by time range', () => {
            // Test basic time range functionality
            const oneHourAgo = new Date(Date.now() - 3600000);
            const oneHourFromNow = new Date(Date.now() + 3600000);

            // All errors should be after one hour ago
            const recentErrors = errorMonitor.searchErrors({ since: oneHourAgo });
            expect(recentErrors.length).toBeGreaterThanOrEqual(3);

            // No errors should be after one hour from now
            const futureErrors = errorMonitor.searchErrors({ since: oneHourFromNow });
            expect(futureErrors).toHaveLength(0);
        });
    });

    describe('Metrics and Statistics', () => {
        test('should calculate error rate correctly', () => {
            // Log some errors
            for (let i = 0; i < 5; i++) {
                errorMonitor.error('unknown', `Error ${i}`);
            }

            const metrics = errorMonitor.getMetrics();
            expect(metrics.errorRate).toBe(5); // 5 errors in the last minute
        });

        test('should maintain event limit', () => {
            // Log more errors than the limit
            for (let i = 0; i < 150; i++) {
                errorMonitor.error('unknown', `Error ${i}`);
            }

            const metrics = errorMonitor.getMetrics();
            expect(metrics.totalErrors).toBe(100); // Should be limited to 100
        });

        test('should provide top errors by frequency', () => {
            // Create different error patterns
            for (let i = 0; i < 3; i++) {
                errorMonitor.error('network', 'Frequent error', new Error('Same error'));
            }
            errorMonitor.error('proxy', 'Rare error', new Error('Different error'));

            const metrics = errorMonitor.getMetrics();
            expect(metrics.topErrors[0].count).toBe(3);
            expect(metrics.topErrors[1].count).toBe(1);
        });
    });

    describe('Alert Rules', () => {
        test('should trigger alert rules when conditions are met', () => {
            let alertTriggered = false;
            const testRule = {
                id: 'test-rule',
                name: 'Test Rule',
                condition: () => true,
                action: () => { alertTriggered = true; },
                enabled: true,
                cooldownMs: 1000
            };

            errorMonitor.addAlertRule(testRule);
            errorMonitor.error('unknown', 'Test error');

            expect(alertTriggered).toBe(true);
        });

        test('should respect cooldown periods', () => {
            let alertCount = 0;
            const testRule = {
                id: 'cooldown-rule',
                name: 'Cooldown Rule',
                condition: () => true,
                action: () => { alertCount++; },
                enabled: true,
                cooldownMs: 1000
            };

            errorMonitor.addAlertRule(testRule);
            errorMonitor.error('unknown', 'Error 1');
            errorMonitor.error('unknown', 'Error 2'); // Should not trigger due to cooldown

            expect(alertCount).toBe(1);
        });
    });
});

describe('CircuitBreakerManager', () => {
    let manager: CircuitBreakerManager;

    beforeEach(() => {
        manager = new CircuitBreakerManager({
            failureThreshold: 2,
            successThreshold: 1,
            timeout: 100
        });
    });

    test('should create and manage multiple circuit breakers', async () => {
        const cb1 = manager.getCircuitBreaker('service1');
        const cb2 = manager.getCircuitBreaker('service2');

        expect(cb1).toBeInstanceOf(CircuitBreaker);
        expect(cb2).toBeInstanceOf(CircuitBreaker);
        expect(cb1).not.toBe(cb2);
    });

    test('should return same circuit breaker for same name', () => {
        const cb1 = manager.getCircuitBreaker('service1');
        const cb2 = manager.getCircuitBreaker('service1');

        expect(cb1).toBe(cb2);
    });

    test('should execute function with circuit breaker protection', async () => {
        const mockFn = jest.fn().mockResolvedValue('success');

        const result = await manager.execute('test-service', mockFn);

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('should collect stats from all circuit breakers', () => {
        manager.getCircuitBreaker('service1');
        manager.getCircuitBreaker('service2');

        const allStats = manager.getAllStats();

        expect(allStats.size).toBe(2);
        expect(allStats.has('service1')).toBe(true);
        expect(allStats.has('service2')).toBe(true);
    });

    test('should reset all circuit breakers', async () => {
        const cb1 = manager.getCircuitBreaker('service1');
        const cb2 = manager.getCircuitBreaker('service2');

        // Force circuits open
        cb1.forceOpen();
        cb2.forceOpen();

        manager.resetAll();

        expect(cb1.getStats().state).toBe('CLOSED');
        expect(cb2.getStats().state).toBe('CLOSED');
    });
});

describe('Integration Tests', () => {
    test('should work together - circuit breaker with retry handler', async () => {
        const circuitBreaker = new CircuitBreaker({
            failureThreshold: 2,
            successThreshold: 1,
            timeout: 100,
            monitor: () => { },
            name: 'integration-test'
        });

        const retryHandler = new RetryHandler({
            maxAttempts: 3,
            baseDelay: 10,
            maxDelay: 100,
            backoffMultiplier: 2,
            jitter: false,
            retryableErrors: () => true,
            name: 'integration-retry'
        });

        const mockFn = jest.fn()
            .mockRejectedValueOnce(new Error('fail1'))
            .mockResolvedValue('success');

        // Use circuit breaker with retry handler
        const result = await retryHandler.execute(async () => {
            return await circuitBreaker.execute(mockFn);
        });

        expect(result).toBe('success');
        expect(mockFn).toHaveBeenCalledTimes(2); // One failure, then success
    });

    test('should integrate error monitoring with circuit breaker events', () => {
        const errorMonitor = new ErrorMonitor();
        let monitoredEvents: any[] = [];

        const circuitBreaker = new CircuitBreaker({
            failureThreshold: 1,
            successThreshold: 1,
            timeout: 100,
            monitor: (event) => {
                monitoredEvents.push(event);
                errorMonitor.warn('circuit_breaker', `Circuit ${event.circuitName}: ${event.state}`);
            },
            name: 'monitored-circuit'
        });

        // Force circuit to open
        circuitBreaker.forceOpen();

        expect(monitoredEvents).toHaveLength(1);
        expect(monitoredEvents[0].state).toBe('OPEN');

        const metrics = errorMonitor.getMetrics();
        expect(metrics.errorsByCategory.circuit_breaker).toBe(1);
    });
}); 