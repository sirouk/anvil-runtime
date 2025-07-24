/**
 * Anvil Server Function Call System
 * 
 * Provides JavaScript/TypeScript equivalent of Python's anvil.server.call()
 * Integrates with WebSocket communication for real-time server interaction
 */

export interface ServerCallOptions {
    timeout?: number; // Default: 30000ms
    retries?: number; // Default: 3
    retryDelay?: number; // Default: 1000ms
    includeStackTrace?: boolean; // Default: false
    priority?: 'low' | 'normal' | 'high'; // Default: 'normal'
}

export interface ServerCallResult<T = any> {
    success: boolean;
    result?: T;
    error?: ServerCallError;
    executionTime?: number;
    callId?: string;
}

export interface ServerCallError {
    type: 'AnvilServerError' | 'TimeoutError' | 'NetworkError' | 'ValidationError' | 'UnknownError';
    message: string;
    details?: any;
    stackTrace?: string;
    serverFunction?: string;
}

export interface PendingCall {
    id: string;
    functionName: string;
    args: any[];
    kwargs: Record<string, any>;
    options: Required<ServerCallOptions>;
    resolve: (result: any) => void;
    reject: (error: ServerCallError) => void;
    timestamp: number;
    timeoutId?: NodeJS.Timeout;
    retryCount: number;
}

export interface ServerFunctionRegistry {
    [functionName: string]: {
        description?: string;
        parameters?: Record<string, any>;
        returnType?: string;
        permissions?: string[];
        cached?: boolean;
        cacheTTL?: number;
    };
}

// WebSocket Message Types for Server Calls
export interface ServerCallMessage {
    type: 'SERVER_CALL';
    id: string;
    function: string;
    args: any[];
    kwargs: Record<string, any>;
    options?: Partial<ServerCallOptions>;
}

export interface ServerCallResponse {
    type: 'SERVER_CALL_RESPONSE';
    id: string;
    success: boolean;
    result?: any;
    error?: {
        type: string;
        message: string;
        details?: any;
        stackTrace?: string;
    };
    executionTime?: number;
}

/**
 * Core Server Call Manager
 * Handles communication with Anvil server functions
 */
export class AnvilServerCallManager {
    private pendingCalls: Map<string, PendingCall> = new Map();
    private webSocket: WebSocket | null = null;
    private isConnected: boolean = false;
    private callIdCounter: number = 0;
    private functionRegistry: ServerFunctionRegistry = {};
    private globalOptions: Required<ServerCallOptions>;

    // Event emitters for monitoring
    private onConnectedCallbacks: Array<() => void> = [];
    private onDisconnectedCallbacks: Array<() => void> = [];
    private onErrorCallbacks: Array<(error: ServerCallError) => void> = [];

    constructor(
        webSocketUrl?: string,
        options: Partial<ServerCallOptions> = {}
    ) {
        this.globalOptions = {
            timeout: options.timeout ?? 30000,
            retries: options.retries ?? 3,
            retryDelay: options.retryDelay ?? 1000,
            includeStackTrace: options.includeStackTrace ?? false,
            priority: options.priority ?? 'normal'
        };

        if (webSocketUrl) {
            this.connect(webSocketUrl);
        }
    }

    /**
     * Connect to Anvil server WebSocket
     */
    async connect(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.webSocket = new WebSocket(url);

                this.webSocket.onopen = () => {
                    this.isConnected = true;
                    this.onConnectedCallbacks.forEach(callback => callback());
                    resolve();
                };

                this.webSocket.onmessage = (event) => {
                    try {
                        const message = JSON.parse(event.data);
                        this.handleServerMessage(message);
                    } catch (error) {
                        console.error('Failed to parse server message:', error);
                    }
                };

                this.webSocket.onclose = () => {
                    this.isConnected = false;
                    this.onDisconnectedCallbacks.forEach(callback => callback());
                    // Auto-reconnect logic could go here
                };

                this.webSocket.onerror = (error) => {
                    const serverError: ServerCallError = {
                        type: 'NetworkError',
                        message: 'WebSocket connection error',
                        details: error
                    };
                    this.onErrorCallbacks.forEach(callback => callback(serverError));
                    reject(serverError);
                };

            } catch (error) {
                reject({
                    type: 'NetworkError' as const,
                    message: 'Failed to establish WebSocket connection',
                    details: error
                });
            }
        });
    }

    /**
     * Disconnect from server
     */
    disconnect(): void {
        if (this.webSocket) {
            this.webSocket.close();
            this.webSocket = null;
        }
        this.isConnected = false;

        // Reject all pending calls
        this.pendingCalls.forEach(call => {
            if (call.timeoutId) {
                clearTimeout(call.timeoutId);
            }
            call.reject({
                type: 'NetworkError',
                message: 'Connection closed',
                serverFunction: call.functionName
            });
        });
        this.pendingCalls.clear();
    }

    /**
     * Main server call function - equivalent to anvil.server.call()
     */
    async call<T = any>(
        functionName: string,
        ...args: any[]
    ): Promise<T>;

    async call<T = any>(
        functionName: string,
        args: any[],
        kwargs?: Record<string, any>,
        options?: Partial<ServerCallOptions>
    ): Promise<T>;

    async call<T = any>(
        functionName: string,
        argsOrFirstParam?: any[] | any,
        kwargs: Record<string, any> = {},
        options: Partial<ServerCallOptions> = {}
    ): Promise<T> {
        // Handle function overloads
        let args: any[];
        if (Array.isArray(argsOrFirstParam)) {
            args = argsOrFirstParam;
        } else {
            args = argsOrFirstParam !== undefined ? [argsOrFirstParam] : [];
        }

        if (!this.isConnected) {
            throw new Error('Not connected to Anvil server. Call connect() first.');
        }

        const callOptions = { ...this.globalOptions, ...options };
        const callId = this.generateCallId();

        return new Promise<T>((resolve, reject) => {
            const pendingCall: PendingCall = {
                id: callId,
                functionName,
                args,
                kwargs,
                options: callOptions,
                resolve,
                reject,
                timestamp: Date.now(),
                retryCount: 0
            };

            // Set timeout
            pendingCall.timeoutId = setTimeout(() => {
                this.handleCallTimeout(callId);
            }, callOptions.timeout);

            this.pendingCalls.set(callId, pendingCall);
            this.sendServerCall(pendingCall);
        });
    }

    /**
     * Send server call message via WebSocket
     */
    private sendServerCall(call: PendingCall): void {
        const message: ServerCallMessage = {
            type: 'SERVER_CALL',
            id: call.id,
            function: call.functionName,
            args: call.args,
            kwargs: call.kwargs,
            options: call.options
        };

        if (this.webSocket && this.isConnected) {
            this.webSocket.send(JSON.stringify(message));
        } else {
            call.reject({
                type: 'NetworkError',
                message: 'WebSocket not connected',
                serverFunction: call.functionName
            });
        }
    }

    /**
     * Handle incoming server messages
     */
    private handleServerMessage(message: any): void {
        if (message.type === 'SERVER_CALL_RESPONSE') {
            this.handleServerCallResponse(message as ServerCallResponse);
        }
        // Handle other message types as needed
    }

    /**
     * Handle server call response
     */
    private handleServerCallResponse(response: ServerCallResponse): void {
        const pendingCall = this.pendingCalls.get(response.id);
        if (!pendingCall) {
            console.warn('Received response for unknown call ID:', response.id);
            return;
        }

        // Clear timeout
        if (pendingCall.timeoutId) {
            clearTimeout(pendingCall.timeoutId);
        }

        this.pendingCalls.delete(response.id);

        if (response.success) {
            pendingCall.resolve(response.result);
        } else {
            const error: ServerCallError = {
                type: (response.error?.type as any) || 'AnvilServerError',
                message: response.error?.message || 'Server call failed',
                details: response.error?.details,
                stackTrace: response.error?.stackTrace,
                serverFunction: pendingCall.functionName
            };

            // Retry logic
            if (pendingCall.retryCount < pendingCall.options.retries &&
                this.shouldRetry(error)) {
                this.retryCall(pendingCall);
            } else {
                pendingCall.reject(error);
            }
        }
    }

    /**
     * Handle call timeout
     */
    private handleCallTimeout(callId: string): void {
        const pendingCall = this.pendingCalls.get(callId);
        if (!pendingCall) return;

        this.pendingCalls.delete(callId);

        const error: ServerCallError = {
            type: 'TimeoutError',
            message: `Server call timed out after ${pendingCall.options.timeout}ms`,
            serverFunction: pendingCall.functionName
        };

        // Retry logic for timeouts
        if (pendingCall.retryCount < pendingCall.options.retries) {
            this.retryCall(pendingCall);
        } else {
            pendingCall.reject(error);
        }
    }

    /**
     * Retry a failed call
     */
    private retryCall(call: PendingCall): void {
        call.retryCount++;

        setTimeout(() => {
            if (this.isConnected) {
                // Reset timeout
                call.timeoutId = setTimeout(() => {
                    this.handleCallTimeout(call.id);
                }, call.options.timeout);

                this.pendingCalls.set(call.id, call);
                this.sendServerCall(call);
            } else {
                call.reject({
                    type: 'NetworkError',
                    message: 'Cannot retry - not connected to server',
                    serverFunction: call.functionName
                });
            }
        }, call.options.retryDelay);
    }

    /**
     * Determine if a call should be retried
     */
    private shouldRetry(error: ServerCallError): boolean {
        // Don't retry validation errors or certain server errors
        return error.type === 'TimeoutError' || error.type === 'NetworkError';
    }

    /**
     * Generate unique call ID
     */
    private generateCallId(): string {
        return `call_${Date.now()}_${++this.callIdCounter}`;
    }

    /**
     * Register server function metadata
     */
    registerFunction(
        functionName: string,
        metadata: ServerFunctionRegistry[string]
    ): void {
        this.functionRegistry[functionName] = metadata;
    }

    /**
     * Get registered functions
     */
    getRegisteredFunctions(): ServerFunctionRegistry {
        return { ...this.functionRegistry };
    }

    /**
     * Get connection status
     */
    isConnectedToServer(): boolean {
        return this.isConnected;
    }

    /**
     * Get pending calls count
     */
    getPendingCallsCount(): number {
        return this.pendingCalls.size;
    }

    /**
     * Event listeners
     */
    onConnected(callback: () => void): void {
        this.onConnectedCallbacks.push(callback);
    }

    onDisconnected(callback: () => void): void {
        this.onDisconnectedCallbacks.push(callback);
    }

    onError(callback: (error: ServerCallError) => void): void {
        this.onErrorCallbacks.push(callback);
    }

    /**
     * Cancel a pending call
     */
    cancelCall(callId: string): boolean {
        const pendingCall = this.pendingCalls.get(callId);
        if (!pendingCall) return false;

        if (pendingCall.timeoutId) {
            clearTimeout(pendingCall.timeoutId);
        }

        this.pendingCalls.delete(callId);
        pendingCall.reject({
            type: 'UnknownError',
            message: 'Call cancelled by user',
            serverFunction: pendingCall.functionName
        });

        return true;
    }

    /**
     * Cancel all pending calls
     */
    cancelAllCalls(): number {
        const count = this.pendingCalls.size;

        this.pendingCalls.forEach(call => {
            if (call.timeoutId) {
                clearTimeout(call.timeoutId);
            }
            call.reject({
                type: 'UnknownError',
                message: 'All calls cancelled',
                serverFunction: call.functionName
            });
        });

        this.pendingCalls.clear();
        return count;
    }
}

// Global server call manager instance
let globalServerCallManager: AnvilServerCallManager | null = null;

/**
 * Initialize global server call manager
 */
export function initializeServerCalls(
    webSocketUrl: string,
    options?: Partial<ServerCallOptions>
): Promise<void> {
    globalServerCallManager = new AnvilServerCallManager(undefined, options);
    return globalServerCallManager.connect(webSocketUrl);
}

/**
 * Get global server call manager
 */
export function getServerCallManager(): AnvilServerCallManager {
    if (!globalServerCallManager) {
        throw new Error('Server calls not initialized. Call initializeServerCalls() first.');
    }
    return globalServerCallManager;
}

/**
 * Direct anvil.server.call() equivalent function
 */
export async function serverCall<T = any>(
    functionName: string,
    ...args: any[]
): Promise<T> {
    return getServerCallManager().call<T>(functionName, ...args);
}

/**
 * Anvil-style server call with kwargs support
 */
export async function serverCallWithKwargs<T = any>(
    functionName: string,
    args: any[] = [],
    kwargs: Record<string, any> = {},
    options?: Partial<ServerCallOptions>
): Promise<T> {
    return getServerCallManager().call<T>(functionName, args, kwargs, options);
}

// Export namespace for organizing API
export const anvil = {
    server: {
        call: serverCall,
        callWithKwargs: serverCallWithKwargs,
        manager: () => getServerCallManager()
    }
}; 