/**
 * HTTP Request Logger with Correlation IDs
 * 
 * Provides comprehensive request/response logging with:
 * - Unique correlation IDs for request tracking
 * - Performance metrics
 * - Error tracking
 * - Integration with monitoring systems
 */

import { NextRequest } from 'next/server';

export interface RequestLogEntry {
    correlationId: string;
    timestamp: string;
    method: string;
    path: string;
    query?: Record<string, string>;
    headers: Record<string, string>;
    body?: any;
    ip?: string;
    userAgent?: string;
    referer?: string;
    sessionId?: string;
    userId?: string;
}

export interface ResponseLogEntry {
    correlationId: string;
    timestamp: string;
    status: number;
    headers: Record<string, string>;
    body?: any;
    error?: {
        message: string;
        stack?: string;
        code?: string;
    };
    duration: number; // in milliseconds
    size?: number; // response size in bytes
}

export interface RequestLogRecord {
    request: RequestLogEntry;
    response?: ResponseLogEntry;
    metadata: {
        service: string;
        environment: string;
        version: string;
        startTime: number;
        endTime?: number;
        duration?: number;
        tags?: string[];
    };
}

export interface LoggerConfig {
    service: string;
    environment: string;
    version: string;
    enableConsoleLog: boolean;
    enableFileLog: boolean;
    logFilePath?: string;
    maxLogSize?: number; // in MB
    retentionDays?: number;
    sensitiveHeaders?: string[];
    sanitizeBody?: boolean;
    debug?: boolean;
}

export class RequestLogger {
    private config: LoggerConfig;
    private logs: Map<string, RequestLogRecord> = new Map();
    private logRotationTimer?: NodeJS.Timeout;

    constructor(config: Partial<LoggerConfig> = {}) {
        this.config = {
            service: 'anvil-bridge',
            environment: process.env.NODE_ENV || 'development',
            version: process.env.APP_VERSION || '1.0.0',
            enableConsoleLog: true,
            enableFileLog: false,
            maxLogSize: 100, // 100MB
            retentionDays: 7,
            sensitiveHeaders: ['authorization', 'cookie', 'x-api-key', 'x-auth-token'],
            sanitizeBody: true,
            debug: process.env.NODE_ENV === 'development',
            ...config
        };

        // Start log rotation if file logging is enabled
        if (this.config.enableFileLog) {
            this.startLogRotation();
        }
    }

    /**
     * Generate a unique correlation ID
     */
    generateCorrelationId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 9);
        const counter = this.getNextCounter().toString(36).padStart(4, '0');
        return `${this.config.service}-${timestamp}-${random}-${counter}`;
    }

    private counter = 0;
    private getNextCounter(): number {
        this.counter = (this.counter + 1) % 10000;
        return this.counter;
    }

    /**
     * Log an incoming HTTP request
     */
    logRequest(
        request: NextRequest,
        path: string,
        correlationId?: string,
        additionalData?: {
            sessionId?: string;
            userId?: string;
            tags?: string[];
        }
    ): string {
        const id = correlationId || this.generateCorrelationId();
        const timestamp = new Date().toISOString();

        // Extract request details
        const method = request.method;
        const url = new URL(request.url);
        const query = Object.fromEntries(url.searchParams.entries());

        // Extract and sanitize headers
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            if (this.config.sensitiveHeaders?.includes(key.toLowerCase())) {
                headers[key] = '[REDACTED]';
            } else {
                headers[key] = value;
            }
        });

        // Extract metadata
        const ip = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';
        const userAgent = request.headers.get('user-agent') || 'unknown';
        const referer = request.headers.get('referer') || undefined;

        // Create log entry
        const logEntry: RequestLogEntry = {
            correlationId: id,
            timestamp,
            method,
            path,
            query: Object.keys(query).length > 0 ? query : undefined,
            headers,
            ip,
            userAgent,
            referer,
            sessionId: additionalData?.sessionId,
            userId: additionalData?.userId
        };

        // Create log record
        const logRecord: RequestLogRecord = {
            request: logEntry,
            metadata: {
                service: this.config.service,
                environment: this.config.environment,
                version: this.config.version,
                startTime: Date.now(),
                tags: additionalData?.tags
            }
        };

        // Store log record
        this.logs.set(id, logRecord);

        // Log to console if enabled
        if (this.config.enableConsoleLog) {
            this.consoleLogRequest(logEntry);
        }

        // Log to file if enabled
        if (this.config.enableFileLog) {
            this.fileLogRequest(logEntry);
        }

        return id;
    }

    /**
     * Log request body (called separately to handle async body parsing)
     */
    logRequestBody(correlationId: string, body: any): void {
        const logRecord = this.logs.get(correlationId);
        if (!logRecord) return;

        // Sanitize body if needed
        const sanitizedBody = this.config.sanitizeBody ?
            this.sanitizeData(body) : body;

        logRecord.request.body = sanitizedBody;

        if (this.config.debug && this.config.enableConsoleLog) {
            console.log(`📥 [${correlationId}] Request body:`,
                typeof sanitizedBody === 'object' ?
                    JSON.stringify(sanitizedBody, null, 2) : sanitizedBody
            );
        }
    }

    /**
     * Log an HTTP response
     */
    logResponse(
        correlationId: string,
        status: number,
        headers: Record<string, string>,
        body?: any,
        error?: Error
    ): void {
        const logRecord = this.logs.get(correlationId);
        if (!logRecord) return;

        const timestamp = new Date().toISOString();
        const endTime = Date.now();
        const duration = endTime - logRecord.metadata.startTime;

        // Sanitize response body if needed
        const sanitizedBody = body && this.config.sanitizeBody ?
            this.sanitizeData(body) : body;

        // Calculate response size
        let size = 0;
        if (body) {
            if (typeof body === 'string') {
                size = Buffer.byteLength(body);
            } else if (Buffer.isBuffer(body)) {
                size = body.length;
            } else if (body instanceof ArrayBuffer) {
                size = body.byteLength;
            } else if (typeof body === 'object') {
                size = Buffer.byteLength(JSON.stringify(body));
            }
        }

        // Create response log entry
        const responseEntry: ResponseLogEntry = {
            correlationId,
            timestamp,
            status,
            headers,
            body: sanitizedBody,
            duration,
            size,
            error: error ? {
                message: error.message,
                stack: this.config.debug ? error.stack : undefined,
                code: (error as any).code
            } : undefined
        };

        // Update log record
        logRecord.response = responseEntry;
        logRecord.metadata.endTime = endTime;
        logRecord.metadata.duration = duration;

        // Log to console if enabled
        if (this.config.enableConsoleLog) {
            this.consoleLogResponse(logRecord);
        }

        // Log to file if enabled
        if (this.config.enableFileLog) {
            this.fileLogResponse(logRecord);
        }

        // Clean up old logs to prevent memory leak
        this.cleanupOldLogs();
    }

    /**
     * Get log record by correlation ID
     */
    getLog(correlationId: string): RequestLogRecord | undefined {
        return this.logs.get(correlationId);
    }

    /**
     * Get all logs (with optional filtering)
     */
    getLogs(filter?: {
        startTime?: number;
        endTime?: number;
        status?: number;
        method?: string;
        path?: string;
        userId?: string;
        hasError?: boolean;
    }): RequestLogRecord[] {
        let logs = Array.from(this.logs.values());

        if (filter) {
            logs = logs.filter(log => {
                if (filter.startTime && log.metadata.startTime < filter.startTime) return false;
                if (filter.endTime && log.metadata.startTime > filter.endTime) return false;
                if (filter.status && log.response?.status !== filter.status) return false;
                if (filter.method && log.request.method !== filter.method) return false;
                if (filter.path && !log.request.path.includes(filter.path)) return false;
                if (filter.userId && log.request.userId !== filter.userId) return false;
                if (filter.hasError !== undefined &&
                    (!!log.response?.error !== filter.hasError)) return false;
                return true;
            });
        }

        return logs;
    }

    /**
     * Get request metrics
     */
    getMetrics(): {
        totalRequests: number;
        averageResponseTime: number;
        errorRate: number;
        statusCodeDistribution: Record<number, number>;
        methodDistribution: Record<string, number>;
        slowestEndpoints: Array<{ path: string; averageTime: number; count: number }>;
    } {
        const logs = Array.from(this.logs.values());
        const completedLogs = logs.filter(log => log.response);

        // Calculate metrics
        const totalRequests = logs.length;
        const totalResponseTime = completedLogs.reduce((sum, log) =>
            sum + (log.response?.duration || 0), 0);
        const averageResponseTime = completedLogs.length > 0 ?
            totalResponseTime / completedLogs.length : 0;

        const errors = completedLogs.filter(log =>
            log.response && (log.response.status >= 400 || log.response.error));
        const errorRate = completedLogs.length > 0 ?
            errors.length / completedLogs.length : 0;

        // Status code distribution
        const statusCodeDistribution: Record<number, number> = {};
        completedLogs.forEach(log => {
            if (log.response) {
                statusCodeDistribution[log.response.status] =
                    (statusCodeDistribution[log.response.status] || 0) + 1;
            }
        });

        // Method distribution
        const methodDistribution: Record<string, number> = {};
        logs.forEach(log => {
            methodDistribution[log.request.method] =
                (methodDistribution[log.request.method] || 0) + 1;
        });

        // Slowest endpoints
        const endpointTimes: Record<string, { totalTime: number; count: number }> = {};
        completedLogs.forEach(log => {
            if (log.response) {
                const path = log.request.path;
                if (!endpointTimes[path]) {
                    endpointTimes[path] = { totalTime: 0, count: 0 };
                }
                endpointTimes[path].totalTime += log.response.duration;
                endpointTimes[path].count += 1;
            }
        });

        const slowestEndpoints = Object.entries(endpointTimes)
            .map(([path, data]) => ({
                path,
                averageTime: data.totalTime / data.count,
                count: data.count
            }))
            .sort((a, b) => b.averageTime - a.averageTime)
            .slice(0, 10);

        return {
            totalRequests,
            averageResponseTime,
            errorRate,
            statusCodeDistribution,
            methodDistribution,
            slowestEndpoints
        };
    }

    /**
     * Console logging for requests
     */
    private consoleLogRequest(entry: RequestLogEntry): void {
        const emoji = this.getMethodEmoji(entry.method);
        console.log(`${emoji} [${entry.correlationId}] ${entry.method} ${entry.path}`);

        if (this.config.debug) {
            console.log(`   IP: ${entry.ip}`);
            console.log(`   User-Agent: ${entry.userAgent}`);
            if (entry.sessionId) console.log(`   Session: ${entry.sessionId}`);
            if (entry.userId) console.log(`   User: ${entry.userId}`);
        }
    }

    /**
     * Console logging for responses
     */
    private consoleLogResponse(record: RequestLogRecord): void {
        if (!record.response) return;

        const emoji = this.getStatusEmoji(record.response.status);
        const duration = record.response.duration;
        const size = this.formatBytes(record.response.size || 0);

        console.log(
            `${emoji} [${record.request.correlationId}] ` +
            `${record.response.status} ${record.request.method} ${record.request.path} ` +
            `(${duration}ms, ${size})`
        );

        if (record.response.error && this.config.debug) {
            console.error(`   Error: ${record.response.error.message}`);
        }
    }

    /**
     * Get emoji for HTTP method
     */
    private getMethodEmoji(method: string): string {
        switch (method) {
            case 'GET': return '📄';
            case 'POST': return '📮';
            case 'PUT': return '📝';
            case 'DELETE': return '🗑️';
            case 'PATCH': return '🔧';
            case 'OPTIONS': return '⚙️';
            default: return '📡';
        }
    }

    /**
     * Get emoji for HTTP status code
     */
    private getStatusEmoji(status: number): string {
        if (status >= 200 && status < 300) return '✅';
        if (status >= 300 && status < 400) return '↪️';
        if (status >= 400 && status < 500) return '⚠️';
        if (status >= 500) return '❌';
        return '❓';
    }

    /**
     * Format bytes to human readable
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Sanitize sensitive data
     */
    private sanitizeData(data: any): any {
        if (!data) return data;

        if (typeof data === 'string') {
            // Check for common patterns
            if (data.includes('password') || data.includes('token') ||
                data.includes('secret') || data.includes('key')) {
                return '[SANITIZED]';
            }
            return data;
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeData(item));
        }

        if (typeof data === 'object') {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(data)) {
                const lowerKey = key.toLowerCase();
                if (lowerKey.includes('password') || lowerKey.includes('token') ||
                    lowerKey.includes('secret') || lowerKey.includes('key') ||
                    lowerKey.includes('auth')) {
                    sanitized[key] = '[SANITIZED]';
                } else {
                    sanitized[key] = this.sanitizeData(value);
                }
            }
            return sanitized;
        }

        return data;
    }

    /**
     * File logging for requests (stub - implement based on requirements)
     */
    private fileLogRequest(entry: RequestLogEntry): void {
        // TODO: Implement file logging
        // This could write to a file, send to a logging service, etc.
    }

    /**
     * File logging for responses (stub - implement based on requirements)
     */
    private fileLogResponse(record: RequestLogRecord): void {
        // TODO: Implement file logging
        // This could write to a file, send to a logging service, etc.
    }

    /**
     * Clean up old logs to prevent memory leak
     */
    private cleanupOldLogs(): void {
        const maxAge = 3600000; // 1 hour
        const now = Date.now();

        for (const [id, record] of this.logs.entries()) {
            if (now - record.metadata.startTime > maxAge) {
                this.logs.delete(id);
            }
        }
    }

    /**
     * Start log rotation timer
     */
    private startLogRotation(): void {
        // Rotate logs daily
        const rotationInterval = 24 * 60 * 60 * 1000; // 24 hours

        this.logRotationTimer = setInterval(() => {
            this.rotateLogs();
        }, rotationInterval);
    }

    /**
     * Rotate logs (stub - implement based on requirements)
     */
    private rotateLogs(): void {
        // TODO: Implement log rotation
        // This could archive old logs, compress them, upload to S3, etc.
    }

    /**
     * Shutdown logger
     */
    shutdown(): void {
        if (this.logRotationTimer) {
            clearInterval(this.logRotationTimer);
        }
        this.logs.clear();
    }
}

// Export singleton instance
export const globalRequestLogger = new RequestLogger(); 