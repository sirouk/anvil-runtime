'use client';

import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

/**
 * Navigation State Management for Anvil Forms
 * 
 * Manages form lifecycle, navigation history, parameter passing, and browser integration
 * Provides compatibility layer for Anvil's open_form() API
 */

export interface AnvilFormParams {
    [key: string]: any;
}

export interface AnvilFormState {
    formName: string;
    mountedAt: Date;
    params: AnvilFormParams;
    isLoading: boolean;
    isSubmitting: boolean;
    validationErrors: Record<string, string>;
    isDirty: boolean;
    canNavigateAway: boolean;
}

export interface NavigationHistoryEntry {
    formName: string;
    params: AnvilFormParams;
    timestamp: Date;
    url: string;
    title: string;
}

export interface AnvilNavigationState {
    currentForm: string | null;
    formStates: Record<string, AnvilFormState>;
    navigationHistory: NavigationHistoryEntry[];
    isNavigating: boolean;
    canGoBack: boolean;
    canGoForward: boolean;
    pendingNavigation: {
        formName: string;
        params: AnvilFormParams;
    } | null;
}

// Navigation Actions
type NavigationAction =
    | { type: 'NAVIGATE_TO_FORM'; payload: { formName: string; params: AnvilFormParams; url: string; title: string } }
    | { type: 'FORM_MOUNTED'; payload: { formName: string; params: AnvilFormParams } }
    | { type: 'FORM_UNMOUNTED'; payload: { formName: string } }
    | { type: 'SET_FORM_LOADING'; payload: { formName: string; isLoading: boolean } }
    | { type: 'SET_FORM_SUBMITTING'; payload: { formName: string; isSubmitting: boolean } }
    | { type: 'SET_FORM_VALIDATION_ERRORS'; payload: { formName: string; errors: Record<string, string> } }
    | { type: 'SET_FORM_DIRTY'; payload: { formName: string; isDirty: boolean } }
    | { type: 'SET_CAN_NAVIGATE_AWAY'; payload: { formName: string; canNavigateAway: boolean } }
    | { type: 'CLEAR_FORM_ERRORS'; payload: { formName: string } }
    | { type: 'GO_BACK' }
    | { type: 'GO_FORWARD' }
    | { type: 'SET_NAVIGATING'; payload: { isNavigating: boolean } }
    | { type: 'SET_PENDING_NAVIGATION'; payload: { formName: string; params: AnvilFormParams } | null };

const initialState: AnvilNavigationState = {
    currentForm: null,
    formStates: {},
    navigationHistory: [],
    isNavigating: false,
    canGoBack: false,
    canGoForward: false,
    pendingNavigation: null
};

function navigationReducer(state: AnvilNavigationState, action: NavigationAction): AnvilNavigationState {
    switch (action.type) {
        case 'NAVIGATE_TO_FORM':
            const { formName, params, url, title } = action.payload;
            const historyEntry: NavigationHistoryEntry = {
                formName,
                params,
                timestamp: new Date(),
                url,
                title
            };

            return {
                ...state,
                currentForm: formName,
                navigationHistory: [...state.navigationHistory, historyEntry],
                canGoBack: state.navigationHistory.length > 0,
                canGoForward: false,
                pendingNavigation: null
            };

        case 'FORM_MOUNTED':
            const formState: AnvilFormState = {
                formName: action.payload.formName,
                mountedAt: new Date(),
                params: action.payload.params,
                isLoading: false,
                isSubmitting: false,
                validationErrors: {},
                isDirty: false,
                canNavigateAway: true
            };

            return {
                ...state,
                formStates: {
                    ...state.formStates,
                    [action.payload.formName]: formState
                }
            };

        case 'FORM_UNMOUNTED':
            const { [action.payload.formName]: removed, ...remainingStates } = state.formStates;
            return {
                ...state,
                formStates: remainingStates
            };

        case 'SET_FORM_LOADING':
            return {
                ...state,
                formStates: {
                    ...state.formStates,
                    [action.payload.formName]: {
                        ...state.formStates[action.payload.formName],
                        isLoading: action.payload.isLoading
                    }
                }
            };

        case 'SET_FORM_SUBMITTING':
            return {
                ...state,
                formStates: {
                    ...state.formStates,
                    [action.payload.formName]: {
                        ...state.formStates[action.payload.formName],
                        isSubmitting: action.payload.isSubmitting,
                        canNavigateAway: !action.payload.isSubmitting
                    }
                }
            };

        case 'SET_FORM_VALIDATION_ERRORS':
            return {
                ...state,
                formStates: {
                    ...state.formStates,
                    [action.payload.formName]: {
                        ...state.formStates[action.payload.formName],
                        validationErrors: action.payload.errors
                    }
                }
            };

        case 'SET_FORM_DIRTY':
            return {
                ...state,
                formStates: {
                    ...state.formStates,
                    [action.payload.formName]: {
                        ...state.formStates[action.payload.formName],
                        isDirty: action.payload.isDirty
                    }
                }
            };

        case 'SET_CAN_NAVIGATE_AWAY':
            return {
                ...state,
                formStates: {
                    ...state.formStates,
                    [action.payload.formName]: {
                        ...state.formStates[action.payload.formName],
                        canNavigateAway: action.payload.canNavigateAway
                    }
                }
            };

        case 'CLEAR_FORM_ERRORS':
            return {
                ...state,
                formStates: {
                    ...state.formStates,
                    [action.payload.formName]: {
                        ...state.formStates[action.payload.formName],
                        validationErrors: {}
                    }
                }
            };

        case 'GO_BACK':
            if (state.navigationHistory.length > 1) {
                const newHistory = state.navigationHistory.slice(0, -1);
                const previousEntry = newHistory[newHistory.length - 1];

                return {
                    ...state,
                    currentForm: previousEntry.formName,
                    navigationHistory: newHistory,
                    canGoBack: newHistory.length > 1,
                    canGoForward: true
                };
            }
            return state;

        case 'GO_FORWARD':
            // Forward navigation would require storing forward history
            // For now, just mark that we can't go forward
            return {
                ...state,
                canGoForward: false
            };

        case 'SET_NAVIGATING':
            return {
                ...state,
                isNavigating: action.payload.isNavigating
            };

        case 'SET_PENDING_NAVIGATION':
            return {
                ...state,
                pendingNavigation: action.payload
            };

        default:
            return state;
    }
}

// Context
interface AnvilNavigationContextType {
    state: AnvilNavigationState;

    // Form Navigation
    navigateToForm: (formName: string, params?: AnvilFormParams) => Promise<void>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;

    // Form Lifecycle
    mountForm: (formName: string, params?: AnvilFormParams) => void;
    unmountForm: (formName: string) => void;

    // Form State Management
    setFormLoading: (formName: string, isLoading: boolean) => void;
    setFormSubmitting: (formName: string, isSubmitting: boolean) => void;
    setFormValidationErrors: (formName: string, errors: Record<string, string>) => void;
    setFormDirty: (formName: string, isDirty: boolean) => void;
    setCanNavigateAway: (formName: string, canNavigateAway: boolean) => void;
    clearFormErrors: (formName: string) => void;

    // Utilities
    getCurrentFormState: () => AnvilFormState | null;
    getFormState: (formName: string) => AnvilFormState | null;
    canLeaveCurrentForm: () => boolean;

    // Anvil API Compatibility
    openForm: (formName: string, params?: AnvilFormParams) => Promise<void>;
    closeForm: () => Promise<void>;
}

const AnvilNavigationContext = createContext<AnvilNavigationContextType | undefined>(undefined);

// Provider Component
interface AnvilNavigationProviderProps {
    children: ReactNode;
    basePath?: string;
}

export function AnvilNavigationProvider({ children, basePath = '/app' }: AnvilNavigationProviderProps) {
    const [state, dispatch] = useReducer(navigationReducer, initialState);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Sync with Next.js router
    useEffect(() => {
        // Extract form name from current path
        const pathSegments = pathname.split('/').filter(Boolean);
        const formName = pathSegments[pathSegments.length - 1] || 'Main';

        // Extract parameters from search params
        const params: AnvilFormParams = {};
        searchParams.forEach((value, key) => {
            try {
                params[key] = JSON.parse(value);
            } catch {
                params[key] = value;
            }
        });

        // Update navigation state if different from current
        if (state.currentForm !== formName) {
            dispatch({
                type: 'NAVIGATE_TO_FORM',
                payload: {
                    formName,
                    params,
                    url: pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ''),
                    title: `${formName} - Anvil App`
                }
            });
        }
    }, [pathname, searchParams, state.currentForm]);

    // Form Navigation
    const navigateToForm = useCallback(async (formName: string, params: AnvilFormParams = {}) => {
        // Check if current form allows navigation
        const currentFormState = getCurrentFormState();
        if (currentFormState && !currentFormState.canNavigateAway) {
            const shouldProceed = window.confirm(
                'You have unsaved changes. Are you sure you want to leave this form?'
            );
            if (!shouldProceed) {
                return;
            }
        }

        dispatch({ type: 'SET_NAVIGATING', payload: { isNavigating: true } });

        try {
            // Build URL with parameters
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
            });

            const url = `${basePath}/${formName}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

            // Navigate using Next.js router
            await router.push(url);

            // Update navigation state will be handled by the useEffect above
        } catch (error) {
            console.error('Navigation failed:', error);
        } finally {
            dispatch({ type: 'SET_NAVIGATING', payload: { isNavigating: false } });
        }
    }, [router, basePath, state.currentForm, state.formStates]);

    const goBack = useCallback(async () => {
        if (state.canGoBack) {
            router.back();
        }
    }, [router, state.canGoBack]);

    const goForward = useCallback(async () => {
        if (state.canGoForward) {
            router.forward();
        }
    }, [router, state.canGoForward]);

    // Form Lifecycle
    const mountForm = useCallback((formName: string, params: AnvilFormParams = {}) => {
        dispatch({ type: 'FORM_MOUNTED', payload: { formName, params } });
    }, []);

    const unmountForm = useCallback((formName: string) => {
        dispatch({ type: 'FORM_UNMOUNTED', payload: { formName } });
    }, []);

    // Form State Management
    const setFormLoading = useCallback((formName: string, isLoading: boolean) => {
        dispatch({ type: 'SET_FORM_LOADING', payload: { formName, isLoading } });
    }, []);

    const setFormSubmitting = useCallback((formName: string, isSubmitting: boolean) => {
        dispatch({ type: 'SET_FORM_SUBMITTING', payload: { formName, isSubmitting } });
    }, []);

    const setFormValidationErrors = useCallback((formName: string, errors: Record<string, string>) => {
        dispatch({ type: 'SET_FORM_VALIDATION_ERRORS', payload: { formName, errors } });
    }, []);

    const setFormDirty = useCallback((formName: string, isDirty: boolean) => {
        dispatch({ type: 'SET_FORM_DIRTY', payload: { formName, isDirty } });
    }, []);

    const setCanNavigateAway = useCallback((formName: string, canNavigateAway: boolean) => {
        dispatch({ type: 'SET_CAN_NAVIGATE_AWAY', payload: { formName, canNavigateAway } });
    }, []);

    const clearFormErrors = useCallback((formName: string) => {
        dispatch({ type: 'CLEAR_FORM_ERRORS', payload: { formName } });
    }, []);

    // Utilities
    const getCurrentFormState = useCallback((): AnvilFormState | null => {
        return state.currentForm ? state.formStates[state.currentForm] || null : null;
    }, [state.currentForm, state.formStates]);

    const getFormState = useCallback((formName: string): AnvilFormState | null => {
        return state.formStates[formName] || null;
    }, [state.formStates]);

    const canLeaveCurrentForm = useCallback((): boolean => {
        const currentFormState = getCurrentFormState();
        return currentFormState ? currentFormState.canNavigateAway : true;
    }, [getCurrentFormState]);

    // Anvil API Compatibility
    const openForm = useCallback(async (formName: string, params: AnvilFormParams = {}) => {
        await navigateToForm(formName, params);
    }, [navigateToForm]);

    const closeForm = useCallback(async () => {
        await goBack();
    }, [goBack]);

    const contextValue: AnvilNavigationContextType = {
        state,
        navigateToForm,
        goBack,
        goForward,
        mountForm,
        unmountForm,
        setFormLoading,
        setFormSubmitting,
        setFormValidationErrors,
        setFormDirty,
        setCanNavigateAway,
        clearFormErrors,
        getCurrentFormState,
        getFormState,
        canLeaveCurrentForm,
        openForm,
        closeForm
    };

    return (
        <AnvilNavigationContext.Provider value={contextValue}>
            {children}
        </AnvilNavigationContext.Provider>
    );
}

// Hook to use navigation context
export function useAnvilNavigation() {
    const context = useContext(AnvilNavigationContext);
    if (context === undefined) {
        throw new Error('useAnvilNavigation must be used within an AnvilNavigationProvider');
    }
    return context;
}

// Hook for form lifecycle management
export function useAnvilForm(formName: string, params: AnvilFormParams = {}) {
    const navigation = useAnvilNavigation();

    useEffect(() => {
        // Mount form when component mounts
        navigation.mountForm(formName, params);

        // Cleanup on unmount
        return () => {
            navigation.unmountForm(formName);
        };
    }, [formName, navigation]);

    const formState = navigation.getFormState(formName);

    return {
        formState,
        setLoading: (isLoading: boolean) => navigation.setFormLoading(formName, isLoading),
        setSubmitting: (isSubmitting: boolean) => navigation.setFormSubmitting(formName, isSubmitting),
        setValidationErrors: (errors: Record<string, string>) => navigation.setFormValidationErrors(formName, errors),
        setDirty: (isDirty: boolean) => navigation.setFormDirty(formName, isDirty),
        setCanNavigateAway: (canNavigateAway: boolean) => navigation.setCanNavigateAway(formName, canNavigateAway),
        clearErrors: () => navigation.clearFormErrors(formName),
        navigateToForm: navigation.navigateToForm,
        openForm: navigation.openForm,
        closeForm: navigation.closeForm
    };
} 