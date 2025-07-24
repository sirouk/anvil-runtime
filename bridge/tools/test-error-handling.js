/**
 * Error Handling System Integration Demo
 * 
 * Demonstrates circuit breaker, retry logic, error monitoring,
 * and WebSocket fallback working together in realistic scenarios.
 */

const { CircuitBreaker, globalCircuitBreakerManager } = require('../src/lib/error-handling/circuit-breaker');
const { createRetryHandler, RetryStrategies } = require('../src/lib/error-handling/retry-handler');
const { globalErrorMonitor } = require('../src/lib/error-handling/error-monitor');

// Simulate different types of services with varying reliability
class UnreliableService {
    constructor(name, failureRate = 0.3) {
        this.name = name;
        this.failureRate = failureRate;
        this.callCount = 0;
    }

    async call(data) {
        this.callCount++;

        if (Math.random() < this.failureRate) {
            const error = new Error(`${this.name} service failure (call #${this.callCount})`);
            globalErrorMonitor.error('network', `${this.name} service failed`, error, {
                callCount: this.callCount,
                data: data?.slice?.(0, 50) // Limit data logging
            });
            throw error;
        }

        globalErrorMonitor.info('network', `${this.name} service succeeded`, {
            callCount: this.callCount
        });
        return `${this.name} processed: ${data}`;
    }
}

async function demonstrateCircuitBreaker() {
    console.log('\n🔌 Circuit Breaker Demo');
    console.log('========================');

    const unreliableService = new UnreliableService('payment-api', 0.8); // 80% failure rate

    const circuitBreaker = new CircuitBreaker({
        failureThreshold: 3,
        successThreshold: 2,
        timeout: 2000,
        monitor: (event) => {
            console.log(`Circuit [${event.circuitName}]: ${event.state} at ${event.timestamp.toISOString()}`);
        },
        name: 'payment-service'
    });

    // Try to call the service multiple times
    for (let i = 1; i <= 8; i++) {
        try {
            console.log(`\nAttempt ${i}:`);
            const result = await circuitBreaker.execute(() => unreliableService.call(`transaction-${i}`));
            console.log(`✅ Success: ${result}`);
        } catch (error) {
            console.log(`❌ Failed: ${error.message}`);
        }

        // Show circuit stats
        const stats = circuitBreaker.getStats();
        console.log(`   State: ${stats.state}, Failures: ${stats.failureCount}, Successes: ${stats.successCount}`);

        // Add delay between attempts
        await new Promise(resolve => setTimeout(resolve, 300));
    }
}

async function demonstrateRetryLogic() {
    console.log('\n🔄 Retry Logic Demo');
    console.log('==================');

    const flaky服务 = new UnreliableService('user-service', 0.6); // 60% failure rate

    const retryHandler = createRetryHandler('aggressive', {
        onRetry: (attempt, error, delay) => {
            console.log(`   Retry attempt ${attempt} in ${delay}ms: ${error.message}`);
        },
        onFailure: (attempts, error) => {
            console.log(`   Final failure after ${attempts} attempts: ${error.message}`);
        }
    });

    // Try several operations with retry logic
    for (let i = 1; i <= 3; i++) {
        try {
            console.log(`\nRetry Operation ${i}:`);
            const result = await retryHandler.execute(() => flaky服务.call(`user-data-${i}`));
            console.log(`✅ Eventually succeeded: ${result}`);
        } catch (error) {
            console.log(`❌ All retries failed: ${error.message}`);
        }

        // Show retry stats
        const stats = retryHandler.getStats();
        console.log(`   Retry Stats: ${stats.totalAttempts} attempts, ${stats.successCount} successes, avg: ${stats.averageAttempts.toFixed(1)}`);
    }
}

async function demonstrateIntegratedSystem() {
    console.log('\n🏗️ Integrated System Demo');
    console.log('==========================');

    // Create a complex service that uses both circuit breaker and retry logic
    const criticalService = new UnreliableService('critical-api', 0.5);

    // Set up circuit breaker with error monitoring
    const serviceBreaker = globalCircuitBreakerManager.getCircuitBreaker('critical-service', {
        failureThreshold: 2,
        successThreshold: 1,
        timeout: 1000,
        monitor: (event) => {
            globalErrorMonitor.warn('circuit_breaker', `Critical service circuit ${event.state}`, undefined, {
                circuitName: event.circuitName,
                timestamp: event.timestamp
            });
        }
    });

    // Set up retry handler with smart error detection
    const smartRetry = createRetryHandler('standard', {
        retryableErrors: RetryStrategies.transientErrors,
        onRetry: (attempt, error, delay) => {
            globalErrorMonitor.info('retry', `Retrying critical operation`, error, {
                attempt,
                delay,
                isRetryable: true
            });
        }
    });

    // Combined service function
    async function callCriticalService(operation) {
        return await smartRetry.execute(async () => {
            return await serviceBreaker.execute(async () => {
                return await criticalService.call(operation);
            });
        });
    }

    // Perform multiple critical operations
    const operations = ['process-payment', 'update-inventory', 'send-notification', 'audit-log', 'backup-data'];

    for (const operation of operations) {
        try {
            console.log(`\nExecuting: ${operation}`);
            const result = await callCriticalService(operation);
            console.log(`✅ ${result}`);
        } catch (error) {
            console.log(`❌ Critical failure: ${error.message}`);
        }
    }

    // Show final statistics
    console.log('\n📊 Final System Statistics:');
    const allCircuitStats = globalCircuitBreakerManager.getAllStats();
    for (const [name, stats] of allCircuitStats) {
        console.log(`   Circuit [${name}]: ${stats.state} - ${stats.totalRequests} requests, ${stats.totalFailures} failures`);
    }

    const retryStats = smartRetry.getStats();
    console.log(`   Retry Handler: ${retryStats.totalAttempts} attempts, ${retryStats.successCount} successes`);
}

async function showErrorMonitoringDashboard() {
    console.log('\n📈 Error Monitoring Dashboard');
    console.log('=============================');

    const metrics = globalErrorMonitor.getMetrics();

    console.log(`Total Errors: ${metrics.totalErrors}`);
    console.log(`Error Rate: ${metrics.errorRate} errors/minute`);

    console.log('\nErrors by Level:');
    for (const [level, count] of Object.entries(metrics.errorsByLevel)) {
        if (count > 0) {
            console.log(`   ${level}: ${count}`);
        }
    }

    console.log('\nErrors by Category:');
    for (const [category, count] of Object.entries(metrics.errorsByCategory)) {
        if (count > 0) {
            console.log(`   ${category}: ${count}`);
        }
    }

    console.log('\nTop Errors:');
    metrics.topErrors.slice(0, 5).forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.message} (${error.count} times)`);
    });

    console.log('\nRecent Errors:');
    metrics.recentErrors.slice(-3).forEach(error => {
        console.log(`   [${error.timestamp.toISOString()}] ${error.level.toUpperCase()}: ${error.message}`);
    });
}

async function main() {
    console.log('🚀 Error Handling System Integration Demo');
    console.log('==========================================');

    try {
        await demonstrateCircuitBreaker();
        await demonstrateRetryLogic();
        await demonstrateIntegratedSystem();
        await showErrorMonitoringDashboard();

        console.log('\n✅ Demo completed successfully!');
        console.log('\nKey Features Demonstrated:');
        console.log('• Circuit breaker prevents cascading failures');
        console.log('• Retry logic with exponential backoff handles transient errors');
        console.log('• Error monitoring tracks and categorizes all errors');
        console.log('• Integrated system provides robust error handling');
        console.log('• Real-time statistics and monitoring dashboard');

    } catch (error) {
        console.error('\n❌ Demo failed:', error);
        globalErrorMonitor.fatal('unknown', 'Demo system failure', error);
    }
}

// Add graceful shutdown
process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down gracefully...');
    showErrorMonitoringDashboard().then(() => {
        process.exit(0);
    });
});

if (require.main === module) {
    main().catch(console.error);
}

module.exports = {
    demonstrateCircuitBreaker,
    demonstrateRetryLogic,
    demonstrateIntegratedSystem,
    showErrorMonitoringDashboard
}; 