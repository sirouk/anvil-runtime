/**
 * Anvil Server System - Main Export File
 * 
 * Complete server function call system with React hooks integration
 * and event system compatibility
 */

// Core server call system
export {
    AnvilServerCallManager,
    initializeServerCalls,
    getServerCallManager,
    serverCall,
    serverCallWithKwargs,
    anvil,
    type ServerCallOptions,
    type ServerCallResult,
    type ServerCallError,
    type PendingCall,
    type ServerFunctionRegistry as ServerFunctionRegistryType,
    type ServerCallMessage,
    type ServerCallResponse
} from './anvil-server-calls';

// Import for internal use
import {
    ServerCallOptions,
    ServerCallError,
    getServerCallManager,
    serverCall,
    serverCallWithKwargs
} from './anvil-server-calls';

// React hooks for server calls
export {
    useServerCall,
    useLazyServerCall,
    useServerMutation,
    useServerCallManager,
    useServerConnection,
    clearServerCallCache,
    getServerCallCacheStats,
    type UseServerCallState,
    type UseServerCallOptions,
    type UseServerCallResult,
    type UseLazyServerCallResult
} from './use-server-call';

// Server call utilities and helpers
export const ServerUtils = {
    /**
     * Create a server function wrapper with type safety
     */
    createServerFunction: <TArgs extends any[], TReturn = any>(
        functionName: string,
        options?: Partial<ServerCallOptions>
    ) => {
        return async (...args: TArgs): Promise<TReturn> => {
            return serverCall<TReturn>(functionName, ...args);
        };
    },

    /**
     * Create a server function with kwargs support
     */
    createServerFunctionWithKwargs: <TArgs extends any[], TKwargs extends Record<string, any> = Record<string, any>, TReturn = any>(
        functionName: string,
        options?: Partial<ServerCallOptions>
    ) => {
        return async (args: TArgs, kwargs: TKwargs): Promise<TReturn> => {
            return serverCallWithKwargs<TReturn>(functionName, args, kwargs, options);
        };
    },

    /**
     * Batch multiple server calls
     */
    batchServerCalls: async <T = any>(
        calls: Array<{ functionName: string; args: any[]; kwargs?: Record<string, any> }>
    ): Promise<Array<{ success: boolean; result?: T; error?: ServerCallError }>> => {
        const manager = getServerCallManager();

        return Promise.allSettled(
            calls.map(async call => {
                try {
                    const result = await manager.call<T>(
                        call.functionName,
                        call.args,
                        call.kwargs || {}
                    );
                    return { success: true, result };
                } catch (error) {
                    return { success: false, error: error as ServerCallError };
                }
            })
        ).then(results =>
            results.map(result =>
                result.status === 'fulfilled'
                    ? result.value
                    : { success: false, error: result.reason }
            )
        );
    },

    /**
     * Create a cached server function
     */
    createCachedServerFunction: <TArgs extends any[], TReturn = any>(
        functionName: string,
        ttl: number = 5 * 60 * 1000, // 5 minutes
        options?: Partial<ServerCallOptions>
    ) => {
        const cache = new Map<string, { data: TReturn; timestamp: number }>();

        return async (...args: TArgs): Promise<TReturn> => {
            const cacheKey = JSON.stringify(args);
            const cached = cache.get(cacheKey);

            if (cached && Date.now() - cached.timestamp < ttl) {
                return cached.data;
            }

            const result = await serverCall<TReturn>(functionName, ...args);
            cache.set(cacheKey, { data: result, timestamp: Date.now() });

            return result;
        };
    },

    /**
     * Check if server calls are available
     */
    isServerCallsAvailable: (): boolean => {
        try {
            const manager = getServerCallManager();
            return manager.isConnectedToServer();
        } catch {
            return false;
        }
    },

    /**
     * Wait for server connection
     */
    waitForConnection: (timeout: number = 10000): Promise<boolean> => {
        return new Promise((resolve) => {
            const startTime = Date.now();

            const checkConnection = () => {
                if (ServerUtils.isServerCallsAvailable()) {
                    resolve(true);
                } else if (Date.now() - startTime > timeout) {
                    resolve(false);
                } else {
                    setTimeout(checkConnection, 100);
                }
            };

            checkConnection();
        });
    }
};

// Pre-configured setups for common use cases
export const ServerPresets = {
    /**
     * Development setup with verbose logging
     */
    development: {
        timeout: 10000,
        retries: 1,
        retryDelay: 1000,
        includeStackTrace: true,
        priority: 'normal' as const
    },

    /**
     * Production setup with optimized settings
     */
    production: {
        timeout: 30000,
        retries: 3,
        retryDelay: 2000,
        includeStackTrace: false,
        priority: 'normal' as const
    },

    /**
     * Fast setup for quick responses
     */
    fast: {
        timeout: 5000,
        retries: 1,
        retryDelay: 500,
        includeStackTrace: false,
        priority: 'high' as const
    },

    /**
     * Reliable setup for critical operations
     */
    reliable: {
        timeout: 60000,
        retries: 5,
        retryDelay: 3000,
        includeStackTrace: true,
        priority: 'high' as const
    }
};

// Common server function patterns
export const ServerPatterns = {
    /**
     * Standard CRUD operations
     */
    crud: {
        create: (tableName: string) =>
            ServerUtils.createServerFunction<[Record<string, any>], any>(`create_${tableName}`),

        read: (tableName: string) =>
            ServerUtils.createServerFunction<[string], any>(`get_${tableName}`),

        update: (tableName: string) =>
            ServerUtils.createServerFunction<[string, Record<string, any>], any>(`update_${tableName}`),

        delete: (tableName: string) =>
            ServerUtils.createServerFunction<[string], boolean>(`delete_${tableName}`),

        list: (tableName: string) =>
            ServerUtils.createServerFunction<[any?], any[]>(`list_${tableName}`)
    },

    /**
     * Authentication operations
     */
    auth: {
        login: ServerUtils.createServerFunction<[string, string], any>('login'),
        logout: ServerUtils.createServerFunction<[], boolean>('logout'),
        register: ServerUtils.createServerFunction<[Record<string, any>], any>('register'),
        getCurrentUser: ServerUtils.createServerFunction<[], any>('get_current_user'),
        resetPassword: ServerUtils.createServerFunction<[string], boolean>('reset_password')
    },

    /**
     * File operations
     */
    files: {
        upload: ServerUtils.createServerFunction<[File | Blob, string?], any>('upload_file'),
        download: ServerUtils.createServerFunction<[string], Blob>('download_file'),
        delete: ServerUtils.createServerFunction<[string], boolean>('delete_file'),
        list: ServerUtils.createServerFunction<[string?], any[]>('list_files')
    },

    /**
     * Data validation
     */
    validation: {
        validateEmail: ServerUtils.createServerFunction<[string], boolean>('validate_email'),
        validateForm: ServerUtils.createServerFunction<[Record<string, any>], any>('validate_form'),
        checkDuplicate: ServerUtils.createServerFunction<[string, string, any], boolean>('check_duplicate')
    }
};

// Server function registry for better development experience
export class ServerFunctionRegistry {
    private static functions: Map<string, ServerFunctionRegistry> = new Map();

    constructor(
        public name: string,
        public description: string,
        public parameters: Record<string, any> = {},
        public returnType: string = 'any',
        public examples: string[] = []
    ) { }

    static register(
        name: string,
        description: string,
        parameters?: Record<string, any>,
        returnType?: string,
        examples?: string[]
    ): void {
        this.functions.set(name, new ServerFunctionRegistry(
            name, description, parameters, returnType, examples
        ));
    }

    static get(name: string): ServerFunctionRegistry | undefined {
        return this.functions.get(name);
    }

    static getAll(): ServerFunctionRegistry[] {
        return Array.from(this.functions.values());
    }

    static clear(): void {
        this.functions.clear();
    }
}

// Export version information
export const ANVIL_SERVER_VERSION = '1.0.0';

// Export type aliases for convenience
export type ServerFunction<TArgs extends any[] = any[], TReturn = any> = (...args: TArgs) => Promise<TReturn>;
export type ServerFunctionWithKwargs<TArgs extends any[] = any[], TKwargs extends Record<string, any> = Record<string, any>, TReturn = any> =
    (args: TArgs, kwargs: TKwargs) => Promise<TReturn>; 