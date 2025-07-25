// Performance optimization utilities
import { storageCache } from './caching';

// Performance monitoring and optimization
export class PerformanceMonitor {
    private static instance: PerformanceMonitor;
    private metrics: Map<string, number[]> = new Map();
    private memoryUsage: number[] = [];
    private observers: PerformanceObserver[] = [];

    static getInstance(): PerformanceMonitor {
        if (!PerformanceMonitor.instance) {
            PerformanceMonitor.instance = new PerformanceMonitor();
        }
        return PerformanceMonitor.instance;
    }

    constructor() {
        this.setupObservers();
        this.startMemoryMonitoring();
    }

    private setupObservers(): void {
        if (typeof window === 'undefined') return;

        // Largest Contentful Paint observer
        const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            this.recordMetric('lcp', lastEntry.startTime);
        });

        // First Input Delay observer
        const fidObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                const eventEntry = entry as any; // Type assertion for processingStart
                if (eventEntry.processingStart) {
                    const fid = eventEntry.processingStart - entry.startTime;
                    this.recordMetric('fid', fid);
                }
            }
        });

        // Cumulative Layout Shift observer
        const clsObserver = new PerformanceObserver((list) => {
            let clsValue = 0;
            for (const entry of list.getEntries()) {
                const layoutEntry = entry as any; // Type assertion for layout shift properties
                if (layoutEntry.value !== undefined && !layoutEntry.hadRecentInput) {
                    clsValue += layoutEntry.value;
                }
            }
            this.recordMetric('cls', clsValue);
        });

        try {
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            fidObserver.observe({ entryTypes: ['first-input'] });
            clsObserver.observe({ entryTypes: ['layout-shift'] });

            this.observers.push(lcpObserver, fidObserver, clsObserver);
        } catch (e) {
            console.log('Performance observers not supported');
        }
    }

    private startMemoryMonitoring(): void {
        if (typeof window === 'undefined' || !('memory' in performance)) return;

        const checkMemory = () => {
            const memory = (performance as any).memory;
            if (memory) {
                this.memoryUsage.push(memory.usedJSHeapSize);
                // Keep only last 100 measurements
                if (this.memoryUsage.length > 100) {
                    this.memoryUsage.shift();
                }
            }
        };

        // Check memory usage every 10 seconds
        setInterval(checkMemory, 10000);
        checkMemory(); // Initial check
    }

    recordMetric(name: string, value: number): void {
        if (!this.metrics.has(name)) {
            this.metrics.set(name, []);
        }

        const values = this.metrics.get(name)!;
        values.push(value);

        // Keep only last 50 measurements
        if (values.length > 50) {
            values.shift();
        }

        // Store in cache for persistence
        storageCache.set(`perf_${name}`, values, 24 * 60 * 60 * 1000); // 24 hours
    }

    getMetrics(): Record<string, { avg: number; min: number; max: number; count: number }> {
        const result: Record<string, any> = {};

        for (const [name, values] of this.metrics.entries()) {
            if (values.length > 0) {
                result[name] = {
                    avg: values.reduce((a, b) => a + b, 0) / values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    count: values.length
                };
            }
        }

        return result;
    }

    getMemoryUsage(): { current: number; average: number; peak: number } {
        if (this.memoryUsage.length === 0) {
            return { current: 0, average: 0, peak: 0 };
        }

        return {
            current: this.memoryUsage[this.memoryUsage.length - 1],
            average: this.memoryUsage.reduce((a, b) => a + b, 0) / this.memoryUsage.length,
            peak: Math.max(...this.memoryUsage)
        };
    }

    cleanup(): void {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }
}

// Bundle size analysis
export const analyzeBundleSize = async () => {
    if (typeof window === 'undefined') return null;

    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

    const sizes = await Promise.all([
        ...scripts.map(async (script) => {
            const src = script.getAttribute('src');
            if (src) {
                try {
                    const response = await fetch(src, { method: 'HEAD' });
                    return {
                        type: 'script',
                        url: src,
                        size: parseInt(response.headers.get('content-length') || '0', 10)
                    };
                } catch (e) {
                    return { type: 'script', url: src, size: 0 };
                }
            }
            return null;
        }),
        ...styles.map(async (style) => {
            const href = style.getAttribute('href');
            if (href) {
                try {
                    const response = await fetch(href, { method: 'HEAD' });
                    return {
                        type: 'style',
                        url: href,
                        size: parseInt(response.headers.get('content-length') || '0', 10)
                    };
                } catch (e) {
                    return { type: 'style', url: href, size: 0 };
                }
            }
            return null;
        })
    ]);

    return sizes.filter(Boolean);
};

// Loading time optimization
export const optimizeLoadingTimes = () => {
    if (typeof window === 'undefined') return;

    // Preload critical resources
    const preloadCriticalResources = () => {
        const criticalResources = [
            '/_next/static/css/app.css',
            '/_next/static/js/app.js'
        ];

        criticalResources.forEach(resource => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.href = resource;
            link.as = resource.endsWith('.css') ? 'style' : 'script';
            document.head.appendChild(link);
        });
    };

    // Optimize images
    const optimizeImages = () => {
        const images = document.querySelectorAll('img');
        images.forEach(img => {
            // Add loading="lazy" if not present
            if (!img.hasAttribute('loading')) {
                img.setAttribute('loading', 'lazy');
            }

            // Add decoding="async" for better performance
            if (!img.hasAttribute('decoding')) {
                img.setAttribute('decoding', 'async');
            }
        });
    };

    // Defer non-critical JavaScript
    const deferNonCriticalJS = () => {
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
            const src = script.getAttribute('src');
            if (src && !src.includes('critical') && !script.hasAttribute('defer')) {
                script.setAttribute('defer', '');
            }
        });
    };

    preloadCriticalResources();
    optimizeImages();
    deferNonCriticalJS();
};

// Memory management utilities
export class MemoryManager {
    private static weakRefs: Set<WeakRef<any>> = new Set();
    private static cleanupIntervalId: number | null = null;

    static trackObject<T extends object>(obj: T): T {
        const weakRef = new WeakRef(obj);
        this.weakRefs.add(weakRef);

        if (!this.cleanupIntervalId) {
            this.startCleanupTimer();
        }

        return obj;
    }

    static forceGarbageCollection(): void {
        if ('gc' in window && typeof (window as any).gc === 'function') {
            (window as any).gc();
        }
    }

    static getActiveObjectCount(): number {
        let count = 0;
        for (const ref of this.weakRefs) {
            if (ref.deref() !== undefined) {
                count++;
            }
        }
        return count;
    }

    private static startCleanupTimer(): void {
        this.cleanupIntervalId = window.setInterval(() => {
            const activeRefs = new Set<WeakRef<any>>();

            for (const ref of this.weakRefs) {
                if (ref.deref() !== undefined) {
                    activeRefs.add(ref);
                }
            }

            this.weakRefs = activeRefs;

            if (this.weakRefs.size === 0 && this.cleanupIntervalId) {
                clearInterval(this.cleanupIntervalId);
                this.cleanupIntervalId = null;
            }
        }, 30000); // Clean up every 30 seconds
    }

    static cleanup(): void {
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = null;
        }
        this.weakRefs.clear();
    }
}

// Performance hooks for React components
export const usePerformanceOptimization = () => {
    const monitor = PerformanceMonitor.getInstance();

    const measureComponent = (name: string) => {
        const start = performance.now();
        return () => {
            const end = performance.now();
            monitor.recordMetric(`component_${name}`, end - start);
        };
    };

    const measureAsyncOperation = async <T>(
        name: string,
        operation: () => Promise<T>
    ): Promise<T> => {
        const start = performance.now();
        try {
            const result = await operation();
            const end = performance.now();
            monitor.recordMetric(`async_${name}`, end - start);
            return result;
        } catch (error) {
            const end = performance.now();
            monitor.recordMetric(`async_${name}_error`, end - start);
            throw error;
        }
    };

    return {
        measureComponent,
        measureAsyncOperation,
        getMetrics: () => monitor.getMetrics(),
        getMemoryUsage: () => monitor.getMemoryUsage()
    };
};

// Component optimization utilities
export const optimizeComponentRender = () => {
    // Batch DOM updates
    const batchDOMUpdates = (updates: (() => void)[]) => {
        requestAnimationFrame(() => {
            updates.forEach(update => update());
        });
    };

    // Debounce expensive operations
    const debounce = <T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): T => {
        let timeout: NodeJS.Timeout;
        return ((...args: any[]) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(null, args), wait);
        }) as T;
    };

    // Throttle high-frequency events
    const throttle = <T extends (...args: any[]) => any>(
        func: T,
        limit: number
    ): T => {
        let inThrottle: boolean;
        return ((...args: any[]) => {
            if (!inThrottle) {
                func.apply(null, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        }) as T;
    };

    return {
        batchDOMUpdates,
        debounce,
        throttle
    };
};

// Network optimization
export const optimizeNetworkRequests = () => {
    const requestQueue: Array<{
        url: string;
        options: RequestInit;
        resolve: (value: Response) => void;
        reject: (reason: any) => void;
    }> = [];

    let isProcessing = false;

    const processQueue = async () => {
        if (isProcessing || requestQueue.length === 0) return;

        isProcessing = true;

        while (requestQueue.length > 0) {
            const batch = requestQueue.splice(0, 5); // Process 5 at a time

            await Promise.all(
                batch.map(async ({ url, options, resolve, reject }) => {
                    try {
                        const response = await fetch(url, options);
                        resolve(response);
                    } catch (error) {
                        reject(error);
                    }
                })
            );

            // Small delay between batches
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        isProcessing = false;
    };

    const queuedFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
        return new Promise((resolve, reject) => {
            requestQueue.push({ url, options, resolve, reject });
            processQueue();
        });
    };

    return {
        queuedFetch,
        getQueueLength: () => requestQueue.length
    };
};

// Export performance monitor instance
export const performanceMonitor = PerformanceMonitor.getInstance();

// Initialize performance optimizations
export const initializePerformanceOptimizations = () => {
    if (typeof window !== 'undefined') {
        // Set up optimizations when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', optimizeLoadingTimes);
        } else {
            optimizeLoadingTimes();
        }

        // Clean up memory manager on page unload
        window.addEventListener('beforeunload', () => {
            MemoryManager.cleanup();
            performanceMonitor.cleanup();
        });
    }
}; 