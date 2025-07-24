/**
 * Anvil Navigation System - Main Export File
 * 
 * Complete form navigation, lifecycle management, and validation system
 * for the Anvil-NextJS Bridge
 */

// Navigation Context and Hooks
export {
    AnvilNavigationProvider,
    useAnvilNavigation,
    useAnvilForm,
    type AnvilFormParams,
    type AnvilFormState,
    type NavigationHistoryEntry,
    type AnvilNavigationState
} from './anvil-navigation-context';

// Import types for use in interfaces below
import type { AnvilFormParams, AnvilFormState, AnvilNavigationState } from './anvil-navigation-context';

// Form Validation System
export {
    FormValidationManager,
    FormValidators,
    ValidationPresets,
    type ValidationRule,
    type FieldValidationConfig,
    type ValidationError,
    type FormValidationConfig,
    type FormSubmissionData,
    type FormSubmissionResult
} from './form-validation';

// Utility functions and helpers
export const NavigationUtils = {
    /**
     * Create a URL-safe parameter string from form parameters
     */
    serializeParams: (params: Record<string, any>): string => {
        const searchParams = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            searchParams.set(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
        return searchParams.toString();
    },

    /**
     * Parse URL parameters back to form parameters
     */
    deserializeParams: (searchParams: string | URLSearchParams): Record<string, any> => {
        const params: Record<string, any> = {};
        const urlParams = typeof searchParams === 'string'
            ? new URLSearchParams(searchParams)
            : searchParams;

        urlParams.forEach((value, key) => {
            try {
                params[key] = JSON.parse(value);
            } catch {
                params[key] = value;
            }
        });

        return params;
    },

    /**
     * Generate a unique form ID
     */
    generateFormId: (formName: string): string => {
        return `${formName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Check if a form name is valid
     */
    isValidFormName: (formName: string): boolean => {
        return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(formName);
    },

    /**
     * Create a form route path
     */
    createFormRoute: (basePath: string, formName: string, params?: Record<string, any>): string => {
        const paramString = params ? NavigationUtils.serializeParams(params) : '';
        return `${basePath}/${formName}${paramString ? `?${paramString}` : ''}`;
    }
};

// Pre-configured setups for common use cases
export const NavigationPresets = {
    /**
     * Basic navigation setup - minimal configuration
     */
    basic: {
        basePath: '/app',
        enableHistory: true,
        enableValidation: false
    },

    /**
     * Full-featured setup with validation and advanced navigation
     */
    advanced: {
        basePath: '/app',
        enableHistory: true,
        enableValidation: true,
        enablePersistence: true,
        enableUndoRedo: true
    },

    /**
     * Multi-step form wizard setup
     */
    wizard: {
        basePath: '/wizard',
        enableHistory: true,
        enableValidation: true,
        preventBackNavigation: false,
        showProgress: true
    },

    /**
     * Single-page application mode
     */
    spa: {
        basePath: '/',
        enableHistory: false,
        enableValidation: true,
        clientSideRouting: true
    }
};

/**
 * Navigation middleware for advanced routing scenarios
 */
export interface NavigationMiddleware {
    beforeNavigate?: (from: string, to: string, params: Record<string, any>) => Promise<boolean>;
    afterNavigate?: (from: string, to: string, params: Record<string, any>) => Promise<void>;
    onNavigationError?: (error: Error, context: { from: string; to: string; params: Record<string, any> }) => Promise<void>;
}

/**
 * Route guard for protecting certain forms
 */
export interface RouteGuard {
    formName: string;
    guard: (params: Record<string, any>) => Promise<boolean>;
    redirectTo?: string;
    errorMessage?: string;
}

// Export type aliases for convenience based on hook return types
export interface FormNavigationHook {
    formState: AnvilFormState | null;
    setLoading: (isLoading: boolean) => void;
    setSubmitting: (isSubmitting: boolean) => void;
    setValidationErrors: (errors: Record<string, string>) => void;
    setDirty: (isDirty: boolean) => void;
    setCanNavigateAway: (canNavigateAway: boolean) => void;
    clearErrors: () => void;
    navigateToForm: (formName: string, params?: AnvilFormParams) => Promise<void>;
    openForm: (formName: string, params?: AnvilFormParams) => Promise<void>;
    closeForm: () => Promise<void>;
}

export interface NavigationContextHook {
    state: AnvilNavigationState;
    navigateToForm: (formName: string, params?: AnvilFormParams) => Promise<void>;
    goBack: () => Promise<void>;
    goForward: () => Promise<void>;
    mountForm: (formName: string, params?: AnvilFormParams) => void;
    unmountForm: (formName: string) => void;
    setFormLoading: (formName: string, isLoading: boolean) => void;
    setFormSubmitting: (formName: string, isSubmitting: boolean) => void;
    setFormValidationErrors: (formName: string, errors: Record<string, string>) => void;
    setFormDirty: (formName: string, isDirty: boolean) => void;
    setCanNavigateAway: (formName: string, canNavigateAway: boolean) => void;
    clearFormErrors: (formName: string) => void;
    getCurrentFormState: () => AnvilFormState | null;
    getFormState: (formName: string) => AnvilFormState | null;
    canLeaveCurrentForm: () => boolean;
    openForm: (formName: string, params?: AnvilFormParams) => Promise<void>;
    closeForm: () => Promise<void>;
}

// Version information
export const ANVIL_NAVIGATION_VERSION = '1.0.0'; 