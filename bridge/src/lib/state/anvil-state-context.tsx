import React, { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';

/**
 * Anvil State Management System
 * 
 * Provides centralized state management for Anvil components including:
 * - Component property binding
 * - Two-way data binding with server
 * - Computed properties and dependencies
 * - State persistence
 * - Undo/redo functionality
 */

// State value types
export type AnvilStateValue = string | number | boolean | null | undefined | object | any[];

// Component state entry
export interface AnvilComponentState {
    id: string;
    type: string;
    properties: Record<string, AnvilStateValue>;
    computedProperties?: Record<string, () => AnvilStateValue>;
    bindings?: Record<string, string>; // property -> server binding path
    isDirty?: boolean;
    lastModified?: number;
}

// Form state containing all components
export interface AnvilFormState {
    formName: string;
    components: Record<string, AnvilComponentState>;
    serverData?: Record<string, any>;
    isLoading?: boolean;
    errors?: Record<string, string>;
    lastSaved?: number;
}

// Application state containing all forms
export interface AnvilAppState {
    currentForm?: string;
    forms: Record<string, AnvilFormState>;
    globalData?: Record<string, any>;
    user?: any;
    session?: {
        id: string;
        token?: string;
    };
}

// State history for undo/redo
export interface AnvilStateHistory {
    past: AnvilAppState[];
    present: AnvilAppState;
    future: AnvilAppState[];
    maxHistory: number;
}

// Action types for state updates
export type AnvilStateAction =
    | { type: 'SET_COMPONENT_PROPERTY'; componentId: string; property: string; value: AnvilStateValue }
    | { type: 'SET_COMPONENT_PROPERTIES'; componentId: string; properties: Record<string, AnvilStateValue> }
    | { type: 'ADD_COMPONENT'; formName: string; component: AnvilComponentState }
    | { type: 'REMOVE_COMPONENT'; componentId: string }
    | { type: 'SET_FORM_DATA'; formName: string; data: Record<string, any> }
    | { type: 'SET_SERVER_DATA'; formName: string; data: Record<string, any> }
    | { type: 'SET_LOADING'; formName: string; loading: boolean }
    | { type: 'SET_ERRORS'; formName: string; errors: Record<string, string> }
    | { type: 'NAVIGATE_TO_FORM'; formName: string }
    | { type: 'PERSIST_STATE' }
    | { type: 'RESTORE_STATE'; state: AnvilAppState }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'CLEAR_HISTORY' };

// State change event for external listeners
export interface AnvilStateChangeEvent {
    type: 'property_change' | 'form_change' | 'server_sync' | 'navigation';
    componentId?: string;
    property?: string;
    oldValue?: AnvilStateValue;
    newValue?: AnvilStateValue;
    formName?: string;
    timestamp: number;
}

// Data binding configuration
export interface AnvilDataBinding {
    componentId: string;
    property: string;
    serverPath: string;
    direction: 'one-way' | 'two-way';
    transform?: (value: any) => any;
    validate?: (value: any) => string | null;
}

// Computed property definition
export interface AnvilComputedProperty {
    componentId: string;
    property: string;
    dependencies: string[]; // Array of "componentId.property" strings
    compute: (dependencies: Record<string, AnvilStateValue>) => AnvilStateValue;
}

// Context value interface
export interface AnvilStateContextValue {
    // Current state
    state: AnvilStateHistory;

    // Component state management
    getComponentState: (componentId: string) => AnvilComponentState | undefined;
    setComponentProperty: (componentId: string, property: string, value: AnvilStateValue) => void;
    setComponentProperties: (componentId: string, properties: Record<string, AnvilStateValue>) => void;
    addComponent: (formName: string, component: AnvilComponentState) => void;
    removeComponent: (componentId: string) => void;

    // Form state management
    getCurrentForm: () => AnvilFormState | undefined;
    navigateToForm: (formName: string) => void;
    setFormData: (formName: string, data: Record<string, any>) => void;
    getFormData: (formName: string) => Record<string, any>;

    // Server synchronization
    syncWithServer: (formName?: string) => Promise<void>;
    setServerData: (formName: string, data: Record<string, any>) => void;

    // Data binding
    addDataBinding: (binding: AnvilDataBinding) => void;
    removeDataBinding: (componentId: string, property: string) => void;
    getDataBindings: () => AnvilDataBinding[];

    // Computed properties
    addComputedProperty: (computed: AnvilComputedProperty) => void;
    removeComputedProperty: (componentId: string, property: string) => void;

    // State persistence
    persistState: () => void;
    restoreState: () => void;

    // Undo/redo
    undo: () => void;
    redo: () => void;
    canUndo: () => boolean;
    canRedo: () => boolean;
    clearHistory: () => void;

    // Event listeners
    addEventListener: (listener: (event: AnvilStateChangeEvent) => void) => () => void;
    removeEventListener: (listener: (event: AnvilStateChangeEvent) => void) => void;

    // Validation
    validateForm: (formName?: string) => Record<string, string>;
    hasUnsavedChanges: (formName?: string) => boolean;
}

// Default state
const defaultState: AnvilStateHistory = {
    past: [],
    present: {
        forms: {},
        globalData: {}
    },
    future: [],
    maxHistory: 50
};

// State reducer
function anvilStateReducer(state: AnvilStateHistory, action: AnvilStateAction): AnvilStateHistory {
    const { past, present, future, maxHistory } = state;

    let newPresent = { ...present };
    let shouldAddToHistory = true;

    switch (action.type) {
        case 'SET_COMPONENT_PROPERTY': {
            const { componentId, property, value } = action;
            const component = findComponent(present, componentId);

            if (component) {
                const formName = findComponentForm(present, componentId);
                if (formName) {
                    newPresent = {
                        ...present,
                        forms: {
                            ...present.forms,
                            [formName]: {
                                ...present.forms[formName],
                                components: {
                                    ...present.forms[formName].components,
                                    [componentId]: {
                                        ...component,
                                        properties: {
                                            ...component.properties,
                                            [property]: value
                                        },
                                        isDirty: true,
                                        lastModified: Date.now()
                                    }
                                }
                            }
                        }
                    };
                }
            }
            break;
        }

        case 'SET_COMPONENT_PROPERTIES': {
            const { componentId, properties } = action;
            const component = findComponent(present, componentId);

            if (component) {
                const formName = findComponentForm(present, componentId);
                if (formName) {
                    newPresent = {
                        ...present,
                        forms: {
                            ...present.forms,
                            [formName]: {
                                ...present.forms[formName],
                                components: {
                                    ...present.forms[formName].components,
                                    [componentId]: {
                                        ...component,
                                        properties: {
                                            ...component.properties,
                                            ...properties
                                        },
                                        isDirty: true,
                                        lastModified: Date.now()
                                    }
                                }
                            }
                        }
                    };
                }
            }
            break;
        }

        case 'ADD_COMPONENT': {
            const { formName, component } = action;

            if (!present.forms[formName]) {
                newPresent.forms[formName] = {
                    formName,
                    components: {}
                };
            }

            newPresent = {
                ...present,
                forms: {
                    ...present.forms,
                    [formName]: {
                        ...present.forms[formName],
                        components: {
                            ...present.forms[formName].components,
                            [component.id]: component
                        }
                    }
                }
            };
            break;
        }

        case 'REMOVE_COMPONENT': {
            const { componentId } = action;
            const formName = findComponentForm(present, componentId);

            if (formName) {
                const { [componentId]: removed, ...remainingComponents } = present.forms[formName].components;

                newPresent = {
                    ...present,
                    forms: {
                        ...present.forms,
                        [formName]: {
                            ...present.forms[formName],
                            components: remainingComponents
                        }
                    }
                };
            }
            break;
        }

        case 'SET_FORM_DATA': {
            const { formName, data } = action;

            if (!present.forms[formName]) {
                newPresent.forms[formName] = {
                    formName,
                    components: {}
                };
            }

            newPresent = {
                ...present,
                forms: {
                    ...present.forms,
                    [formName]: {
                        ...present.forms[formName],
                        serverData: data,
                        lastSaved: Date.now()
                    }
                }
            };
            break;
        }

        case 'SET_SERVER_DATA': {
            const { formName, data } = action;

            newPresent = {
                ...present,
                forms: {
                    ...present.forms,
                    [formName]: {
                        ...present.forms[formName],
                        serverData: { ...present.forms[formName]?.serverData, ...data }
                    }
                }
            };
            shouldAddToHistory = false; // Don't add server updates to history
            break;
        }

        case 'SET_LOADING': {
            const { formName, loading } = action;

            newPresent = {
                ...present,
                forms: {
                    ...present.forms,
                    [formName]: {
                        ...present.forms[formName],
                        isLoading: loading
                    }
                }
            };
            shouldAddToHistory = false; // Don't add loading states to history
            break;
        }

        case 'SET_ERRORS': {
            const { formName, errors } = action;

            newPresent = {
                ...present,
                forms: {
                    ...present.forms,
                    [formName]: {
                        ...present.forms[formName],
                        errors
                    }
                }
            };
            shouldAddToHistory = false; // Don't add error states to history
            break;
        }

        case 'NAVIGATE_TO_FORM': {
            const { formName } = action;

            newPresent = {
                ...present,
                currentForm: formName
            };
            break;
        }

        case 'PERSIST_STATE': {
            // Persist to localStorage
            localStorage.setItem('anvil-app-state', JSON.stringify(present));
            shouldAddToHistory = false;
            break;
        }

        case 'RESTORE_STATE': {
            const { state: restoredState } = action;
            newPresent = restoredState;
            break;
        }

        case 'UNDO': {
            if (past.length > 0) {
                return {
                    past: past.slice(0, past.length - 1),
                    present: past[past.length - 1],
                    future: [present, ...future],
                    maxHistory
                };
            }
            return state;
        }

        case 'REDO': {
            if (future.length > 0) {
                return {
                    past: [...past, present],
                    present: future[0],
                    future: future.slice(1),
                    maxHistory
                };
            }
            return state;
        }

        case 'CLEAR_HISTORY': {
            return {
                past: [],
                present,
                future: [],
                maxHistory
            };
        }

        default:
            return state;
    }

    if (shouldAddToHistory) {
        // Add current state to history
        const newPast = [...past, present];

        // Limit history size
        if (newPast.length > maxHistory) {
            newPast.splice(0, newPast.length - maxHistory);
        }

        return {
            past: newPast,
            present: newPresent,
            future: [], // Clear future when new change is made
            maxHistory
        };
    }

    return {
        ...state,
        present: newPresent
    };
}

// Helper functions
function findComponent(state: AnvilAppState, componentId: string): AnvilComponentState | undefined {
    for (const form of Object.values(state.forms)) {
        if (form.components[componentId]) {
            return form.components[componentId];
        }
    }
    return undefined;
}

function findComponentForm(state: AnvilAppState, componentId: string): string | undefined {
    for (const [formName, form] of Object.entries(state.forms)) {
        if (form.components[componentId]) {
            return formName;
        }
    }
    return undefined;
}

// Context creation
const AnvilStateContext = createContext<AnvilStateContextValue | undefined>(undefined);

// Provider component
export interface AnvilStateProviderProps {
    children: React.ReactNode;
    initialState?: AnvilAppState;
    persistenceKey?: string;
    serverSyncUrl?: string;
}

export const AnvilStateProvider: React.FC<AnvilStateProviderProps> = ({
    children,
    initialState,
    persistenceKey = 'anvil-app-state',
    serverSyncUrl
}) => {
    const [state, dispatch] = useReducer(anvilStateReducer, defaultState);
    const eventListenersRef = useRef<((event: AnvilStateChangeEvent) => void)[]>([]);
    const dataBindingsRef = useRef<AnvilDataBinding[]>([]);
    const computedPropertiesRef = useRef<AnvilComputedProperty[]>([]);

    // Initialize state from localStorage or initial state
    useEffect(() => {
        try {
            const savedState = localStorage.getItem(persistenceKey);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                dispatch({ type: 'RESTORE_STATE', state: parsed });
            } else if (initialState) {
                dispatch({ type: 'RESTORE_STATE', state: initialState });
            }
        } catch (error) {
            console.warn('Failed to restore Anvil state:', error);
        }
    }, [persistenceKey, initialState]);

    // Emit state change events
    const emitEvent = useCallback((event: AnvilStateChangeEvent) => {
        eventListenersRef.current.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in state change listener:', error);
            }
        });
    }, []);

    // Component state management
    const getComponentState = useCallback((componentId: string): AnvilComponentState | undefined => {
        return findComponent(state.present, componentId);
    }, [state.present]);

    const setComponentProperty = useCallback((componentId: string, property: string, value: AnvilStateValue) => {
        const oldComponent = getComponentState(componentId);
        const oldValue = oldComponent?.properties[property];

        dispatch({ type: 'SET_COMPONENT_PROPERTY', componentId, property, value });

        emitEvent({
            type: 'property_change',
            componentId,
            property,
            oldValue,
            newValue: value,
            timestamp: Date.now()
        });

        // Process computed properties that depend on this property
        processComputedProperties(componentId, property, value);

        // Process data bindings
        processDataBinding(componentId, property, value);
    }, [getComponentState, emitEvent]);

    const setComponentProperties = useCallback((componentId: string, properties: Record<string, AnvilStateValue>) => {
        dispatch({ type: 'SET_COMPONENT_PROPERTIES', componentId, properties });

        // Process all affected computed properties and bindings
        Object.entries(properties).forEach(([property, value]) => {
            processComputedProperties(componentId, property, value);
            processDataBinding(componentId, property, value);
        });
    }, []);

    const addComponent = useCallback((formName: string, component: AnvilComponentState) => {
        dispatch({ type: 'ADD_COMPONENT', formName, component });
    }, []);

    const removeComponent = useCallback((componentId: string) => {
        dispatch({ type: 'REMOVE_COMPONENT', componentId });
    }, []);

    // Form state management
    const getCurrentForm = useCallback((): AnvilFormState | undefined => {
        if (state.present.currentForm) {
            return state.present.forms[state.present.currentForm];
        }
        return undefined;
    }, [state.present.currentForm, state.present.forms]);

    const navigateToForm = useCallback((formName: string) => {
        dispatch({ type: 'NAVIGATE_TO_FORM', formName });

        emitEvent({
            type: 'navigation',
            formName,
            timestamp: Date.now()
        });
    }, [emitEvent]);

    const setFormData = useCallback((formName: string, data: Record<string, any>) => {
        dispatch({ type: 'SET_FORM_DATA', formName, data });
    }, []);

    const getFormData = useCallback((formName: string): Record<string, any> => {
        return state.present.forms[formName]?.serverData || {};
    }, [state.present.forms]);

    // Server synchronization
    const syncWithServer = useCallback(async (formName?: string) => {
        const targetForm = formName || state.present.currentForm;
        if (!targetForm || !serverSyncUrl) return;

        dispatch({ type: 'SET_LOADING', formName: targetForm, loading: true });

        try {
            // Implement server sync logic here
            // This would typically make an API call to sync state
            console.log('Syncing with server:', targetForm);

            emitEvent({
                type: 'server_sync',
                formName: targetForm,
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('Server sync failed:', error);
        } finally {
            dispatch({ type: 'SET_LOADING', formName: targetForm, loading: false });
        }
    }, [state.present.currentForm, serverSyncUrl, emitEvent]);

    const setServerData = useCallback((formName: string, data: Record<string, any>) => {
        dispatch({ type: 'SET_SERVER_DATA', formName, data });
    }, []);

    // Data binding management
    const addDataBinding = useCallback((binding: AnvilDataBinding) => {
        dataBindingsRef.current.push(binding);
    }, []);

    const removeDataBinding = useCallback((componentId: string, property: string) => {
        dataBindingsRef.current = dataBindingsRef.current.filter(
            binding => !(binding.componentId === componentId && binding.property === property)
        );
    }, []);

    const getDataBindings = useCallback((): AnvilDataBinding[] => {
        return dataBindingsRef.current;
    }, []);

    // Computed properties management
    const addComputedProperty = useCallback((computed: AnvilComputedProperty) => {
        computedPropertiesRef.current.push(computed);
    }, []);

    const removeComputedProperty = useCallback((componentId: string, property: string) => {
        computedPropertiesRef.current = computedPropertiesRef.current.filter(
            computed => !(computed.componentId === componentId && computed.property === property)
        );
    }, []);

    // Helper functions for processing bindings and computed properties
    const processComputedProperties = useCallback((changedComponentId: string, changedProperty: string, newValue?: AnvilStateValue) => {
        const dependencyKey = `${changedComponentId}.${changedProperty}`;

        computedPropertiesRef.current.forEach(computed => {
            if (computed.dependencies.includes(dependencyKey)) {
                // Gather dependency values
                const dependencyValues: Record<string, AnvilStateValue> = {};

                computed.dependencies.forEach(dep => {
                    const [depComponentId, depProperty] = dep.split('.');

                    // Use the new value if this is the changed property, otherwise read from state
                    if (dep === dependencyKey && newValue !== undefined) {
                        dependencyValues[dep] = newValue;
                    } else {
                        const component = getComponentState(depComponentId);
                        if (component) {
                            dependencyValues[dep] = component.properties[depProperty];
                        }
                    }
                });

                // Compute new value
                try {
                    const computedValue = computed.compute(dependencyValues);
                    setComponentProperty(computed.componentId, computed.property, computedValue);
                } catch (error) {
                    console.error('Error computing property:', computed, error);
                }
            }
        });
    }, [getComponentState, setComponentProperty]);

    const processDataBinding = useCallback((componentId: string, property: string, value: AnvilStateValue) => {
        const binding = dataBindingsRef.current.find(
            b => b.componentId === componentId && b.property === property
        );

        if (binding && binding.direction === 'two-way') {
            // Transform value if needed
            const transformedValue = binding.transform ? binding.transform(value) : value;

            // Validate if needed
            if (binding.validate) {
                const error = binding.validate(transformedValue);
                if (error) {
                    const formName = findComponentForm(state.present, componentId);
                    if (formName) {
                        dispatch({
                            type: 'SET_ERRORS',
                            formName,
                            errors: { [binding.serverPath]: error }
                        });
                    }
                    return;
                }
            }

            // Update server data
            const formName = findComponentForm(state.present, componentId);
            if (formName) {
                const currentData = getFormData(formName);
                const newData = { ...currentData };

                // Set nested property using path
                setNestedProperty(newData, binding.serverPath, transformedValue);
                setServerData(formName, newData);
            }
        }
    }, [getFormData, setServerData, state.present]);

    // State persistence
    const persistState = useCallback(() => {
        dispatch({ type: 'PERSIST_STATE' });
    }, []);

    const restoreState = useCallback(() => {
        try {
            const savedState = localStorage.getItem(persistenceKey);
            if (savedState) {
                const parsed = JSON.parse(savedState);
                dispatch({ type: 'RESTORE_STATE', state: parsed });
            }
        } catch (error) {
            console.error('Failed to restore state:', error);
        }
    }, [persistenceKey]);

    // Undo/redo
    const undo = useCallback(() => {
        dispatch({ type: 'UNDO' });
    }, []);

    const redo = useCallback(() => {
        dispatch({ type: 'REDO' });
    }, []);

    const canUndo = useCallback((): boolean => {
        return state.past.length > 0;
    }, [state.past.length]);

    const canRedo = useCallback((): boolean => {
        return state.future.length > 0;
    }, [state.future.length]);

    const clearHistory = useCallback(() => {
        dispatch({ type: 'CLEAR_HISTORY' });
    }, []);

    // Event listener management
    const addEventListener = useCallback((listener: (event: AnvilStateChangeEvent) => void): (() => void) => {
        eventListenersRef.current.push(listener);

        return () => {
            eventListenersRef.current = eventListenersRef.current.filter(l => l !== listener);
        };
    }, []);

    const removeEventListener = useCallback((listener: (event: AnvilStateChangeEvent) => void) => {
        eventListenersRef.current = eventListenersRef.current.filter(l => l !== listener);
    }, []);

    // Validation
    const validateForm = useCallback((formName?: string): Record<string, string> => {
        const targetForm = formName || state.present.currentForm;
        if (!targetForm) return {};

        const form = state.present.forms[targetForm];
        if (!form) return {};

        const errors: Record<string, string> = {};

        // Run component validations
        Object.values(form.components).forEach(component => {
            // Basic required field validation
            Object.entries(component.properties).forEach(([property, value]) => {
                if (property === 'required' && value && !component.properties.text && !component.properties.value) {
                    errors[`${component.id}.${property}`] = 'This field is required';
                }
            });
        });

        // Run data binding validations
        dataBindingsRef.current.forEach(binding => {
            if (binding.validate) {
                const component = getComponentState(binding.componentId);
                if (component) {
                    const value = component.properties[binding.property];
                    const error = binding.validate(value);
                    if (error) {
                        errors[`${binding.componentId}.${binding.property}`] = error;
                    }
                }
            }
        });

        return errors;
    }, [state.present.currentForm, state.present.forms, getComponentState]);

    const hasUnsavedChanges = useCallback((formName?: string): boolean => {
        const targetForm = formName || state.present.currentForm;
        if (!targetForm) return false;

        const form = state.present.forms[targetForm];
        if (!form) return false;

        return Object.values(form.components).some(component => component.isDirty);
    }, [state.present.currentForm, state.present.forms]);

    // Context value
    const contextValue: AnvilStateContextValue = {
        state,
        getComponentState,
        setComponentProperty,
        setComponentProperties,
        addComponent,
        removeComponent,
        getCurrentForm,
        navigateToForm,
        setFormData,
        getFormData,
        syncWithServer,
        setServerData,
        addDataBinding,
        removeDataBinding,
        getDataBindings,
        addComputedProperty,
        removeComputedProperty,
        persistState,
        restoreState,
        undo,
        redo,
        canUndo,
        canRedo,
        clearHistory,
        addEventListener,
        removeEventListener,
        validateForm,
        hasUnsavedChanges
    };

    return (
        <AnvilStateContext.Provider value={contextValue}>
            {children}
        </AnvilStateContext.Provider>
    );
};

// Hook to use Anvil state
export const useAnvilStateContext = (): AnvilStateContextValue => {
    const context = useContext(AnvilStateContext);
    if (!context) {
        throw new Error('useAnvilStateContext must be used within an AnvilStateProvider');
    }
    return context;
};

// Utility function to set nested object properties
function setNestedProperty(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in current) || typeof current[key] !== 'object') {
            current[key] = {};
        }
        current = current[key];
    }

    current[keys[keys.length - 1]] = value;
} 