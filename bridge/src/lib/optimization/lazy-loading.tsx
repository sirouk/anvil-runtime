// Lazy loading utilities for NextJS optimization
import React, { Suspense, lazy } from 'react';
import dynamic from 'next/dynamic';

// Lazy component wrapper with error boundary
interface LazyComponentProps {
    fallback?: React.ReactNode;
    errorFallback?: React.ReactNode;
    children: React.ReactNode;
}

const ErrorBoundary: React.FC<{
    fallback: React.ReactNode;
    children: React.ReactNode;
}> = ({ fallback, children }) => {
    const [hasError, setHasError] = React.useState(false);

    React.useEffect(() => {
        const errorHandler = (error: ErrorEvent) => {
            console.error('Component error:', error);
            setHasError(true);
        };

        window.addEventListener('error', errorHandler);
        return () => window.removeEventListener('error', errorHandler);
    }, []);

    if (hasError) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};

export const LazyWrapper: React.FC<LazyComponentProps> = ({
    fallback = <div className="anvil-loading">Loading...</div>,
    errorFallback = <div className="anvil-error">Failed to load component</div>,
    children
}) => {
    return (
        <ErrorBoundary fallback={errorFallback}>
            <Suspense fallback={fallback}>
                {children}
            </Suspense>
        </ErrorBoundary>
    );
};

// Dynamic import utilities for Anvil components
export const createLazyAnvilComponent = <T extends React.ComponentType<any>>(
    importFn: () => Promise<{ default: T }>,
    options: {
        fallback?: React.ReactNode;
        ssr?: boolean;
    } = {}
) => {
    const { fallback, ssr = false } = options;

    // Use Next.js dynamic for better SSR support
    return dynamic(importFn, {
        ssr,
        loading: () => <>{fallback || <div>Loading component...</div>}</>
    });
};

// Intersection Observer for lazy loading
export const useIntersectionObserver = (
    options: IntersectionObserverInit = {}
) => {
    const [isIntersecting, setIsIntersecting] = React.useState(false);
    const [hasIntersected, setHasIntersected] = React.useState(false);
    const targetRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const target = targetRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(([entry]) => {
            const isCurrentlyIntersecting = entry.isIntersecting;
            setIsIntersecting(isCurrentlyIntersecting);

            if (isCurrentlyIntersecting && !hasIntersected) {
                setHasIntersected(true);
            }
        }, {
            threshold: 0.1,
            rootMargin: '50px',
            ...options
        });

        observer.observe(target);

        return () => {
            observer.unobserve(target);
        };
    }, [hasIntersected, options]);

    return { targetRef, isIntersecting, hasIntersected };
};

// Lazy loading container component
interface LazyLoadProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    height?: number | string;
    className?: string;
    once?: boolean; // Only load once when visible
    offset?: string; // Root margin for intersection observer
}

export const LazyLoad: React.FC<LazyLoadProps> = ({
    children,
    fallback = <div>Loading...</div>,
    height = 'auto',
    className = '',
    once = true,
    offset = '50px'
}) => {
    const { targetRef, isIntersecting, hasIntersected } = useIntersectionObserver({
        rootMargin: offset
    });

    const shouldRender = once ? hasIntersected : isIntersecting;

    return (
        <div
            ref={targetRef}
            className={`anvil-lazy-load ${className}`}
            style={{ height, minHeight: height }}
        >
            {shouldRender ? children : fallback}
        </div>
    );
};

// Image lazy loading with placeholder
interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    placeholder?: string;
    fallback?: string;
    onLoad?: () => void;
    onError?: () => void;
}

export const LazyImage: React.FC<LazyImageProps> = ({
    src,
    alt,
    placeholder,
    fallback,
    onLoad,
    onError,
    className = '',
    ...props
}) => {
    const [isLoaded, setIsLoaded] = React.useState(false);
    const [hasError, setHasError] = React.useState(false);
    const [imageSrc, setImageSrc] = React.useState(placeholder || '');
    const [hasIntersected, setHasIntersected] = React.useState(false);
    const imageRef = React.useRef<HTMLImageElement>(null);

    React.useEffect(() => {
        const target = imageRef.current;
        if (!target) return;

        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting && !hasIntersected) {
                setHasIntersected(true);
            }
        }, {
            threshold: 0.1,
            rootMargin: '50px'
        });

        observer.observe(target);
        return () => observer.unobserve(target);
    }, [hasIntersected]);

    React.useEffect(() => {
        if (hasIntersected && !isLoaded && !hasError) {
            const img = new Image();

            img.onload = () => {
                setImageSrc(src);
                setIsLoaded(true);
                onLoad?.();
            };

            img.onerror = () => {
                if (fallback) {
                    setImageSrc(fallback);
                }
                setHasError(true);
                onError?.();
            };

            img.src = src;
        }
    }, [hasIntersected, src, fallback, isLoaded, hasError, onLoad, onError]);

    return (
        <img
            ref={imageRef}
            src={imageSrc}
            alt={alt}
            className={`anvil-lazy-image ${className} ${isLoaded ? 'loaded' : ''}`}
            {...props}
        />
    );
};

// Code splitting utilities for Anvil components
// Note: Component chunks can be created when the actual component modules exist
export const createComponentChunks = () => {
    // This will be implemented when the enhanced component modules are available
    return {
        CoreComponents: {},
        LayoutComponents: {},
        HeavyComponents: {}
    };
};

// Progressive component loading
export const useProgressiveLoading = (components: string[]) => {
    const [loadedComponents, setLoadedComponents] = React.useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = React.useState(false);

    const loadComponent = React.useCallback(async (componentName: string) => {
        if (loadedComponents.has(componentName)) return;

        setIsLoading(true);
        try {
            // Simulate component loading
            await new Promise(resolve => setTimeout(resolve, 100));
            setLoadedComponents(prev => new Set([...prev, componentName]));
        } catch (error) {
            console.error(`Failed to load component: ${componentName}`, error);
        } finally {
            setIsLoading(false);
        }
    }, [loadedComponents]);

    const loadComponents = React.useCallback(async (names: string[]) => {
        const promises = names
            .filter(name => !loadedComponents.has(name))
            .map(name => loadComponent(name));

        await Promise.all(promises);
    }, [loadComponent, loadedComponents]);

    const preloadComponents = React.useCallback((names: string[]) => {
        // Start loading but don't wait
        names.forEach(name => {
            if (!loadedComponents.has(name)) {
                loadComponent(name);
            }
        });
    }, [loadComponent, loadedComponents]);

    return {
        loadedComponents,
        isLoading,
        loadComponent,
        loadComponents,
        preloadComponents
    };
};

// Virtual scrolling for large lists
interface VirtualScrollProps {
    items: any[];
    itemHeight: number;
    containerHeight: number;
    renderItem: (item: any, index: number) => React.ReactNode;
    overscan?: number;
}

export const VirtualScroll: React.FC<VirtualScrollProps> = ({
    items,
    itemHeight,
    containerHeight,
    renderItem,
    overscan = 5
}) => {
    const [scrollTop, setScrollTop] = React.useState(0);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const totalHeight = items.length * itemHeight;
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
        items.length - 1,
        Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );

    const visibleItems = items.slice(startIndex, endIndex + 1);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        setScrollTop(e.currentTarget.scrollTop);
    };

    return (
        <div
            ref={containerRef}
            className="anvil-virtual-scroll"
            style={{
                height: containerHeight,
                overflow: 'auto'
            }}
            onScroll={handleScroll}
        >
            <div style={{ height: totalHeight, position: 'relative' }}>
                <div
                    style={{
                        transform: `translateY(${startIndex * itemHeight}px)`
                    }}
                >
                    {visibleItems.map((item, index) =>
                        renderItem(item, startIndex + index)
                    )}
                </div>
            </div>
        </div>
    );
};

// Resource prefetching utilities
export const usePrefetch = () => {
    const prefetchedResources = React.useRef<Set<string>>(new Set());

    const prefetchComponent = React.useCallback((componentPath: string) => {
        if (prefetchedResources.current.has(componentPath)) return;

        const link = document.createElement('link');
        link.rel = 'modulepreload';
        link.href = componentPath;
        document.head.appendChild(link);

        prefetchedResources.current.add(componentPath);
    }, []);

    const prefetchImage = React.useCallback((src: string) => {
        if (prefetchedResources.current.has(src)) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);

        prefetchedResources.current.add(src);
    }, []);

    const prefetchStyle = React.useCallback((href: string) => {
        if (prefetchedResources.current.has(href)) return;

        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'style';
        link.href = href;
        document.head.appendChild(link);

        prefetchedResources.current.add(href);
    }, []);

    return {
        prefetchComponent,
        prefetchImage,
        prefetchStyle
    };
}; 