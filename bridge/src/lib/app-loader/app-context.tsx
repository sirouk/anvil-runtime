'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { AppDiscoveryService, type DiscoveredApp } from './app-discovery';
import { AppNavigationBridge, setGlobalNavigationBridge, useAppNavigation } from './app-navigation-bridge';
import type { AnvilFormTemplate } from '../../types/anvil-protocol';
import { useRouter } from 'next/navigation';

/**
 * App Context Provider
 * 
 * Provides global state management for the currently loaded Anvil application including:
 * - App discovery and loading
 * - Current app configuration and forms
 * - Theme management
 * - Loading states and error handling
 * - Navigation integration with NextJS router
 */

export interface AppLoadingState {
    isLoading: boolean;
    isDiscovering: boolean;
    error: string | null;
    lastUpdated?: number;
}

export interface CurrentAppState {
    app: DiscoveredApp | null;
    loadingState: AppLoadingState;
    availableApps: DiscoveredApp[];
    currentForm: string | null;
}

// Action types for app state management
type AppStateAction =
    | { type: 'START_DISCOVERY' }
    | { type: 'DISCOVERY_SUCCESS'; payload: { apps: DiscoveredApp[]; primaryApp?: DiscoveredApp } }
    | { type: 'DISCOVERY_ERROR'; payload: string }
    | { type: 'START_LOADING'; payload: string }
    | { type: 'LOAD_SUCCESS'; payload: DiscoveredApp }
    | { type: 'LOAD_ERROR'; payload: string }
    | { type: 'SET_CURRENT_FORM'; payload: string }
    | { type: 'CLEAR_ERROR' }
    | { type: 'RESET_STATE' };

// Initial state
const initialState: CurrentAppState = {
    app: null,
    loadingState: {
        isLoading: false,
        isDiscovering: false,
        error: null
    },
    availableApps: [],
    currentForm: null
};

// State reducer
function appStateReducer(state: CurrentAppState, action: AppStateAction): CurrentAppState {
    switch (action.type) {
        case 'START_DISCOVERY':
            return {
                ...state,
                loadingState: {
                    ...state.loadingState,
                    isDiscovering: true,
                    error: null
                }
            };

        case 'DISCOVERY_SUCCESS':
            return {
                ...state,
                availableApps: action.payload.apps,
                app: action.payload.primaryApp || null,
                currentForm: action.payload.primaryApp?.startupForm || null,
                loadingState: {
                    isLoading: false,
                    isDiscovering: false,
                    error: null,
                    lastUpdated: Date.now()
                }
            };

        case 'DISCOVERY_ERROR':
            return {
                ...state,
                loadingState: {
                    isLoading: false,
                    isDiscovering: false,
                    error: action.payload,
                    lastUpdated: Date.now()
                }
            };

        case 'START_LOADING':
            return {
                ...state,
                loadingState: {
                    ...state.loadingState,
                    isLoading: true,
                    error: null
                }
            };

        case 'LOAD_SUCCESS':
            return {
                ...state,
                app: action.payload,
                currentForm: action.payload.startupForm || null,
                loadingState: {
                    isLoading: false,
                    isDiscovering: false,
                    error: null,
                    lastUpdated: Date.now()
                }
            };

        case 'LOAD_ERROR':
            return {
                ...state,
                loadingState: {
                    isLoading: false,
                    isDiscovering: false,
                    error: action.payload,
                    lastUpdated: Date.now()
                }
            };

        case 'SET_CURRENT_FORM':
            return {
                ...state,
                currentForm: action.payload
            };

        case 'CLEAR_ERROR':
            return {
                ...state,
                loadingState: {
                    ...state.loadingState,
                    error: null
                }
            };

        case 'RESET_STATE':
            return initialState;

        default:
            return state;
    }
}

// Context interface
interface AppContextValue {
    // State
    state: CurrentAppState;

    // Actions
    discoverApps: () => Promise<void>;
    loadApp: (appName: string) => Promise<void>;
    setCurrentForm: (formName: string) => void;
    clearError: () => void;
    resetState: () => void;

    // Navigation
    openForm: (formName: string, params?: any, options?: any) => boolean;
    closeForm: () => void;
    updateParams: (newParams: any, options?: any) => void;
    canNavigateTo: (formName: string) => boolean;
    getCurrentParams: () => any;
    getAvailableForms: () => string[];

    // Computed values
    isReady: boolean;
    hasError: boolean;
    currentFormTemplate: AnvilFormTemplate | null;
    appTitle: string;
}

// Create context
const AppContext = createContext<AppContextValue | null>(null);

// Provider props
interface AppContextProviderProps {
    children: ReactNode;
    autoDiscover?: boolean;
}

// Provider component
export function AppContextProvider({
    children,
    autoDiscover = true
}: AppContextProviderProps) {
    const [state, dispatch] = useReducer(appStateReducer, initialState);
    const router = useRouter();

    // Navigation integration
    const navigation = useAppNavigation(state.app);

    // Initialize global navigation bridge when app is loaded
    useEffect(() => {
        if (state.app && router) {
            const bridge = new AppNavigationBridge(router, state.app);
            setGlobalNavigationBridge(bridge);
            console.log('🧭 Navigation bridge initialized for app:', state.app.name);
        }
    }, [state.app, router]);

    // Discover apps
    const discoverApps = useCallback(async () => {
        dispatch({ type: 'START_DISCOVERY' });

        try {
            const result = await AppDiscoveryService.discoverApps();

            if (result.errors.length > 0) {
                console.warn('App discovery warnings:', result.errors);
            }

            dispatch({
                type: 'DISCOVERY_SUCCESS',
                payload: {
                    apps: result.apps,
                    primaryApp: result.primaryApp
                }
            });

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to discover apps';
            dispatch({ type: 'DISCOVERY_ERROR', payload: errorMessage });
        }
    }, []);

    // Load specific app
    const loadApp = useCallback(async (appName: string) => {
        const app = state.availableApps.find(a => a.name === appName);
        if (!app) {
            dispatch({ type: 'LOAD_ERROR', payload: `App '${appName}' not found` });
            return;
        }

        dispatch({ type: 'START_LOADING', payload: appName });

        try {
            // App is already loaded from discovery, just set it as current
            dispatch({ type: 'LOAD_SUCCESS', payload: app });
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : `Failed to load app '${appName}'`;
            dispatch({ type: 'LOAD_ERROR', payload: errorMessage });
        }
    }, [state.availableApps]);

    // Set current form
    const setCurrentForm = useCallback((formName: string) => {
        if (state.app?.forms.has(formName)) {
            dispatch({ type: 'SET_CURRENT_FORM', payload: formName });
        } else {
            console.warn(`Form '${formName}' not found in current app`);
        }
    }, [state.app]);

    // Clear error
    const clearError = useCallback(() => {
        dispatch({ type: 'CLEAR_ERROR' });
    }, []);

    // Reset state
    const resetState = useCallback(() => {
        dispatch({ type: 'RESET_STATE' });
    }, []);

    // Auto-discover apps on mount
    useEffect(() => {
        if (autoDiscover && state.availableApps.length === 0 && !state.loadingState.isDiscovering) {
            console.log('🔍 Auto-discovering Anvil apps...');
            discoverApps();
        }
    }, [autoDiscover, discoverApps, state.availableApps.length, state.loadingState.isDiscovering]);

    // Computed values
    const isReady = state.app !== null && !state.loadingState.isLoading && !state.loadingState.isDiscovering;
    const hasError = state.loadingState.error !== null;
    const currentFormTemplate = state.app && state.currentForm
        ? state.app.forms.get(state.currentForm) || null
        : null;
    const appTitle = state.app?.config.metadata?.title || state.app?.config.name || 'Anvil App';

    const contextValue: AppContextValue = {
        state,
        discoverApps,
        loadApp,
        setCurrentForm,
        clearError,
        resetState,

        // Navigation functions
        openForm: navigation.openForm,
        closeForm: navigation.closeForm,
        updateParams: navigation.updateParams,
        canNavigateTo: navigation.canNavigateTo,
        getCurrentParams: navigation.getCurrentParams,
        getAvailableForms: navigation.getAvailableForms,

        isReady,
        hasError,
        currentFormTemplate,
        appTitle
    };

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
}

// Hook to use app context
export function useAppContext(): AppContextValue {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppContext must be used within an AppContextProvider');
    }
    return context;
}

// Convenience hooks
export function useCurrentApp(): DiscoveredApp | null {
    const { state } = useAppContext();
    return state.app;
}

export function useCurrentForm(): AnvilFormTemplate | null {
    const { currentFormTemplate } = useAppContext();
    return currentFormTemplate;
}

export function useAppLoading(): AppLoadingState {
    const { state } = useAppContext();
    return state.loadingState;
}

export function useAppError(): string | null {
    const { state } = useAppContext();
    return state.loadingState.error;
}

// Navigation hooks
export function useAnvilNavigation() {
    const { openForm, closeForm, updateParams, canNavigateTo, getCurrentParams, getAvailableForms } = useAppContext();
    return { openForm, closeForm, updateParams, canNavigateTo, getCurrentParams, getAvailableForms };
}

// Default export
export default AppContextProvider; 