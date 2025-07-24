import { useCallback, useEffect, useRef, useMemo } from 'react';
import { useAnvilStateContext, AnvilStateValue, AnvilComponentState, AnvilDataBinding, AnvilComputedProperty } from './anvil-state-context';

/**
 * useAnvilState Hook
 * 
 * Primary hook for components to interact with Anvil state management.
 * Provides reactive property binding, data persistence, and automatic updates.
 */

export interface UseAnvilStateOptions {
    // Component identification
    componentId: string;
    componentType: string;
    formName?: string;

    // Property binding options
    defaultProperties?: Record<string, AnvilStateValue>;
    computedProperties?: Record<string, (dependencies: Record<string, AnvilStateValue>) => AnvilStateValue>;
    dataBindings?: Record<string, {
        serverPath: string;
        direction?: 'one-way' | 'two-way';
        transform?: (value: any) => any;
        validate?: (value: any) => string | null;
    }>;

    // Event handlers
    onChange?: (property: string, value: AnvilStateValue, oldValue: AnvilStateValue) => void;
    onValidation?: (errors: Record<string, string>) => void;

    // Persistence options
    persist?: boolean;
    autoSave?: boolean;
    autoSaveDelay?: number;
}

export interface AnvilStateHookResult {
    // Property access
    properties: Record<string, AnvilStateValue>;
    getProperty: <T = AnvilStateValue>(property: string) => T;
    setProperty: (property: string, value: AnvilStateValue) => void;
    setProperties: (properties: Record<string, AnvilStateValue>) => void;

    // Component state
    isDirty: boolean;
    isLoading: boolean;
    errors: Record<string, string>;
    lastModified?: number;

    // Computed properties
    addComputed: (property: string, dependencies: string[], compute: (deps: Record<string, AnvilStateValue>) => AnvilStateValue) => void;
    removeComputed: (property: string) => void;

    // Data binding
    bindToServer: (property: string, serverPath: string, options?: {
        direction?: 'one-way' | 'two-way';
        transform?: (value: any) => any;
        validate?: (value: any) => string | null;
    }) => void;
    unbindFromServer: (property: string) => void;

    // Form interactions
    validate: () => Record<string, string>;
    save: () => Promise<void>;
    reset: () => void;

    // Server sync
    syncWithServer: () => Promise<void>;
    serverData: Record<string, any>;
}

/**
 * Main useAnvilState hook
 */
export function useAnvilState(options: UseAnvilStateOptions): AnvilStateHookResult {
    const {
        componentId,
        componentType,
        formName,
        defaultProperties = {},
        computedProperties = {},
        dataBindings = {},
        onChange,
        onValidation,
        persist = true,
        autoSave = false,
        autoSaveDelay = 1000
    } = options;

    const stateContext = useAnvilStateContext();
    const autoSaveTimeoutRef = useRef<NodeJS.Timeout>();
    const isInitializedRef = useRef(false);

    // Get current form name
    const currentFormName = formName || stateContext.getCurrentForm()?.formName || 'default';

    // Initialize component in state if not exists
    useEffect(() => {
        if (!isInitializedRef.current) {
            const existingComponent = stateContext.getComponentState(componentId);

            if (!existingComponent) {
                const newComponent: AnvilComponentState = {
                    id: componentId,
                    type: componentType,
                    properties: { ...defaultProperties },
                    isDirty: false,
                    lastModified: Date.now()
                };

                stateContext.addComponent(currentFormName, newComponent);
            }

            isInitializedRef.current = true;
        }
    }, [componentId, componentType, currentFormName, defaultProperties, stateContext]);

    // Set up computed properties
    useEffect(() => {
        Object.entries(computedProperties).forEach(([property, computeFn]) => {
            // Extract dependencies from function (this is a simplified approach)
            // In a real implementation, you might want a more sophisticated dependency tracking
            const dependencies: string[] = [];

            const computedProperty: AnvilComputedProperty = {
                componentId,
                property,
                dependencies,
                compute: computeFn
            };

            stateContext.addComputedProperty(computedProperty);
        });

        return () => {
            Object.keys(computedProperties).forEach(property => {
                stateContext.removeComputedProperty(componentId, property);
            });
        };
    }, [componentId, computedProperties, stateContext]);

    // Set up data bindings
    useEffect(() => {
        Object.entries(dataBindings).forEach(([property, binding]) => {
            const dataBinding: AnvilDataBinding = {
                componentId,
                property,
                serverPath: binding.serverPath,
                direction: binding.direction || 'two-way',
                transform: binding.transform,
                validate: binding.validate
            };

            stateContext.addDataBinding(dataBinding);
        });

        return () => {
            Object.keys(dataBindings).forEach(property => {
                stateContext.removeDataBinding(componentId, property);
            });
        };
    }, [componentId, dataBindings, stateContext]);

    // Get current component state
    const componentState = stateContext.getComponentState(componentId);

    // Property accessors
    const getProperty = useCallback(<T = AnvilStateValue>(property: string): T => {
        const component = stateContext.getComponentState(componentId);
        return (component?.properties[property] as T) ?? (defaultProperties[property] as T);
    }, [componentId, defaultProperties, stateContext]);

    const setProperty = useCallback((property: string, value: AnvilStateValue) => {
        const oldValue = getProperty(property);

        stateContext.setComponentProperty(componentId, property, value);

        // Call onChange handler
        if (onChange) {
            onChange(property, value, oldValue);
        }

        // Handle auto-save
        if (autoSave) {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }

            autoSaveTimeoutRef.current = setTimeout(async () => {
                try {
                    await stateContext.syncWithServer(currentFormName);
                    if (persist) {
                        stateContext.persistState();
                    }
                } catch (error) {
                    console.error('Auto-save failed:', error);
                }
            }, autoSaveDelay);
        }
    }, [componentId, getProperty, stateContext, onChange, autoSave, autoSaveDelay, currentFormName, persist]);

    const setProperties = useCallback((properties: Record<string, AnvilStateValue>) => {
        stateContext.setComponentProperties(componentId, properties);

        // Call onChange handler for each property
        if (onChange) {
            Object.entries(properties).forEach(([property, value]) => {
                const oldValue = getProperty(property);
                onChange(property, value, oldValue);
            });
        }

        // Handle auto-save
        if (autoSave) {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }

            autoSaveTimeoutRef.current = setTimeout(async () => {
                try {
                    await stateContext.syncWithServer(currentFormName);
                    if (persist) {
                        stateContext.persistState();
                    }
                } catch (error) {
                    console.error('Auto-save failed:', error);
                }
            }, autoSaveDelay);
        }
    }, [componentId, stateContext, onChange, getProperty, autoSave, autoSaveDelay, currentFormName, persist]);

    // Computed property management
    const addComputed = useCallback((
        property: string,
        dependencies: string[],
        compute: (deps: Record<string, AnvilStateValue>) => AnvilStateValue
    ) => {
        const computedProperty: AnvilComputedProperty = {
            componentId,
            property,
            dependencies,
            compute
        };

        stateContext.addComputedProperty(computedProperty);
    }, [componentId, stateContext]);

    const removeComputed = useCallback((property: string) => {
        stateContext.removeComputedProperty(componentId, property);
    }, [componentId, stateContext]);

    // Data binding management
    const bindToServer = useCallback((
        property: string,
        serverPath: string,
        options: {
            direction?: 'one-way' | 'two-way';
            transform?: (value: any) => any;
            validate?: (value: any) => string | null;
        } = {}
    ) => {
        const binding: AnvilDataBinding = {
            componentId,
            property,
            serverPath,
            direction: options.direction || 'two-way',
            transform: options.transform,
            validate: options.validate
        };

        stateContext.addDataBinding(binding);
    }, [componentId, stateContext]);

    const unbindFromServer = useCallback((property: string) => {
        stateContext.removeDataBinding(componentId, property);
    }, [componentId, stateContext]);

    // Form interactions
    const validate = useCallback((): Record<string, string> => {
        const allErrors = stateContext.validateForm(currentFormName);
        const componentErrors: Record<string, string> = {};

        // Filter errors for this component
        Object.entries(allErrors).forEach(([key, error]) => {
            if (key.startsWith(`${componentId}.`)) {
                const property = key.substring(componentId.length + 1);
                componentErrors[property] = error;
            }
        });

        if (onValidation) {
            onValidation(componentErrors);
        }

        return componentErrors;
    }, [componentId, currentFormName, stateContext, onValidation]);

    const save = useCallback(async (): Promise<void> => {
        try {
            // Validate first
            const errors = validate();
            if (Object.keys(errors).length > 0) {
                throw new Error('Validation failed');
            }

            // Sync with server
            await stateContext.syncWithServer(currentFormName);

            // Persist to localStorage if enabled
            if (persist) {
                stateContext.persistState();
            }
        } catch (error) {
            console.error('Failed to save component state:', error);
            throw error;
        }
    }, [validate, stateContext, currentFormName, persist]);

    const reset = useCallback(() => {
        // Reset to default properties
        stateContext.setComponentProperties(componentId, defaultProperties);
    }, [componentId, defaultProperties, stateContext]);

    const syncWithServer = useCallback(async (): Promise<void> => {
        await stateContext.syncWithServer(currentFormName);
    }, [stateContext, currentFormName]);

    // Memoized return value
    const result = useMemo((): AnvilStateHookResult => {
        const form = stateContext.state.present.forms[currentFormName];

        return {
            properties: componentState?.properties || defaultProperties,
            getProperty,
            setProperty,
            setProperties,
            isDirty: componentState?.isDirty || false,
            isLoading: form?.isLoading || false,
            errors: form?.errors || {},
            lastModified: componentState?.lastModified,
            addComputed,
            removeComputed,
            bindToServer,
            unbindFromServer,
            validate,
            save,
            reset,
            syncWithServer,
            serverData: form?.serverData || {}
        };
    }, [
        componentState,
        defaultProperties,
        currentFormName,
        stateContext.state.present.forms,
        getProperty,
        setProperty,
        setProperties,
        addComputed,
        removeComputed,
        bindToServer,
        unbindFromServer,
        validate,
        save,
        reset,
        syncWithServer
    ]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimeoutRef.current) {
                clearTimeout(autoSaveTimeoutRef.current);
            }
        };
    }, []);

    return result;
}

/**
 * Simplified hook for basic property binding
 */
export function useAnvilProperty<T extends AnvilStateValue = AnvilStateValue>(
    componentId: string,
    property: string,
    defaultValue?: T
): [T, (value: T) => void] {
    const { getProperty, setProperty } = useAnvilState({
        componentId,
        componentType: 'unknown',
        defaultProperties: defaultValue !== undefined ? { [property]: defaultValue } : {}
    });

    const value = getProperty<T>(property);
    const setValue = useCallback((newValue: T) => {
        setProperty(property, newValue as AnvilStateValue);
    }, [setProperty, property]);

    return [value, setValue];
}

/**
 * Hook for form-level state management
 */
export function useAnvilForm(formName?: string) {
    const stateContext = useAnvilStateContext();
    const currentFormName = formName || stateContext.getCurrentForm()?.formName || 'default';

    const navigateToForm = useCallback((targetForm: string) => {
        stateContext.navigateToForm(targetForm);
    }, [stateContext]);

    const validateForm = useCallback(() => {
        return stateContext.validateForm(currentFormName);
    }, [stateContext, currentFormName]);

    const hasUnsavedChanges = useCallback(() => {
        return stateContext.hasUnsavedChanges(currentFormName);
    }, [stateContext, currentFormName]);

    const saveForm = useCallback(async () => {
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            throw new Error('Form validation failed');
        }

        await stateContext.syncWithServer(currentFormName);
        stateContext.persistState();
    }, [validateForm, stateContext, currentFormName]);

    const resetForm = useCallback(() => {
        // Reset all components in the form to their default values
        const form = stateContext.state.present.forms[currentFormName];
        if (form) {
            Object.values(form.components).forEach(component => {
                // This would need access to default properties - simplified for now
                stateContext.setComponentProperties(component.id, {});
            });
        }
    }, [stateContext, currentFormName]);

    const form = stateContext.state.present.forms[currentFormName];

    return {
        formName: currentFormName,
        isLoading: form?.isLoading || false,
        errors: form?.errors || {},
        serverData: form?.serverData || {},
        navigateToForm,
        validateForm,
        hasUnsavedChanges,
        saveForm,
        resetForm,
        // Undo/redo
        undo: stateContext.undo,
        redo: stateContext.redo,
        canUndo: stateContext.canUndo,
        canRedo: stateContext.canRedo
    };
}

/**
 * Hook for component-level data binding
 */
export function useAnvilBinding(
    componentId: string,
    property: string,
    serverPath: string,
    options: {
        direction?: 'one-way' | 'two-way';
        transform?: (value: any) => any;
        validate?: (value: any) => string | null;
    } = {}
) {
    const { bindToServer, unbindFromServer, getProperty, setProperty } = useAnvilState({
        componentId,
        componentType: 'unknown'
    });

    useEffect(() => {
        bindToServer(property, serverPath, options);

        return () => {
            unbindFromServer(property);
        };
    }, [bindToServer, unbindFromServer, property, serverPath, options]);

    const value = getProperty(property);
    const setValue = useCallback((newValue: AnvilStateValue) => {
        setProperty(property, newValue);
    }, [setProperty, property]);

    return [value, setValue] as const;
} 