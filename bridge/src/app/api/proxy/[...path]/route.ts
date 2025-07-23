/**
 * Generic HTTP Proxy Route for Anvil Server
 * 
 * Forwards HTTP requests to the Anvil server while preserving authentication,
 * headers, and ensuring zero server-side detection.
 * Enhanced with comprehensive file upload/download handling.
 */

import { NextRequest, NextResponse } from 'next/server';
import AnvilAuthManager from '@/lib/auth/anvil-auth-manager';
import AnvilSessionManager from '@/lib/session/anvil-session-manager';
import {
    defaultFileUploadHandler,
    defaultFileDownloadHandler,
    type FileUploadResult
} from '@/lib/file/file-upload-handler';
import { globalRequestLogger } from '@/lib/logging/request-logger';

interface ProxyConfig {
    anvilServerUrl: string;
    anvilServerPort: number;
    timeout: number;
    retryAttempts: number;
    debug: boolean;
    enableFileHandling: boolean;
}

interface ProxyRequestInfo {
    method: string;
    path: string;
    headers: Record<string, string>;
    body?: any;
    contentType?: string;
    sessionToken?: string;
    fileUploadResult?: FileUploadResult;
    isFileUpload?: boolean;
    isFileDownload?: boolean;
}

interface ProxyResponse {
    status: number;
    headers: Record<string, string>;
    body: any;
    contentType: string;
}

class AnvilHttpProxy {
    private config: ProxyConfig;
    private authManager: AnvilAuthManager;
    private sessionManager: AnvilSessionManager;

    constructor() {
        this.config = {
            anvilServerUrl: process.env.ANVIL_SERVER_URL || 'localhost',
            anvilServerPort: parseInt(process.env.ANVIL_SERVER_PORT || '3030'),
            timeout: parseInt(process.env.ANVIL_TIMEOUT || '30000'),
            retryAttempts: parseInt(process.env.ANVIL_RETRY_ATTEMPTS || '3'),
            debug: process.env.NODE_ENV === 'development',
            enableFileHandling: true
        };

        this.authManager = new AnvilAuthManager({
            debug: this.config.debug
        });

        this.sessionManager = new AnvilSessionManager();

        // Clean up old progress trackers every 5 minutes
        if (this.config.enableFileHandling) {
            setInterval(() => {
                defaultFileUploadHandler.cleanupProgress();
            }, 300000); // 5 minutes
        }
    }

    /**
     * Process incoming request and prepare for proxying
     */
    async processRequest(request: NextRequest, path: string[], correlationId?: string): Promise<ProxyRequestInfo> {
        const method = request.method;
        const requestPath = '/' + path.join('/');

        // Extract headers (normalize to lowercase and filter out problematic ones)
        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
            const lowerKey = key.toLowerCase();
            // Skip problematic headers that should not be forwarded
            if (!['host', 'connection', 'upgrade', 'keep-alive', 'proxy-connection',
                'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding'].includes(lowerKey) &&
                !lowerKey.startsWith('cf-') && // Cloudflare headers
                !lowerKey.startsWith('x-forwarded') && // Proxy headers
                !lowerKey.startsWith('x-real-ip')) { // Real IP headers
                headers[lowerKey] = value;
            }
        });

        // Add correlation ID to headers if provided
        if (correlationId) {
            headers['x-correlation-id'] = correlationId;
        }

        // Extract authentication from cookies and headers
        const cookieHeader = request.headers.get('cookie');
        const urlParams = new URLSearchParams(request.nextUrl.search);

        const authResult = this.authManager.extractAuthFromRequest(
            cookieHeader || undefined,
            urlParams,
            Object.fromEntries(request.headers.entries())
        );

        let sessionToken: string | undefined;

        if (authResult.tokens && authResult.sessionToken) {
            sessionToken = authResult.sessionToken;

            // Inject authentication headers
            const authHeaders = this.authManager.createAuthHeaders(authResult.tokens, {
                includeUserAgent: true
            });

            Object.assign(headers, authHeaders);

            if (this.config.debug) {
                console.log(`🔗 HTTP Proxy: ${method} ${requestPath} with auth [${authResult.sources.join(', ')}]`);
            }
        } else {
            if (this.config.debug) {
                console.log(`🔗 HTTP Proxy: ${method} ${requestPath} (no auth)`);
            }
        }

        // Detect if this is a file download request
        const isFileDownload = this.isFileDownloadRequest(requestPath, headers);

        // Handle request body and file uploads
        let body: any;
        let contentType: string | undefined;
        let fileUploadResult: FileUploadResult | undefined;
        let isFileUpload = false;

        if (method !== 'GET' && method !== 'HEAD') {
            contentType = request.headers.get('content-type') || undefined;

            if (contentType?.includes('multipart/form-data') && this.config.enableFileHandling) {
                // Handle file upload with enhanced processing
                isFileUpload = true;
                fileUploadResult = await defaultFileUploadHandler.processUpload(request);

                if (fileUploadResult.success) {
                    // Reconstruct FormData for forwarding to Anvil server
                    body = await this.reconstructFormData(fileUploadResult);

                    if (this.config.debug) {
                        console.log(`📁 File upload processed: ${fileUploadResult.files.length} files, ${fileUploadResult.totalSize} bytes`);
                        if (fileUploadResult.progressId) {
                            console.log(`📊 Progress tracking ID: ${fileUploadResult.progressId}`);
                        }
                    }
                } else {
                    throw new Error(`File upload failed: ${fileUploadResult.errors.join(', ')}`);
                }
            } else if (contentType?.includes('application/json')) {
                try {
                    body = await request.json();
                } catch (error) {
                    console.warn('Failed to parse JSON body:', error);
                }
            } else if (contentType?.includes('application/x-www-form-urlencoded')) {
                body = await request.text();
            } else {
                // Handle binary data
                body = await request.arrayBuffer();
            }
        }

        return {
            method,
            path: requestPath,
            headers,
            body,
            contentType,
            sessionToken,
            fileUploadResult,
            isFileUpload,
            isFileDownload
        };
    }

    /**
     * Detect if this is a file download request
     */
    private isFileDownloadRequest(path: string, headers: Record<string, string>): boolean {
        // Check for common file download patterns
        const downloadPatterns = [
            /\/_\/static\/.*\.(jpg|jpeg|png|gif|pdf|doc|docx|xls|xlsx|zip|tar|gz)$/i,
            /\/download\//i,
            /\/files?\//i,
            /\/media\//i,
            /\/uploads?\//i
        ];

        const hasDownloadPattern = downloadPatterns.some(pattern => pattern.test(path));
        const hasDownloadHeader = headers['accept']?.includes('application/octet-stream') ||
            headers['accept']?.includes('*/*');

        return hasDownloadPattern || hasDownloadHeader;
    }

    /**
     * Reconstruct FormData from file upload result for forwarding
     */
    private async reconstructFormData(uploadResult: FileUploadResult): Promise<FormData> {
        const formData = new FormData();

        for (const file of uploadResult.files) {
            let fileData: Blob;

            if (file.data) {
                // Small file - use ArrayBuffer data
                fileData = new Blob([file.data], { type: file.mimeType });
            } else if (file.stream) {
                // Large file - convert stream to blob
                const chunks: Uint8Array[] = [];
                const reader = file.stream;

                // This is a simplified approach - in production you might want more sophisticated streaming
                for await (const chunk of reader) {
                    chunks.push(chunk);
                }

                const concatenated = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
                let offset = 0;
                for (const chunk of chunks) {
                    concatenated.set(chunk, offset);
                    offset += chunk.length;
                }

                fileData = new Blob([concatenated], { type: file.mimeType });
            } else {
                throw new Error(`No data available for file: ${file.originalName}`);
            }

            const reconstructedFile = new File([fileData], file.originalName, {
                type: file.mimeType
            });

            formData.append(file.fieldName, reconstructedFile);
        }

        return formData;
    }

    /**
     * Forward request to Anvil server
     */
    async forwardRequest(requestInfo: ProxyRequestInfo): Promise<ProxyResponse> {
        const { method, path, headers, body, contentType, isFileDownload } = requestInfo;

        const targetUrl = `http://${this.config.anvilServerUrl}:${this.config.anvilServerPort}${path}`;

        // Prepare headers (avoid setting conflicting headers that fetch handles)
        const fetchHeaders: Record<string, string> = {
            ...headers,
            'accept': headers['accept'] || '*/*',
            'user-agent': headers['user-agent'] || 'Anvil-NextJS-Bridge/1.0'
        };

        // Prepare fetch options
        const fetchOptions: RequestInit = {
            method,
            headers: fetchHeaders,
            signal: AbortSignal.timeout(this.config.timeout)
        };

        // Add body for non-GET requests
        if (body && method !== 'GET' && method !== 'HEAD') {
            if (body instanceof FormData) {
                fetchOptions.body = body;
                // Don't set content-type for FormData - let fetch set the boundary
                delete fetchHeaders['content-type'];
            } else if (body instanceof ArrayBuffer) {
                fetchOptions.body = body;
            } else if (typeof body === 'string') {
                fetchOptions.body = body;
            } else {
                fetchOptions.body = JSON.stringify(body);
                fetchHeaders['content-type'] = 'application/json';
            }
        }

        if (this.config.debug) {
            console.log(`📡 Proxying ${method} ${targetUrl}`);
            console.log(`   Headers:`, Object.keys(fetchOptions.headers || {}));
            console.log(`   Body type:`, body?.constructor?.name || 'none');
            if (requestInfo.isFileUpload) {
                console.log(`   📁 File upload: ${requestInfo.fileUploadResult?.files.length} files`);
            }
            if (isFileDownload) {
                console.log(`   📥 File download detected`);
            }
        }

        // Make request with retry logic
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                const response = await fetch(targetUrl, fetchOptions);

                // Extract response headers
                const responseHeaders: Record<string, string> = {};
                response.headers.forEach((value, key) => {
                    responseHeaders[key] = value;
                });

                // Determine response content type
                const responseContentType = response.headers.get('content-type') || 'application/octet-stream';

                // Handle response body based on content type
                let responseBody: any;

                if (responseContentType.includes('application/json')) {
                    responseBody = await response.json();
                } else if (responseContentType.includes('text/')) {
                    responseBody = await response.text();
                } else {
                    // Handle binary data (including file downloads)
                    responseBody = await response.arrayBuffer();
                }

                if (this.config.debug) {
                    console.log(`✅ Response ${response.status} from ${method} ${path}`);
                    console.log(`   Content-Type: ${responseContentType}`);
                    console.log(`   Body size: ${responseBody?.length || responseBody?.byteLength || 'unknown'}`);
                }

                return {
                    status: response.status,
                    headers: responseHeaders,
                    body: responseBody,
                    contentType: responseContentType
                };

            } catch (error) {
                lastError = error as Error;

                if (attempt < this.config.retryAttempts) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff
                    console.warn(`⚠️ Attempt ${attempt} failed, retrying in ${delay}ms:`, error);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    console.error(`❌ All ${this.config.retryAttempts} attempts failed for ${method} ${path}:`, error);
                }
            }
        }

        // If all retries failed, throw the last error
        throw lastError || new Error('Unknown proxy error');
    }

    /**
     * Create NextResponse from proxy response
     */
    createResponse(proxyResponse: ProxyResponse, requestInfo: ProxyRequestInfo): NextResponse {
        const { status, headers, body, contentType } = proxyResponse;

        // Filter out problematic headers
        let filteredHeaders: Record<string, string> = {};
        Object.entries(headers).forEach(([key, value]) => {
            const lowerKey = key.toLowerCase();

            // Skip headers that should not be forwarded
            if (!['transfer-encoding', 'connection', 'upgrade', 'keep-alive'].includes(lowerKey)) {
                filteredHeaders[key] = value;
            }
        });

        // Enhance headers for file downloads
        if (requestInfo.isFileDownload && this.config.enableFileHandling) {
            const filename = this.extractFilenameFromPath(requestInfo.path) ||
                this.extractFilenameFromHeaders(headers);

            filteredHeaders = defaultFileDownloadHandler.enhanceDownloadHeaders(
                filteredHeaders,
                filename,
                contentType
            );
        }

        // Ensure proper content type
        if (!filteredHeaders['content-type']) {
            filteredHeaders['content-type'] = contentType;
        }

        // Add CORS headers if needed
        if (this.config.debug) {
            filteredHeaders['Access-Control-Allow-Origin'] = '*';
            filteredHeaders['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
            filteredHeaders['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, Cookie';
        }

        // Add upload progress tracking header if applicable
        if (requestInfo.fileUploadResult?.progressId) {
            filteredHeaders['X-Upload-Progress-Id'] = requestInfo.fileUploadResult.progressId;
        }

        // Create response
        let responseBody: any;

        if (body instanceof ArrayBuffer) {
            responseBody = new Uint8Array(body);
        } else if (typeof body === 'object' && body !== null) {
            responseBody = JSON.stringify(body);
            filteredHeaders['content-type'] = 'application/json';
        } else {
            responseBody = body;
        }

        return new NextResponse(responseBody, {
            status,
            headers: filteredHeaders
        });
    }

    /**
     * Extract filename from URL path
     */
    private extractFilenameFromPath(path: string): string | undefined {
        const segments = path.split('/');
        const lastSegment = segments[segments.length - 1];

        // Check if last segment looks like a filename (has extension)
        if (lastSegment && lastSegment.includes('.')) {
            return lastSegment;
        }

        return undefined;
    }

    /**
     * Extract filename from response headers
     */
    private extractFilenameFromHeaders(headers: Record<string, string>): string | undefined {
        const contentDisposition = headers['content-disposition'];
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (filenameMatch) {
                return filenameMatch[1].replace(/['"]/g, '');
            }
        }
        return undefined;
    }
}

// Create proxy instance
const proxy = new AnvilHttpProxy();

/**
 * Handle all HTTP methods
 */
async function handleRequest(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
    // Generate or extract correlation ID
    const correlationId = request.headers.get('x-correlation-id') ||
        request.headers.get('x-request-id') ||
        globalRequestLogger.generateCorrelationId();

    // Await params for NextJS 15 compatibility
    const { path } = await params;
    const requestPath = '/' + path.join('/');

    // Log the incoming request
    globalRequestLogger.logRequest(request, requestPath, correlationId, {
        sessionId: request.cookies.get('session')?.value,
        tags: ['proxy', 'anvil']
    });

    try {
        // Handle preflight requests
        if (request.method === 'OPTIONS') {
            const response = new NextResponse(null, {
                status: 200,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Correlation-ID',
                    'Access-Control-Max-Age': '86400',
                    'X-Correlation-ID': correlationId
                }
            });

            // Log the response
            globalRequestLogger.logResponse(
                correlationId,
                200,
                Object.fromEntries(response.headers.entries())
            );

            return response;
        }

        // Process the request
        const requestInfo = await proxy.processRequest(request, path, correlationId);

        // Log request body if present
        if (requestInfo.body) {
            globalRequestLogger.logRequestBody(correlationId, requestInfo.body);
        }

        // Forward to Anvil server
        const proxyResponse = await proxy.forwardRequest(requestInfo);

        // Create response
        const response = proxy.createResponse(proxyResponse, requestInfo);

        // Add correlation ID to response headers
        response.headers.set('X-Correlation-ID', correlationId);

        // Log the response
        globalRequestLogger.logResponse(
            correlationId,
            proxyResponse.status,
            Object.fromEntries(response.headers.entries()),
            proxyResponse.body
        );

        return response;

    } catch (error) {
        console.error('❌ HTTP Proxy Error:', error);

        const errorResponse = NextResponse.json(
            {
                error: 'Proxy Error',
                message: error instanceof Error ? error.message : 'Unknown error',
                correlationId,
                timestamp: new Date().toISOString()
            },
            {
                status: 502, // Bad Gateway
                headers: {
                    'Content-Type': 'application/json',
                    'X-Correlation-ID': correlationId
                }
            }
        );

        // Log the error response
        globalRequestLogger.logResponse(
            correlationId,
            502,
            Object.fromEntries(errorResponse.headers.entries()),
            {
                error: 'Proxy Error',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            error instanceof Error ? error : new Error('Unknown proxy error')
        );

        return errorResponse;
    }
}

// Export handlers for all HTTP methods
export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const DELETE = handleRequest;
export const PATCH = handleRequest;
export const OPTIONS = handleRequest; 