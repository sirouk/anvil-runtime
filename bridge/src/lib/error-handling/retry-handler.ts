/**
 * Retry Handler with Exponential Backoff
 * 
 * Provides configurable retry logic with exponential backoff, jitter,
 * and different retry strategies for various error types.
 */

export interface RetryConfig {
    maxAttempts: number; // Maximum number of retry attempts
    baseDelay: number; // Base delay in milliseconds
    maxDelay: number; // Maximum delay in milliseconds
    backoffMultiplier: number; // Multiplier for exponential backoff
    jitter: boolean; // Add random jitter to delay
    retryableErrors: (error: Error) => boolean; // Function to determine if error is retryable
    onRetry?: (attempt: number, error: Error, delay: number) => void; // Callback on retry
    onFailure?: (attempts: number, error: Error) => void; // Callback on final failure
    name?: string; // Name for logging
}

export interface RetryStats {
    totalAttempts: number;
    totalRetries: number;
    successCount: number;
    failureCount: number;
    averageAttempts: number;
    lastError?: Error;
    lastSuccessTime?: Date;
    lastFailureTime?: Date;
}

export interface RetryResult<T> {
    result?: T;
    success: boolean;
    attempts: number;
    totalDelay: number;
    error?: Error;
}

export class RetryHandler {
    private config: RetryConfig;
    private stats: RetryStats = {
        totalAttempts: 0,
        totalRetries: 0,
        successCount: 0,
        failureCount: 0,
        averageAttempts: 0
    };

    constructor(config: RetryConfig) {
        this.config = config;
    }

    /**
     * Execute a function with retry logic
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        const result = await this.executeWithStats(fn);

        if (result.success) {
            return result.result!;
        } else {
            throw result.error || new Error('Retry handler failed without specific error');
        }
    }

    /**
     * Execute a function with retry logic and return detailed stats
     */
    async executeWithStats<T>(fn: () => Promise<T>): Promise<RetryResult<T>> {
        let attempts = 0;
        let totalDelay = 0;
        let lastError: Error;

        this.stats.totalAttempts++;

        for (attempts = 1; attempts <= this.config.maxAttempts; attempts++) {
            try {
                const result = await fn();

                // Success!
                this.stats.successCount++;
                this.stats.lastSuccessTime = new Date();
                this.updateAverageAttempts(attempts);

                return {
                    result,
                    success: true,
                    attempts,
                    totalDelay
                };

            } catch (error) {
                lastError = error as Error;
                this.stats.lastError = lastError;

                // Check if this error is retryable
                if (!this.config.retryableErrors(lastError)) {
                    if (this.config.onFailure) {
                        this.config.onFailure(attempts, lastError);
                    }

                    this.stats.failureCount++;
                    this.stats.lastFailureTime = new Date();
                    this.updateAverageAttempts(attempts);

                    return {
                        success: false,
                        attempts,
                        totalDelay,
                        error: lastError
                    };
                }

                // If this is not the last attempt, wait before retrying
                if (attempts < this.config.maxAttempts) {
                    const delay = this.calculateDelay(attempts);
                    totalDelay += delay;
                    this.stats.totalRetries++;

                    if (this.config.onRetry) {
                        this.config.onRetry(attempts, lastError, delay);
                    }

                    await this.sleep(delay);
                }
            }
        }

        // All attempts failed
        if (this.config.onFailure) {
            this.config.onFailure(attempts - 1, lastError!);
        }

        this.stats.failureCount++;
        this.stats.lastFailureTime = new Date();
        this.updateAverageAttempts(attempts - 1);

        return {
            success: false,
            attempts: attempts - 1,
            totalDelay,
            error: lastError!
        };
    }

    /**
     * Calculate delay for exponential backoff with jitter
     */
    private calculateDelay(attempt: number): number {
        // Exponential backoff: baseDelay * (backoffMultiplier ^ (attempt - 1))
        let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1);

        // Cap at maximum delay
        delay = Math.min(delay, this.config.maxDelay);

        // Add jitter if enabled (±25% random variation)
        if (this.config.jitter) {
            const jitterRange = delay * 0.25;
            const jitter = (Math.random() - 0.5) * 2 * jitterRange;
            delay = Math.max(0, delay + jitter);
        }

        return Math.round(delay);
    }

    /**
     * Sleep for specified milliseconds
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Update running average of attempts
     */
    private updateAverageAttempts(attempts: number): void {
        const totalExecutions = this.stats.successCount + this.stats.failureCount;
        this.stats.averageAttempts = (
            (this.stats.averageAttempts * (totalExecutions - 1)) + attempts
        ) / totalExecutions;
    }

    /**
     * Get retry statistics
     */
    getStats(): RetryStats {
        return { ...this.stats };
    }

    /**
     * Reset statistics
     */
    resetStats(): void {
        this.stats = {
            totalAttempts: 0,
            totalRetries: 0,
            successCount: 0,
            failureCount: 0,
            averageAttempts: 0
        };
    }
}

/**
 * Predefined retry strategies for common scenarios
 */
export const RetryStrategies = {
    /**
     * Retry network errors but not client errors (4xx)
     */
    networkErrors: (error: Error): boolean => {
        const message = error.message.toLowerCase();
        const isNetworkError =
            message.includes('network') ||
            message.includes('timeout') ||
            message.includes('connection') ||
            message.includes('econnrefused') ||
            message.includes('enotfound') ||
            message.includes('fetch');

        // Don't retry client errors (4xx)
        const is4xxError = message.includes('400') ||
            message.includes('401') ||
            message.includes('403') ||
            message.includes('404');

        return isNetworkError && !is4xxError;
    },

    /**
     * Retry server errors (5xx) but not client errors (4xx)
     */
    serverErrors: (error: Error): boolean => {
        const message = error.message.toLowerCase();
        return message.includes('500') ||
            message.includes('502') ||
            message.includes('503') ||
            message.includes('504') ||
            message.includes('server error');
    },

    /**
     * Retry transient errors (network + server errors)
     */
    transientErrors: (error: Error): boolean => {
        return RetryStrategies.networkErrors(error) || RetryStrategies.serverErrors(error);
    },

    /**
     * Retry all errors (use with caution)
     */
    allErrors: (error: Error): boolean => {
        return true;
    },

    /**
     * Don't retry any errors
     */
    noRetry: (error: Error): boolean => {
        return false;
    }
};

/**
 * Predefined retry configurations for common scenarios
 */
export const RetryConfigs = {
    /**
     * Quick retry for fast operations
     */
    quick: {
        maxAttempts: 3,
        baseDelay: 100,
        maxDelay: 1000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: RetryStrategies.transientErrors
    } as Partial<RetryConfig>,

    /**
     * Standard retry for most operations
     */
    standard: {
        maxAttempts: 5,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: RetryStrategies.transientErrors
    } as Partial<RetryConfig>,

    /**
     * Aggressive retry for critical operations
     */
    aggressive: {
        maxAttempts: 10,
        baseDelay: 500,
        maxDelay: 30000,
        backoffMultiplier: 1.5,
        jitter: true,
        retryableErrors: RetryStrategies.transientErrors
    } as Partial<RetryConfig>,

    /**
     * Conservative retry for expensive operations
     */
    conservative: {
        maxAttempts: 3,
        baseDelay: 2000,
        maxDelay: 20000,
        backoffMultiplier: 3,
        jitter: true,
        retryableErrors: RetryStrategies.networkErrors
    } as Partial<RetryConfig>
};

/**
 * Create a retry handler with predefined configuration
 */
export function createRetryHandler(
    configName: keyof typeof RetryConfigs,
    overrides?: Partial<RetryConfig>
): RetryHandler {
    const baseConfig = RetryConfigs[configName];
    const config = {
        ...baseConfig,
        ...overrides,
        name: overrides?.name || configName
    } as RetryConfig;

    return new RetryHandler(config);
}

/**
 * Utility function to retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {}
): Promise<T> {
    const retryHandler = new RetryHandler({
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
        jitter: true,
        retryableErrors: RetryStrategies.transientErrors,
        ...config
    } as RetryConfig);

    return retryHandler.execute(fn);
} 