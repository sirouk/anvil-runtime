/**
 * Error Monitoring and Logging System
 * 
 * Provides comprehensive error tracking, metrics collection,
 * and alerting capabilities for production monitoring.
 */

export interface ErrorEvent {
    id: string;
    timestamp: Date;
    level: ErrorLevel;
    category: ErrorCategory;
    message: string;
    error?: Error;
    context?: Record<string, any>;
    userAgent?: string;
    url?: string;
    userId?: string;
    sessionId?: string;
    stackTrace?: string;
    fingerprint?: string; // Unique identifier for grouping similar errors
}

export type ErrorLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type ErrorCategory = 'network' | 'authentication' | 'validation' | 'proxy' | 'circuit_breaker' | 'retry' | 'file_upload' | 'websocket' | 'unknown';

export interface ErrorMetrics {
    totalErrors: number;
    errorsByLevel: Record<ErrorLevel, number>;
    errorsByCategory: Record<ErrorCategory, number>;
    recentErrors: ErrorEvent[];
    errorRate: number; // errors per minute
    topErrors: Array<{ fingerprint: string; count: number; lastSeen: Date; message: string }>;
}

export interface AlertRule {
    id: string;
    name: string;
    condition: (metrics: ErrorMetrics, event?: ErrorEvent) => boolean;
    action: (metrics: ErrorMetrics, event?: ErrorEvent) => void;
    enabled: boolean;
    cooldownMs: number; // Minimum time between alerts
    lastTriggered?: Date;
}

export class ErrorMonitor {
    private events: ErrorEvent[] = [];
    private maxEvents: number = 1000; // Keep last 1000 events
    private alertRules: Map<string, AlertRule> = new Map();
    private errorCounts: Map<string, number> = new Map(); // fingerprint -> count
    private startTime: Date = new Date();

    constructor(maxEvents: number = 1000) {
        this.maxEvents = maxEvents;
        this.setupDefaultAlertRules();
    }

    /**
     * Log an error event
     */
    logError(
        level: ErrorLevel,
        category: ErrorCategory,
        message: string,
        error?: Error,
        context?: Record<string, any>
    ): string {
        const event: ErrorEvent = {
            id: this.generateEventId(),
            timestamp: new Date(),
            level,
            category,
            message,
            error,
            context,
            stackTrace: error?.stack,
            fingerprint: this.generateFingerprint(message, error, category)
        };

        // Add event to collection
        this.events.push(event);

        // Maintain max events limit
        if (this.events.length > this.maxEvents) {
            this.events = this.events.slice(-this.maxEvents);
        }

        // Update error counts
        const count = this.errorCounts.get(event.fingerprint!) || 0;
        this.errorCounts.set(event.fingerprint!, count + 1);

        // Check alert rules
        this.checkAlertRules(event);

        // Log to console with appropriate level
        this.logToConsole(event);

        return event.id;
    }

    /**
     * Convenience methods for different error levels
     */
    debug(category: ErrorCategory, message: string, context?: Record<string, any>): string {
        return this.logError('debug', category, message, undefined, context);
    }

    info(category: ErrorCategory, message: string, context?: Record<string, any>): string {
        return this.logError('info', category, message, undefined, context);
    }

    warn(category: ErrorCategory, message: string, error?: Error, context?: Record<string, any>): string {
        return this.logError('warn', category, message, error, context);
    }

    error(category: ErrorCategory, message: string, error?: Error, context?: Record<string, any>): string {
        return this.logError('error', category, message, error, context);
    }

    fatal(category: ErrorCategory, message: string, error?: Error, context?: Record<string, any>): string {
        return this.logError('fatal', category, message, error, context);
    }

    /**
     * Get error metrics
     */
    getMetrics(): ErrorMetrics {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        const recentErrors = this.events.filter(e => e.timestamp.getTime() > oneMinuteAgo);

        const errorsByLevel: Record<ErrorLevel, number> = {
            debug: 0,
            info: 0,
            warn: 0,
            error: 0,
            fatal: 0
        };

        const errorsByCategory: Record<ErrorCategory, number> = {
            network: 0,
            authentication: 0,
            validation: 0,
            proxy: 0,
            circuit_breaker: 0,
            retry: 0,
            file_upload: 0,
            websocket: 0,
            unknown: 0
        };

        // Count errors by level and category
        for (const event of this.events) {
            errorsByLevel[event.level]++;
            errorsByCategory[event.category]++;
        }

        // Get top errors by frequency
        const topErrors = Array.from(this.errorCounts.entries())
            .map(([fingerprint, count]) => {
                const lastEvent = this.events
                    .slice()
                    .reverse()
                    .find(e => e.fingerprint === fingerprint);
                return {
                    fingerprint,
                    count,
                    lastSeen: lastEvent?.timestamp || new Date(),
                    message: lastEvent?.message || 'Unknown error'
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            totalErrors: this.events.length,
            errorsByLevel,
            errorsByCategory,
            recentErrors: recentErrors.slice(-50), // Last 50 recent errors
            errorRate: recentErrors.length, // errors per minute
            topErrors
        };
    }

    /**
     * Add custom alert rule
     */
    addAlertRule(rule: AlertRule): void {
        this.alertRules.set(rule.id, rule);
    }

    /**
     * Remove alert rule
     */
    removeAlertRule(ruleId: string): void {
        this.alertRules.delete(ruleId);
    }

    /**
     * Get all alert rules
     */
    getAlertRules(): AlertRule[] {
        return Array.from(this.alertRules.values());
    }

    /**
     * Search errors by criteria
     */
    searchErrors(criteria: {
        level?: ErrorLevel;
        category?: ErrorCategory;
        since?: Date;
        until?: Date;
        message?: string;
        fingerprint?: string;
    }): ErrorEvent[] {
        return this.events.filter(event => {
            if (criteria.level && event.level !== criteria.level) return false;
            if (criteria.category && event.category !== criteria.category) return false;
            if (criteria.since && event.timestamp < criteria.since) return false;
            if (criteria.until && event.timestamp > criteria.until) return false;
            if (criteria.message && !event.message.toLowerCase().includes(criteria.message.toLowerCase())) return false;
            if (criteria.fingerprint && event.fingerprint !== criteria.fingerprint) return false;
            return true;
        });
    }

    /**
     * Clear all events and reset metrics
     */
    clear(): void {
        this.events = [];
        this.errorCounts.clear();
        this.startTime = new Date();
    }

    /**
     * Generate unique event ID
     */
    private generateEventId(): string {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Generate fingerprint for error grouping
     */
    private generateFingerprint(message: string, error?: Error, category?: ErrorCategory): string {
        // Create a fingerprint based on error type, message, and stack trace location
        const errorType = error?.constructor.name || 'Unknown';
        const stackLocation = error?.stack?.split('\n')[1]?.trim() || '';
        const messageHash = message.replace(/\d+/g, 'N'); // Replace numbers with N for grouping

        return `${category}_${errorType}_${messageHash}_${stackLocation}`.replace(/[^a-zA-Z0-9_]/g, '_');
    }

    /**
     * Check alert rules and trigger if conditions are met
     */
    private checkAlertRules(event: ErrorEvent): void {
        const metrics = this.getMetrics();

        for (const rule of this.alertRules.values()) {
            if (!rule.enabled) continue;

            // Check cooldown
            if (rule.lastTriggered) {
                const timeSinceLastAlert = Date.now() - rule.lastTriggered.getTime();
                if (timeSinceLastAlert < rule.cooldownMs) continue;
            }

            // Check condition
            if (rule.condition(metrics, event)) {
                try {
                    rule.action(metrics, event);
                    rule.lastTriggered = new Date();
                } catch (alertError) {
                    console.error('Alert rule action failed:', alertError);
                }
            }
        }
    }

    /**
     * Log event to console with appropriate formatting
     */
    private logToConsole(event: ErrorEvent): void {
        const prefix = `[${event.timestamp.toISOString()}] ${event.level.toUpperCase()} [${event.category}]`;
        const message = `${prefix} ${event.message}`;

        switch (event.level) {
            case 'debug':
                console.debug(message, event.context);
                break;
            case 'info':
                console.info(message, event.context);
                break;
            case 'warn':
                console.warn(message, event.context, event.error);
                break;
            case 'error':
                console.error(message, event.context, event.error);
                break;
            case 'fatal':
                console.error(`🚨 FATAL: ${message}`, event.context, event.error);
                break;
        }
    }

    /**
     * Setup default alert rules
     */
    private setupDefaultAlertRules(): void {
        // High error rate alert
        this.addAlertRule({
            id: 'high_error_rate',
            name: 'High Error Rate',
            condition: (metrics) => metrics.errorRate > 10, // More than 10 errors per minute
            action: (metrics) => {
                console.error(`🚨 HIGH ERROR RATE: ${metrics.errorRate} errors in the last minute`);
            },
            enabled: true,
            cooldownMs: 300000 // 5 minutes
        });

        // Fatal error alert
        this.addAlertRule({
            id: 'fatal_error',
            name: 'Fatal Error',
            condition: (metrics, event) => event?.level === 'fatal',
            action: (metrics, event) => {
                console.error(`🚨 FATAL ERROR: ${event?.message}`, event?.error);
            },
            enabled: true,
            cooldownMs: 60000 // 1 minute
        });

        // Circuit breaker open alert
        this.addAlertRule({
            id: 'circuit_breaker_open',
            name: 'Circuit Breaker Open',
            condition: (metrics, event) =>
                event?.category === 'circuit_breaker' &&
                event?.message.includes('OPEN'),
            action: (metrics, event) => {
                console.warn(`⚡ CIRCUIT BREAKER OPEN: ${event?.message}`);
            },
            enabled: true,
            cooldownMs: 300000 // 5 minutes
        });
    }
}

// Global error monitor instance
export const globalErrorMonitor = new ErrorMonitor();

/**
 * Utility function to wrap async functions with error monitoring
 */
export function withErrorMonitoring<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    category: ErrorCategory,
    context?: Record<string, any>
): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
        try {
            return await fn(...args);
        } catch (error) {
            globalErrorMonitor.error(
                category,
                `Error in ${fn.name || 'anonymous function'}`,
                error as Error,
                { ...context, args: args.slice(0, 2) } // Limit args to avoid sensitive data
            );
            throw error;
        }
    };
}

/**
 * Utility function to monitor function execution
 */
export function monitorExecution<T extends any[], R>(
    fn: (...args: T) => R,
    category: ErrorCategory,
    context?: Record<string, any>
): (...args: T) => R {
    return (...args: T): R => {
        try {
            const result = fn(...args);
            return result;
        } catch (error) {
            globalErrorMonitor.error(
                category,
                `Error in ${fn.name || 'anonymous function'}`,
                error as Error,
                { ...context, args: args.slice(0, 2) }
            );
            throw error;
        }
    };
} 