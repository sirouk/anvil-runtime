/**
 * Request Logger Tests
 */

import { RequestLogger } from '@/lib/logging/request-logger';
import { NextRequest } from 'next/server';

// Mock NextRequest
function createMockRequest(options: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    cookies?: Record<string, string>;
    body?: any;
} = {}): NextRequest {
    const {
        method = 'GET',
        url = 'http://localhost:3000/api/test',
        headers = {},
        cookies = {},
        body
    } = options;

    // Create a mock request with the necessary properties
    const mockHeaders = new Headers(headers);

    const mockRequest = {
        method,
        url,
        headers: mockHeaders,
        cookies: {
            get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined
        },
        nextUrl: new URL(url),
        json: async () => body,
        text: async () => JSON.stringify(body),
        arrayBuffer: async () => new ArrayBuffer(0)
    } as unknown as NextRequest;

    return mockRequest;
}

describe('Request Logger Tests', () => {
    let logger: RequestLogger;

    beforeEach(() => {
        logger = new RequestLogger({
            enableConsoleLog: false,
            debug: false
        });
    });

    afterEach(() => {
        logger.shutdown();
    });

    describe('Correlation ID Generation', () => {
        test('should generate unique correlation IDs', () => {
            const ids = new Set();
            for (let i = 0; i < 1000; i++) {
                const id = logger.generateCorrelationId();
                expect(id).toMatch(/^anvil-bridge-[a-z0-9]+-[a-z0-9]+-[a-z0-9]{4}$/);
                ids.add(id);
            }
            expect(ids.size).toBe(1000);
        });

        test('should include service name in correlation ID', () => {
            const customLogger = new RequestLogger({
                service: 'test-service',
                enableConsoleLog: false
            });
            const id = customLogger.generateCorrelationId();
            expect(id).toContain('test-service');
            customLogger.shutdown();
        });
    });

    describe('Request Logging', () => {
        test('should log basic request details', () => {
            const request = createMockRequest({
                method: 'POST',
                url: 'http://localhost:3000/api/users',
                headers: {
                    'content-type': 'application/json',
                    'user-agent': 'TestAgent/1.0'
                }
            });

            const correlationId = logger.logRequest(request, '/api/users');
            const log = logger.getLog(correlationId);

            expect(log).toBeDefined();
            expect(log?.request.method).toBe('POST');
            expect(log?.request.path).toBe('/api/users');
            expect(log?.request.headers['content-type']).toBe('application/json');
            expect(log?.request.userAgent).toBe('TestAgent/1.0');
        });

        test('should sanitize sensitive headers', () => {
            const request = createMockRequest({
                headers: {
                    'authorization': 'Bearer secret-token',
                    'cookie': 'session=abc123',
                    'x-api-key': 'secret-key',
                    'content-type': 'application/json'
                }
            });

            const correlationId = logger.logRequest(request, '/api/test');
            const log = logger.getLog(correlationId);

            expect(log?.request.headers['authorization']).toBe('[REDACTED]');
            expect(log?.request.headers['cookie']).toBe('[REDACTED]');
            expect(log?.request.headers['x-api-key']).toBe('[REDACTED]');
            expect(log?.request.headers['content-type']).toBe('application/json');
        });

        test('should extract IP address from headers', () => {
            const request = createMockRequest({
                headers: {
                    'x-forwarded-for': '192.168.1.100, 10.0.0.1',
                    'x-real-ip': '192.168.1.100'
                }
            });

            const correlationId = logger.logRequest(request, '/api/test');
            const log = logger.getLog(correlationId);

            expect(log?.request.ip).toBe('192.168.1.100, 10.0.0.1');
        });

        test('should include session and user data', () => {
            const request = createMockRequest({
                cookies: { session: 'test-session-id' }
            });

            const correlationId = logger.logRequest(request, '/api/test', undefined, {
                sessionId: 'custom-session-id',
                userId: 'user-123',
                tags: ['test', 'auth']
            });

            const log = logger.getLog(correlationId);

            expect(log?.request.sessionId).toBe('custom-session-id');
            expect(log?.request.userId).toBe('user-123');
            expect(log?.metadata.tags).toEqual(['test', 'auth']);
        });
    });

    describe('Request Body Logging', () => {
        test('should log request body', () => {
            const request = createMockRequest();
            const correlationId = logger.logRequest(request, '/api/test');

            const body = { username: 'test', email: 'test@example.com' };
            logger.logRequestBody(correlationId, body);

            const log = logger.getLog(correlationId);
            expect(log?.request.body).toEqual(body);
        });

        test('should sanitize sensitive data in body', () => {
            const request = createMockRequest();
            const correlationId = logger.logRequest(request, '/api/test');

            const body = {
                username: 'test',
                password: 'secret123',
                apiToken: 'token-xyz',
                data: {
                    secret: 'hidden',
                    public: 'visible'
                }
            };

            logger.logRequestBody(correlationId, body);

            const log = logger.getLog(correlationId);
            expect(log?.request.body.username).toBe('test');
            expect(log?.request.body.password).toBe('[SANITIZED]');
            expect(log?.request.body.apiToken).toBe('[SANITIZED]');
            expect(log?.request.body.data.secret).toBe('[SANITIZED]');
            expect(log?.request.body.data.public).toBe('visible');
        });
    });

    describe('Response Logging', () => {
        test('should log response details', async () => {
            const request = createMockRequest();
            const correlationId = logger.logRequest(request, '/api/test');

            // Add a small delay to ensure duration > 0
            await new Promise(resolve => setTimeout(resolve, 10));

            const responseHeaders = {
                'content-type': 'application/json',
                'x-response-time': '123ms'
            };
            const responseBody = { success: true, data: 'test' };

            logger.logResponse(correlationId, 200, responseHeaders, responseBody);

            const log = logger.getLog(correlationId);
            expect(log?.response).toBeDefined();
            expect(log?.response?.status).toBe(200);
            expect(log?.response?.headers).toEqual(responseHeaders);
            expect(log?.response?.body).toEqual(responseBody);
            expect(log?.response?.duration).toBeGreaterThan(0);
        });

        test('should calculate response size', () => {
            const request = createMockRequest();
            const correlationId = logger.logRequest(request, '/api/test');

            // Test string body
            logger.logResponse(correlationId, 200, {}, 'Hello World');
            let log = logger.getLog(correlationId);
            expect(log?.response?.size).toBe(Buffer.byteLength('Hello World'));

            // Test object body
            const objectBody = { test: 'data', nested: { value: 123 } };
            logger.logResponse(correlationId, 200, {}, objectBody);
            log = logger.getLog(correlationId);
            expect(log?.response?.size).toBe(Buffer.byteLength(JSON.stringify(objectBody)));
        });

        test('should log error responses', () => {
            const request = createMockRequest();
            const correlationId = logger.logRequest(request, '/api/test');

            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at test.js:123';

            logger.logResponse(correlationId, 500, {}, null, error);

            const log = logger.getLog(correlationId);
            expect(log?.response?.error).toBeDefined();
            expect(log?.response?.error?.message).toBe('Test error');
            expect(log?.response?.error?.stack).toBeUndefined(); // Stack hidden in non-debug mode
        });
    });

    describe('Log Filtering', () => {
        beforeEach(() => {
            // Create some test logs
            const request1 = createMockRequest({ method: 'GET' });
            const correlationId1 = logger.logRequest(request1, '/api/users');
            logger.logResponse(correlationId1, 200, {}, {});

            const request2 = createMockRequest({ method: 'POST' });
            const correlationId2 = logger.logRequest(request2, '/api/users', undefined, {
                userId: 'user-123'
            });
            logger.logResponse(correlationId2, 201, {}, {});

            const request3 = createMockRequest({ method: 'DELETE' });
            const correlationId3 = logger.logRequest(request3, '/api/posts/1');
            logger.logResponse(correlationId3, 404, {}, {}, new Error('Not found'));
        });

        test('should filter logs by method', () => {
            const logs = logger.getLogs({ method: 'POST' });
            expect(logs).toHaveLength(1);
            expect(logs[0].request.method).toBe('POST');
        });

        test('should filter logs by status', () => {
            const logs = logger.getLogs({ status: 404 });
            expect(logs).toHaveLength(1);
            expect(logs[0].response?.status).toBe(404);
        });

        test('should filter logs by path', () => {
            const logs = logger.getLogs({ path: 'posts' });
            expect(logs).toHaveLength(1);
            expect(logs[0].request.path).toContain('posts');
        });

        test('should filter logs by error presence', () => {
            const logsWithError = logger.getLogs({ hasError: true });
            expect(logsWithError).toHaveLength(1);
            expect(logsWithError[0].response?.error).toBeDefined();

            const logsWithoutError = logger.getLogs({ hasError: false });
            expect(logsWithoutError).toHaveLength(2);
        });

        test('should filter logs by user ID', () => {
            const logs = logger.getLogs({ userId: 'user-123' });
            expect(logs).toHaveLength(1);
            expect(logs[0].request.userId).toBe('user-123');
        });
    });

    describe('Metrics', () => {
        beforeEach(() => {
            // Create test data
            const timings = [100, 200, 150, 300, 250];

            timings.forEach((duration, index) => {
                const method = index % 2 === 0 ? 'GET' : 'POST';
                const status = index === 4 ? 500 : 200;
                const path = index < 3 ? '/api/fast' : '/api/slow';

                const request = createMockRequest({ method });
                const correlationId = logger.logRequest(request, path);

                // Simulate delay
                const startTime = Date.now() - duration;
                const log = logger.getLog(correlationId);
                if (log) {
                    log.metadata.startTime = startTime;
                }

                logger.logResponse(correlationId, status, {}, {});
            });
        });

        test('should calculate basic metrics', () => {
            const metrics = logger.getMetrics();

            expect(metrics.totalRequests).toBe(5);
            expect(metrics.averageResponseTime).toBeCloseTo(200, 0);
            expect(metrics.errorRate).toBeCloseTo(0.2, 1); // 1 error out of 5
        });

        test('should calculate status code distribution', () => {
            const metrics = logger.getMetrics();

            expect(metrics.statusCodeDistribution[200]).toBe(4);
            expect(metrics.statusCodeDistribution[500]).toBe(1);
        });

        test('should calculate method distribution', () => {
            const metrics = logger.getMetrics();

            expect(metrics.methodDistribution['GET']).toBe(3);
            expect(metrics.methodDistribution['POST']).toBe(2);
        });

        test('should identify slowest endpoints', () => {
            const metrics = logger.getMetrics();

            expect(metrics.slowestEndpoints).toHaveLength(2);
            expect(metrics.slowestEndpoints[0].path).toBe('/api/slow');
            expect(metrics.slowestEndpoints[0].averageTime).toBeCloseTo(275, 0);
            expect(metrics.slowestEndpoints[1].path).toBe('/api/fast');
            expect(metrics.slowestEndpoints[1].averageTime).toBeCloseTo(150, 0);
        });
    });

    describe('Log Cleanup', () => {
        test('should clean up old logs', () => {
            // Create an old log
            const request = createMockRequest();
            const correlationId = logger.logRequest(request, '/api/test');

            // Manually set the log to be old
            const log = logger.getLog(correlationId);
            if (log) {
                log.metadata.startTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
            }

            // Create a new log to trigger cleanup
            const newRequest = createMockRequest();
            const newCorrelationId = logger.logRequest(newRequest, '/api/test');
            logger.logResponse(newCorrelationId, 200, {}, {});

            // Old log should be cleaned up
            expect(logger.getLog(correlationId)).toBeUndefined();
            expect(logger.getLog(newCorrelationId)).toBeDefined();
        });
    });

    describe('Configuration', () => {
        test('should respect debug configuration', () => {
            const debugLogger = new RequestLogger({
                debug: true,
                enableConsoleLog: false
            });

            const request = createMockRequest();
            const correlationId = debugLogger.logRequest(request, '/api/test');

            const error = new Error('Test error');
            error.stack = 'Error: Test error\n    at test.js:123';

            debugLogger.logResponse(correlationId, 500, {}, null, error);

            const log = debugLogger.getLog(correlationId);
            expect(log?.response?.error?.stack).toBeDefined(); // Stack visible in debug mode

            debugLogger.shutdown();
        });

        test('should handle custom sensitive headers', () => {
            const customLogger = new RequestLogger({
                sensitiveHeaders: ['x-custom-secret', 'authorization'],
                enableConsoleLog: false
            });

            const request = createMockRequest({
                headers: {
                    'x-custom-secret': 'secret',
                    'authorization': 'Bearer token',
                    'x-other': 'visible'
                }
            });

            const correlationId = customLogger.logRequest(request, '/api/test');
            const log = customLogger.getLog(correlationId);

            expect(log?.request.headers['x-custom-secret']).toBe('[REDACTED]');
            expect(log?.request.headers['authorization']).toBe('[REDACTED]');
            expect(log?.request.headers['x-other']).toBe('visible');

            customLogger.shutdown();
        });
    });
}); 