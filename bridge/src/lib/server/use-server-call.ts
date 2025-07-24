/**
 * React Hooks for Anvil Server Calls
 * 
 * Provides easy-to-use React hooks for calling server functions
 * with automatic loading states, error handling, and caching
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getServerCallManager,
    type ServerCallOptions,
    type ServerCallError,
    type AnvilServerCallManager
} from './anvil-server-calls';

export interface UseServerCallState<T> {
    data: T | null;
    loading: boolean;
    error: ServerCallError | null;
    called: boolean;
}

export interface UseServerCallOptions extends ServerCallOptions {
    skip?: boolean;
    fetchPolicy?: 'cache-first' | 'cache-and-network' | 'network-only' | 'no-cache';
    pollInterval?: number;
    onCompleted?: (data: any) => void;
    onError?: (error: ServerCallError) => void;
}

export interface UseServerCallResult<T> extends UseServerCallState<T> {
    call: (...args: any[]) => Promise<T>;
    refetch: () => Promise<T>;
    reset: () => void;
}

export interface UseLazyServerCallResult<T> {
    call: (...args: any[]) => Promise<T>;
    data: T | null;
    loading: boolean;
    error: ServerCallError | null;
    called: boolean;
    reset: () => void;
}

// Simple cache for server call results
interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class ServerCallCache {
    private cache = new Map<string, CacheEntry<any>>();
    private defaultTTL = 5 * 60 * 1000; // 5 minutes

    set<T>(key: string, data: T, ttl?: number): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl: ttl ?? this.defaultTTL
        });
    }

    get<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        return entry.data;
    }

    clear(): void {
        this.cache.clear();
    }

    delete(key: string): boolean {
        return this.cache.delete(key);
    }

    has(key: string): boolean {
        const entry = this.cache.get(key);
        if (!entry) return false;

        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return false;
        }

        return true;
    }
}

const serverCallCache = new ServerCallCache();

/**
 * Generate cache key for a server call
 */
function generateCacheKey(functionName: string, args: any[]): string {
    return `${functionName}:${JSON.stringify(args)}`;
}

/**
 * Hook for making server calls with automatic loading states
 * Similar to Apollo's useQuery
 */
export function useServerCall<T = any>(
    functionName: string,
    args: any[] = [],
    options: UseServerCallOptions = {}
): UseServerCallResult<T> {
    const [state, setState] = useState<UseServerCallState<T>>({
        data: null,
        loading: false,
        error: null,
        called: false
    });

    const optionsRef = useRef(options);
    const argsRef = useRef(args);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    optionsRef.current = options;
    argsRef.current = args;

    const cacheKey = generateCacheKey(functionName, args);

    const executeCall = useCallback(async (...callArgs: any[]): Promise<T> => {
        const finalArgs = callArgs.length > 0 ? callArgs : argsRef.current;
        const finalCacheKey = generateCacheKey(functionName, finalArgs);

        try {
            setState(prev => ({ ...prev, loading: true, error: null }));

            // Check cache first if policy allows
            const { fetchPolicy = 'cache-first' } = optionsRef.current;
            if (fetchPolicy === 'cache-first' && serverCallCache.has(finalCacheKey)) {
                const cachedData = serverCallCache.get<T>(finalCacheKey);
                if (cachedData !== null) {
                    setState({
                        data: cachedData,
                        loading: false,
                        error: null,
                        called: true
                    });

                    if (optionsRef.current.onCompleted) {
                        optionsRef.current.onCompleted(cachedData);
                    }

                    return cachedData;
                }
            }

            // Make server call
            const manager = getServerCallManager();
            const result = await manager.call<T>(functionName, finalArgs, {}, optionsRef.current);

            // Cache result if policy allows
            if (fetchPolicy !== 'no-cache') {
                serverCallCache.set(finalCacheKey, result, 5 * 60 * 1000); // 5 min TTL
            }

            setState({
                data: result,
                loading: false,
                error: null,
                called: true
            });

            if (optionsRef.current.onCompleted) {
                optionsRef.current.onCompleted(result);
            }

            return result;

        } catch (error) {
            const serverError = error as ServerCallError;
            setState({
                data: null,
                loading: false,
                error: serverError,
                called: true
            });

            if (optionsRef.current.onError) {
                optionsRef.current.onError(serverError);
            }

            throw serverError;
        }
    }, [functionName]);

    const refetch = useCallback(async (): Promise<T> => {
        return executeCall(...argsRef.current);
    }, [executeCall]);

    const reset = useCallback(() => {
        setState({
            data: null,
            loading: false,
            error: null,
            called: false
        });
        serverCallCache.delete(cacheKey);
    }, [cacheKey]);

    // Auto-execute if not skipped
    useEffect(() => {
        if (!options.skip && !state.called) {
            executeCall();
        }
    }, [executeCall, options.skip, state.called]);

    // Set up polling if specified
    useEffect(() => {
        if (options.pollInterval && options.pollInterval > 0 && !options.skip) {
            pollIntervalRef.current = setInterval(() => {
                executeCall();
            }, options.pollInterval);

            return () => {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                }
            };
        }
    }, [executeCall, options.pollInterval, options.skip]);

    // Cleanup polling on unmount
    useEffect(() => {
        return () => {
            if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
            }
        };
    }, []);

    return {
        ...state,
        call: executeCall,
        refetch,
        reset
    };
}

/**
 * Hook for lazy server calls (call when needed)
 * Similar to Apollo's useLazyQuery
 */
export function useLazyServerCall<T = any>(
    functionName: string,
    options: UseServerCallOptions = {}
): UseLazyServerCallResult<T> {
    const [state, setState] = useState<UseServerCallState<T>>({
        data: null,
        loading: false,
        error: null,
        called: false
    });

    const optionsRef = useRef(options);
    optionsRef.current = options;

    const call = useCallback(async (...args: any[]): Promise<T> => {
        const cacheKey = generateCacheKey(functionName, args);

        try {
            setState(prev => ({ ...prev, loading: true, error: null }));

            // Check cache first if policy allows
            const { fetchPolicy = 'cache-first' } = optionsRef.current;
            if (fetchPolicy === 'cache-first' && serverCallCache.has(cacheKey)) {
                const cachedData = serverCallCache.get<T>(cacheKey);
                if (cachedData !== null) {
                    setState({
                        data: cachedData,
                        loading: false,
                        error: null,
                        called: true
                    });

                    if (optionsRef.current.onCompleted) {
                        optionsRef.current.onCompleted(cachedData);
                    }

                    return cachedData;
                }
            }

            // Make server call
            const manager = getServerCallManager();
            const result = await manager.call<T>(functionName, args, {}, optionsRef.current);

            // Cache result if policy allows
            if (fetchPolicy !== 'no-cache') {
                serverCallCache.set(cacheKey, result, 5 * 60 * 1000); // 5 min TTL
            }

            setState({
                data: result,
                loading: false,
                error: null,
                called: true
            });

            if (optionsRef.current.onCompleted) {
                optionsRef.current.onCompleted(result);
            }

            return result;

        } catch (error) {
            const serverError = error as ServerCallError;
            setState({
                data: null,
                loading: false,
                error: serverError,
                called: true
            });

            if (optionsRef.current.onError) {
                optionsRef.current.onError(serverError);
            }

            throw serverError;
        }
    }, [functionName]);

    const reset = useCallback(() => {
        setState({
            data: null,
            loading: false,
            error: null,
            called: false
        });
    }, []);

    return {
        call,
        ...state,
        reset
    };
}

/**
 * Hook for server calls with mutation-like behavior
 * Includes optimistic updates and rollback on error
 */
export function useServerMutation<T = any, TVariables = any>(
    functionName: string,
    options: UseServerCallOptions & {
        optimisticResponse?: (variables: TVariables) => T;
        update?: (cache: any, result: { data: T }) => void;
        refetchQueries?: string[];
    } = {}
): [
        (variables: TVariables) => Promise<T>,
        {
            data: T | null;
            loading: boolean;
            error: ServerCallError | null;
            called: boolean;
            reset: () => void;
        }
    ] {
    const [state, setState] = useState<UseServerCallState<T>>({
        data: null,
        loading: false,
        error: null,
        called: false
    });

    const optionsRef = useRef(options);
    optionsRef.current = options;

    const mutate = useCallback(async (variables: TVariables): Promise<T> => {
        try {
            setState(prev => ({ ...prev, loading: true, error: null, called: true }));

            // Apply optimistic response if provided
            if (optionsRef.current.optimisticResponse) {
                const optimisticData = optionsRef.current.optimisticResponse(variables);
                setState(prev => ({ ...prev, data: optimisticData }));
            }

            // Make server call
            const manager = getServerCallManager();
            const args = Array.isArray(variables) ? variables : [variables];
            const result = await manager.call<T>(functionName, args, {}, optionsRef.current);

            setState({
                data: result,
                loading: false,
                error: null,
                called: true
            });

            // Call update function if provided
            if (optionsRef.current.update) {
                optionsRef.current.update(serverCallCache, { data: result });
            }

            // Refetch queries if specified
            if (optionsRef.current.refetchQueries) {
                // This would need integration with the query cache
                // For now, just clear relevant cache entries
                optionsRef.current.refetchQueries.forEach(queryKey => {
                    // Clear cache entries that start with the query key
                    for (const key of Array.from(serverCallCache['cache'].keys())) {
                        if (key.startsWith(queryKey)) {
                            serverCallCache.delete(key);
                        }
                    }
                });
            }

            if (optionsRef.current.onCompleted) {
                optionsRef.current.onCompleted(result);
            }

            return result;

        } catch (error) {
            const serverError = error as ServerCallError;
            setState({
                data: null, // Reset optimistic data on error
                loading: false,
                error: serverError,
                called: true
            });

            if (optionsRef.current.onError) {
                optionsRef.current.onError(serverError);
            }

            throw serverError;
        }
    }, [functionName]);

    const reset = useCallback(() => {
        setState({
            data: null,
            loading: false,
            error: null,
            called: false
        });
    }, []);

    return [mutate, { ...state, reset }];
}

/**
 * Hook to get server call manager instance
 */
export function useServerCallManager(): AnvilServerCallManager {
    return getServerCallManager();
}

/**
 * Hook to check server connection status
 */
export function useServerConnection(): {
    isConnected: boolean;
    pendingCalls: number;
    reconnect: () => Promise<void>;
} {
    const [isConnected, setIsConnected] = useState(false);
    const [pendingCalls, setPendingCalls] = useState(0);
    const manager = getServerCallManager();

    useEffect(() => {
        const updateStatus = () => {
            setIsConnected(manager.isConnectedToServer());
            setPendingCalls(manager.getPendingCallsCount());
        };

        updateStatus();

        // Set up event listeners
        manager.onConnected(updateStatus);
        manager.onDisconnected(updateStatus);

        // Poll for pending calls count
        const interval = setInterval(updateStatus, 1000);

        return () => {
            clearInterval(interval);
        };
    }, [manager]);

    const reconnect = useCallback(async () => {
        // This would need the original WebSocket URL
        // For now, this is a placeholder
        throw new Error('Reconnect not implemented - would need WebSocket URL');
    }, []);

    return {
        isConnected,
        pendingCalls,
        reconnect
    };
}

/**
 * Clear all server call caches
 */
export function clearServerCallCache(): void {
    serverCallCache.clear();
}

/**
 * Get cache statistics
 */
export function getServerCallCacheStats(): {
    size: number;
    keys: string[];
} {
    const cache = serverCallCache['cache'];
    return {
        size: cache.size,
        keys: Array.from(cache.keys())
    };
} 