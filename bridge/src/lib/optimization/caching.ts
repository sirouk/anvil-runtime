// Caching utilities for NextJS optimization
import React from 'react';
import { cache } from 'react';

// Server-side caching for data fetching
export const createCache = <T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    options: {
        ttl?: number; // Time to live in milliseconds
        maxSize?: number; // Maximum cache size
        keyGenerator?: (...args: T) => string;
    } = {}
) => {
    const { ttl = 5 * 60 * 1000, maxSize = 100, keyGenerator } = options;

    const cacheMap = new Map<string, { data: R; timestamp: number }>();

    return cache(async (...args: T): Promise<R> => {
        const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
        const now = Date.now();

        // Check if cache exists and is valid
        const cached = cacheMap.get(key);
        if (cached && (now - cached.timestamp) < ttl) {
            return cached.data;
        }

        // Execute function and cache result
        const result = await fn(...args);

        // Manage cache size
        if (cacheMap.size >= maxSize) {
            const firstKey = cacheMap.keys().next().value;
            if (firstKey) {
                cacheMap.delete(firstKey);
            }
        }

        cacheMap.set(key, { data: result, timestamp: now });
        return result;
    });
};

// Server call caching with Anvil integration
export const createServerCallCache = () => {
    return createCache(
        async (functionName: string, ...args: any[]) => {
            // This would integrate with the actual server call system
            const { anvil } = await import('@/lib/server');
            return anvil.server.call(functionName, ...args);
        },
        {
            ttl: 2 * 60 * 1000, // 2 minutes for server calls
            maxSize: 50,
            keyGenerator: (functionName, ...args) => `${functionName}:${JSON.stringify(args)}`
        }
    );
};

// Component-level caching for expensive computations
export const useMemoizedComputation = <T>(
    computation: () => T,
    dependencies: any[],
    options: {
        persist?: boolean;
        key?: string;
    } = {}
) => {
    const { persist = false, key } = options;

    return React.useMemo(() => {
        if (persist && key && typeof window !== 'undefined') {
            const stored = localStorage.getItem(`memo_${key}`);
            if (stored) {
                try {
                    const { data, deps } = JSON.parse(stored);
                    if (JSON.stringify(deps) === JSON.stringify(dependencies)) {
                        return data;
                    }
                } catch (e) {
                    // Invalid stored data, continue with computation
                }
            }
        }

        const result = computation();

        if (persist && key && typeof window !== 'undefined') {
            try {
                localStorage.setItem(`memo_${key}`, JSON.stringify({
                    data: result,
                    deps: dependencies
                }));
            } catch (e) {
                // Storage might be full, ignore
            }
        }

        return result;
    }, dependencies);
};

// Image optimization and caching
export const createImageCache = () => {
    const imageCache = new Map<string, Promise<string>>();

    const preload = (src: string): Promise<string> => {
        const existing = imageCache.get(src);
        if (existing) {
            return existing;
        }

        const promise = new Promise<string>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(src);
            img.onerror = reject;
            img.src = src;
        });

        imageCache.set(src, promise);
        return promise;
    };

    return {
        preload,

        preloadBatch: (srcs: string[]): Promise<string[]> => {
            return Promise.all(srcs.map(src => {
                const cached = imageCache.get(src);
                return cached || preload(src);
            }));
        },

        clear: () => {
            imageCache.clear();
        }
    };
};

// Browser storage utilities with compression
export const createStorageCache = (storage: Storage = localStorage) => {
    const compress = (data: any): string => {
        // Simple compression using JSON.stringify with minimal whitespace
        return JSON.stringify(data);
    };

    const decompress = (data: string): any => {
        try {
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    };

    const get = (key: string): any => {
        try {
            const stored = storage.getItem(key);
            if (!stored) return null;

            const item = decompress(stored);
            if (!item) return null;

            // Check expiration
            if (item.ttl && (Date.now() - item.timestamp) > item.ttl) {
                storage.removeItem(key);
                return null;
            }

            return item.data;
        } catch (e) {
            return null;
        }
    };

    const clearExpired = () => {
        const keys = Object.keys(storage);
        keys.forEach(key => {
            get(key); // This will remove expired items
        });
    };

    return {
        set: (key: string, value: any, ttl?: number) => {
            const item = {
                data: value,
                timestamp: Date.now(),
                ttl
            };

            try {
                storage.setItem(key, compress(item));
            } catch (e) {
                // Storage full, try to clear expired items
                clearExpired();
                try {
                    storage.setItem(key, compress(item));
                } catch (e) {
                    // Still can't store, give up
                }
            }
        },

        get,

        remove: (key: string) => {
            storage.removeItem(key);
        },

        clearExpired,

        clear: () => {
            storage.clear();
        }
    };
};

// Request deduplication for preventing duplicate API calls
export const createRequestDeduplicator = () => {
    const pendingRequests = new Map<string, Promise<any>>();

    return {
        deduplicate: <T>(key: string, requestFn: () => Promise<T>): Promise<T> => {
            if (pendingRequests.has(key)) {
                return pendingRequests.get(key)!;
            }

            const promise = requestFn()
                .finally(() => {
                    pendingRequests.delete(key);
                });

            pendingRequests.set(key, promise);
            return promise;
        },

        clear: (key?: string) => {
            if (key) {
                pendingRequests.delete(key);
            } else {
                pendingRequests.clear();
            }
        }
    };
};

// Export singleton instances for common use
export const serverCallCache = createServerCallCache();
export const imageCache = createImageCache();
export const storageCache = createStorageCache();
export const requestDeduplicator = createRequestDeduplicator(); 