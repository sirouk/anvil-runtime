/**
 * App Navigation Bridge
 * 
 * Integrates anvil.open_form() calls with NextJS router and the new app context system.
 * Handles URL parameter management, session persistence, and form navigation.
 */

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';
import type { DiscoveredApp } from './app-discovery';

export interface AnvilNavigationParams {
    [key: string]: any;
}

export interface NavigationOptions {
    replace?: boolean;
    preserveParams?: boolean;
    newTab?: boolean;
}

export class AppNavigationBridge {
    private router: any;
    private currentApp: DiscoveredApp | null;

    constructor(router: any, currentApp: DiscoveredApp | null) {
        this.router = router;
        this.currentApp = currentApp;
    }

    /**
     * Navigate to a form (equivalent to anvil.open_form())
     */
    openForm(formName: string, params: AnvilNavigationParams = {}, options: NavigationOptions = {}): boolean {
        if (!this.currentApp) {
            console.error('Cannot navigate: No app loaded');
            return false;
        }

        // Check if form exists
        if (!this.currentApp.forms.has(formName)) {
            console.error(`Form '${formName}' not found in app '${this.currentApp.name}'`);
            return false;
        }

        try {
            // Build URL with parameters
            const url = this.buildFormUrl(formName, params, options);

            console.log(`🧭 Navigating to form: ${formName}`, { params, url });

            // Handle navigation
            if (options.newTab) {
                window.open(url, '_blank');
            } else if (options.replace) {
                this.router.replace(url);
            } else {
                this.router.push(url);
            }

            return true;

        } catch (error) {
            console.error('Navigation failed:', error);
            return false;
        }
    }

    /**
     * Close current form (navigate back or to main form)
     */
    closeForm(): void {
        // Try to go back, fallback to main form
        if (window.history.length > 1) {
            this.router.back();
        } else {
            const mainForm = this.currentApp?.startupForm || this.currentApp?.forms.keys().next().value;
            if (mainForm) {
                this.openForm(mainForm);
            } else {
                this.router.push('/');
            }
        }
    }

    /**
     * Get current form parameters from URL
     */
    getCurrentParams(): AnvilNavigationParams {
        if (typeof window === 'undefined') return {};

        const searchParams = new URLSearchParams(window.location.search);
        const params: AnvilNavigationParams = {};

        searchParams.forEach((value, key) => {
            try {
                // Try to parse as JSON first
                params[key] = JSON.parse(value);
            } catch {
                // Fall back to string value
                params[key] = value;
            }
        });

        return params;
    }

    /**
     * Update current form parameters
     */
    updateParams(newParams: AnvilNavigationParams, options: NavigationOptions = {}): void {
        const currentParams = this.getCurrentParams();
        const mergedParams = options.preserveParams
            ? { ...currentParams, ...newParams }
            : newParams;

        // Get current form from path
        const pathSegments = window.location.pathname.split('/').filter(Boolean);
        const currentForm = pathSegments[0] || this.currentApp?.startupForm;

        if (currentForm) {
            const url = this.buildFormUrl(currentForm, mergedParams, options);

            if (options.replace) {
                this.router.replace(url);
            } else {
                this.router.push(url);
            }
        }
    }

    /**
     * Check if navigation to form is possible
     */
    canNavigateTo(formName: string): boolean {
        return this.currentApp?.forms.has(formName) || false;
    }

    /**
     * Get list of available forms
     */
    getAvailableForms(): string[] {
        return this.currentApp ? Array.from(this.currentApp.forms.keys()) : [];
    }

    /**
     * Build URL for form with parameters
     */
    private buildFormUrl(formName: string, params: AnvilNavigationParams, options: NavigationOptions): string {
        let url = `/${formName}`;

        // Add parameters as query string
        const paramEntries = Object.entries(params);
        if (paramEntries.length > 0) {
            const searchParams = new URLSearchParams();

            paramEntries.forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    // Serialize complex objects as JSON
                    const serialized = typeof value === 'object'
                        ? JSON.stringify(value)
                        : String(value);
                    searchParams.set(key, serialized);
                }
            });

            if (searchParams.toString()) {
                url += `?${searchParams.toString()}`;
            }
        }

        return url;
    }
}

/**
 * React hook for app navigation
 */
export function useAppNavigation(currentApp: DiscoveredApp | null) {
    const router = useRouter();

    const navigationBridge = new AppNavigationBridge(router, currentApp);

    // Core navigation functions
    const openForm = useCallback((
        formName: string,
        params: AnvilNavigationParams = {},
        options: NavigationOptions = {}
    ) => {
        return navigationBridge.openForm(formName, params, options);
    }, [navigationBridge]);

    const closeForm = useCallback(() => {
        navigationBridge.closeForm();
    }, [navigationBridge]);

    const updateParams = useCallback((
        newParams: AnvilNavigationParams,
        options: NavigationOptions = {}
    ) => {
        navigationBridge.updateParams(newParams, options);
    }, [navigationBridge]);

    // Utility functions
    const canNavigateTo = useCallback((formName: string) => {
        return navigationBridge.canNavigateTo(formName);
    }, [navigationBridge]);

    const getCurrentParams = useCallback(() => {
        return navigationBridge.getCurrentParams();
    }, [navigationBridge]);

    const getAvailableForms = useCallback(() => {
        return navigationBridge.getAvailableForms();
    }, [navigationBridge]);

    return {
        openForm,
        closeForm,
        updateParams,
        canNavigateTo,
        getCurrentParams,
        getAvailableForms
    };
}

/**
 * Global navigation function (for compatibility with anvil.open_form)
 */
let globalNavigationBridge: AppNavigationBridge | null = null;

export function setGlobalNavigationBridge(bridge: AppNavigationBridge): void {
    globalNavigationBridge = bridge;
}

export function openForm(formName: string, params: AnvilNavigationParams = {}): boolean {
    if (!globalNavigationBridge) {
        console.error('Navigation bridge not initialized. Make sure app context is loaded.');
        return false;
    }
    return globalNavigationBridge.openForm(formName, params);
}

export function closeForm(): void {
    if (!globalNavigationBridge) {
        console.error('Navigation bridge not initialized.');
        return;
    }
    globalNavigationBridge.closeForm();
}

// Export for global anvil API
export const anvilNavigation = {
    open_form: openForm,
    close_form: closeForm
};

export default AppNavigationBridge; 