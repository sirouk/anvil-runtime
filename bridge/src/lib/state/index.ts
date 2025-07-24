/**
 * Anvil State Management System
 * 
 * Complete state management solution for Anvil components including:
 * - Centralized component state management
 * - Two-way data binding with server
 * - Computed properties with dependency tracking
 * - State persistence across page reloads
 * - Undo/redo functionality
 * - Data transformation and validation
 */

// Core state management
export {
    AnvilStateProvider,
    useAnvilStateContext,
    type AnvilStateContextValue,
    type AnvilStateValue,
    type AnvilComponentState,
    type AnvilFormState,
    type AnvilAppState,
    type AnvilStateHistory,
    type AnvilStateAction,
    type AnvilStateChangeEvent,
    type AnvilDataBinding,
    type AnvilComputedProperty
} from './anvil-state-context';

// Import types for use in utility functions
import type {
    AnvilComponentState,
    AnvilFormState,
    AnvilAppState
} from './anvil-state-context';
import type { ConflictResolution } from './data-binding-utils';
import { PersistencePresets } from './state-persistence';

// State management hooks
export {
    useAnvilState,
    useAnvilProperty,
    useAnvilForm,
    useAnvilBinding,
    type UseAnvilStateOptions,
    type AnvilStateHookResult
} from './use-anvil-state';

// Data binding system
export {
    DataBindingManager,
    dataBindingManager,
    CommonTransformers,
    CommonValidators,
    type EnhancedDataBinding,
    type BindingDirection,
    type BindingTransformer,
    type BindingValidator,
    type ConflictResolution,
    type BindingSyncStatus,
    type BindingSyncEvent
} from './data-binding-utils';

// Computed properties system
export {
    ComputedPropertiesManager,
    ComputedPropertyFactories,
    type EnhancedComputedProperty,
    type DependencySpec,
    type ComputedFunction,
    type ComputedPropertyEvent
} from './computed-properties';

// State persistence system
export {
    StatePersistenceManager,
    PersistencePresets,
    type PersistenceConfig,
    type StorageStrategy,
    type PersistedStateMetadata,
    type PersistenceResult
} from './state-persistence';

// Utility functions and helpers
export const StateManagementUtils = {
    /**
     * Create a unique component ID
     */
    createComponentId: (formName: string, componentType: string, index?: number): string => {
        const suffix = index !== undefined ? `_${index}` : '';
        return `${formName}_${componentType}_${Date.now()}${suffix}`;
    },

    /**
     * Deep clone state object
     */
    cloneState: <T>(state: T): T => {
        return JSON.parse(JSON.stringify(state));
    },

    /**
     * Check if two values are equal (including deep object comparison)
     */
    isEqual: (a: any, b: any): boolean => {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;

        if (typeof a === 'object') {
            const keysA = Object.keys(a);
            const keysB = Object.keys(b);

            if (keysA.length !== keysB.length) return false;

            return keysA.every(key => StateManagementUtils.isEqual(a[key], b[key]));
        }

        return false;
    },

    /**
     * Get nested property value
     */
    getNestedValue: (obj: any, path: string): any => {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    },

    /**
     * Set nested property value
     */
    setNestedValue: (obj: any, path: string, value: any): void => {
        const keys = path.split('.');
        const lastKey = keys.pop()!;

        const target = keys.reduce((current, key) => {
            if (current[key] === undefined) {
                current[key] = {};
            }
            return current[key];
        }, obj);

        target[lastKey] = value;
    },

    /**
     * Debounce function calls
     */
    debounce: <T extends (...args: any[]) => any>(
        func: T,
        delay: number
    ): ((...args: Parameters<T>) => void) => {
        let timeoutId: NodeJS.Timeout;

        return (...args: Parameters<T>) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func(...args), delay);
        };
    },

    /**
     * Throttle function calls
     */
    throttle: <T extends (...args: any[]) => any>(
        func: T,
        delay: number
    ): ((...args: Parameters<T>) => void) => {
        let isThrottled = false;

        return (...args: Parameters<T>) => {
            if (!isThrottled) {
                func(...args);
                isThrottled = true;
                setTimeout(() => { isThrottled = false; }, delay);
            }
        };
    },

    /**
     * Validate component state structure
     */
    validateComponentState: (state: any): state is AnvilComponentState => {
        return (
            typeof state === 'object' &&
            state !== null &&
            typeof state.id === 'string' &&
            typeof state.type === 'string' &&
            typeof state.properties === 'object'
        );
    },

    /**
     * Validate form state structure
     */
    validateFormState: (state: any): state is AnvilFormState => {
        return (
            typeof state === 'object' &&
            state !== null &&
            typeof state.formName === 'string' &&
            typeof state.components === 'object'
        );
    },

    /**
     * Create default component state
     */
    createDefaultComponentState: (
        id: string,
        type: string,
        properties: Record<string, any> = {}
    ): AnvilComponentState => {
        return {
            id,
            type,
            properties,
            isDirty: false,
            lastModified: Date.now()
        };
    },

    /**
     * Create default form state
     */
    createDefaultFormState: (formName: string): AnvilFormState => {
        return {
            formName,
            components: {},
            isLoading: false,
            errors: {}
        };
    },

    /**
     * Merge component states (useful for updates)
     */
    mergeComponentStates: (
        existing: AnvilComponentState,
        updates: Partial<AnvilComponentState>
    ): AnvilComponentState => {
        return {
            ...existing,
            ...updates,
            properties: {
                ...existing.properties,
                ...updates.properties
            },
            lastModified: Date.now()
        };
    },

    /**
     * Extract component IDs from form state
     */
    getComponentIds: (formState: AnvilFormState): string[] => {
        return Object.keys(formState.components);
    },

    /**
     * Count total components across all forms
     */
    getTotalComponentCount: (appState: AnvilAppState): number => {
        return Object.values(appState.forms).reduce(
            (total, form) => total + Object.keys(form.components).length,
            0
        );
    },

    /**
     * Get all dirty components across all forms
     */
    getDirtyComponents: (appState: AnvilAppState): AnvilComponentState[] => {
        const dirtyComponents: AnvilComponentState[] = [];

        Object.values(appState.forms).forEach(form => {
            Object.values(form.components).forEach(component => {
                if (component.isDirty) {
                    dirtyComponents.push(component);
                }
            });
        });

        return dirtyComponents;
    }
};

// Pre-configured state management setups
export const StateManagementPresets = {
    /**
     * Basic setup for simple forms
     */
    basic: {
        persistence: PersistencePresets.minimal('anvil-app-basic'),
        dataBinding: {
            debounceMs: 300,
            conflictResolution: 'timestamp' as ConflictResolution
        },
        computedProperties: {
            cache: true,
            cacheTimeout: 5000
        }
    },

    /**
     * Advanced setup for complex applications
     */
    advanced: {
        persistence: PersistencePresets.everything('anvil-app-advanced'),
        dataBinding: {
            debounceMs: 100,
            conflictResolution: 'merge' as ConflictResolution
        },
        computedProperties: {
            cache: true,
            cacheTimeout: 10000,
            debounceMs: 50
        }
    },

    /**
     * Secure setup with encryption
     */
    secure: (encryptionKey: string) => ({
        persistence: PersistencePresets.userDataSecure('anvil-app-secure', encryptionKey),
        dataBinding: {
            debounceMs: 200,
            conflictResolution: 'prompt-user' as ConflictResolution
        },
        computedProperties: {
            cache: true,
            cacheTimeout: 3000
        }
    }),

    /**
     * Development setup with extensive debugging
     */
    development: {
        persistence: PersistencePresets.sessionOnly('anvil-app-dev'),
        dataBinding: {
            debounceMs: 0, // Immediate updates for debugging
            conflictResolution: 'client-wins' as ConflictResolution
        },
        computedProperties: {
            cache: false, // Always recompute for debugging
            debounceMs: 0
        }
    }
};

// Export default configuration
export const defaultStateConfig = StateManagementPresets.basic; 