import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import {
    AnvilStateProvider,
    useAnvilStateContext,
    AnvilComponentState,
    AnvilFormState,
    AnvilAppState
} from '../../src/lib/state/anvil-state-context';
import {
    useAnvilState,
    useAnvilProperty,
    useAnvilForm
} from '../../src/lib/state/use-anvil-state';
import {
    DataBindingManager,
    EnhancedDataBinding,
    CommonTransformers,
    CommonValidators
} from '../../src/lib/state/data-binding-utils';
import {
    ComputedPropertiesManager,
    ComputedPropertyFactories,
    DependencySpec
} from '../../src/lib/state/computed-properties';
import {
    StatePersistenceManager,
    PersistencePresets
} from '../../src/lib/state/state-persistence';
import React from 'react';
import { render, renderHook, act } from '@testing-library/react';

/**
 * Comprehensive Anvil State Management Test Suite
 * 
 * Tests all aspects of the state management system including:
 * - Component state management
 * - Data binding and synchronization
 * - Computed properties and dependencies
 * - State persistence across sessions
 * - Undo/redo functionality
 */

// Mock localStorage for tests
const localStorageMock = (() => {
    let store: Record<string, string> = {};

    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        length: 0,
        key: (index: number) => Object.keys(store)[index] || null
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode; initialState?: AnvilAppState }> = ({
    children,
    initialState
}) => React.createElement(
    AnvilStateProvider,
    { initialState },
    children
);

describe('Anvil State Management System', () => {
    beforeEach(() => {
        localStorageMock.clear();
        jest.clearAllMocks();
    });

    describe('AnvilStateContext', () => {
        test('should provide initial state', () => {
            const { result } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            expect(result.current.state.present.forms).toEqual({});
            expect(result.current.state.past).toEqual([]);
            expect(result.current.state.future).toEqual([]);
        });

        test('should add component to state', () => {
            const { result } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            const component: AnvilComponentState = {
                id: 'test-component',
                type: 'TextBox',
                properties: { text: 'Hello World' }
            };

            act(() => {
                result.current.addComponent('testForm', component);
            });

            const addedComponent = result.current.getComponentState('test-component');
            expect(addedComponent).toEqual(component);
        });

        test('should update component property', () => {
            const { result } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            const component: AnvilComponentState = {
                id: 'test-component',
                type: 'TextBox',
                properties: { text: 'Initial' }
            };

            act(() => {
                result.current.addComponent('testForm', component);
                result.current.setComponentProperty('test-component', 'text', 'Updated');
            });

            const updatedComponent = result.current.getComponentState('test-component');
            expect(updatedComponent?.properties.text).toBe('Updated');
            expect(updatedComponent?.isDirty).toBe(true);
        });

        test('should handle undo/redo functionality', () => {
            const { result } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            const component: AnvilComponentState = {
                id: 'test-component',
                type: 'TextBox',
                properties: { text: 'Initial' }
            };

            act(() => {
                result.current.addComponent('testForm', component);
            });

            act(() => {
                result.current.setComponentProperty('test-component', 'text', 'Step 1');
            });

            act(() => {
                result.current.setComponentProperty('test-component', 'text', 'Step 2');
            });

            // Check we can undo
            expect(result.current.canUndo()).toBe(true);
            expect(result.current.canRedo()).toBe(false);

            // Undo to step 1
            act(() => {
                result.current.undo();
            });

            let component1 = result.current.getComponentState('test-component');
            expect(component1?.properties.text).toBe('Step 1');
            expect(result.current.canRedo()).toBe(true);

            // Undo to initial state
            act(() => {
                result.current.undo();
            });

            let component2 = result.current.getComponentState('test-component');
            expect(component2?.properties.text).toBe('Initial');

            // Redo to step 1
            act(() => {
                result.current.redo();
            });

            let component3 = result.current.getComponentState('test-component');
            expect(component3?.properties.text).toBe('Step 1');
        });

        test('should navigate between forms', () => {
            const { result } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.navigateToForm('form1');
            });

            expect(result.current.state.present.currentForm).toBe('form1');

            act(() => {
                result.current.navigateToForm('form2');
            });

            expect(result.current.state.present.currentForm).toBe('form2');
        });
    });

    describe('useAnvilState Hook', () => {
        test('should initialize component state', () => {
            const { result } = renderHook(() => useAnvilState({
                componentId: 'test-component',
                componentType: 'TextBox',
                defaultProperties: { text: 'Default Text', enabled: true }
            }), {
                wrapper: TestWrapper
            });

            expect(result.current.properties.text).toBe('Default Text');
            expect(result.current.properties.enabled).toBe(true);
            expect(result.current.isDirty).toBe(false);
        });

        test('should update properties reactively', () => {
            const { result } = renderHook(() => useAnvilState({
                componentId: 'test-component',
                componentType: 'TextBox',
                defaultProperties: { text: 'Initial' }
            }), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.setProperty('text', 'Updated');
            });

            expect(result.current.properties.text).toBe('Updated');
            expect(result.current.isDirty).toBe(true);
        });

        test('should handle multiple property updates', () => {
            const { result } = renderHook(() => useAnvilState({
                componentId: 'test-component',
                componentType: 'TextBox',
                defaultProperties: { text: '', enabled: true, visible: true }
            }), {
                wrapper: TestWrapper
            });

            act(() => {
                result.current.setProperties({
                    text: 'Multi Update',
                    enabled: false,
                    visible: false
                });
            });

            expect(result.current.properties.text).toBe('Multi Update');
            expect(result.current.properties.enabled).toBe(false);
            expect(result.current.properties.visible).toBe(false);
        });

        test('should handle validation', () => {
            const { result } = renderHook(() => useAnvilState({
                componentId: 'test-component',
                componentType: 'TextBox',
                defaultProperties: { text: '', required: true }
            }), {
                wrapper: TestWrapper
            });

            const errors = result.current.validate();
            expect(Object.keys(errors)).toHaveLength(0); // No validation implemented in basic hook
        });
    });

    describe('useAnvilProperty Hook', () => {
        test('should provide property getter and setter', () => {
            const { result } = renderHook(() => useAnvilProperty<string>(
                'test-component',
                'text',
                'Default Value'
            ), {
                wrapper: TestWrapper
            });

            const [value, setValue] = result.current;
            expect(value).toBe('Default Value');

            act(() => {
                setValue('New Value');
            });

            // Re-render to get updated value
            const [updatedValue] = result.current;
            expect(updatedValue).toBe('New Value');
        });
    });

    describe('useAnvilForm Hook', () => {
        test('should handle form-level operations', () => {
            const { result } = renderHook(() => useAnvilForm('testForm'), {
                wrapper: TestWrapper
            });

            expect(result.current.formName).toBe('testForm');
            expect(result.current.hasUnsavedChanges()).toBe(false);
            expect(result.current.canUndo()).toBe(false);
            expect(result.current.canRedo()).toBe(false);

            act(() => {
                result.current.navigateToForm('otherForm');
            });

            expect(result.current.formName).toBe('otherForm');
        });
    });

    describe('Data Binding System', () => {
        let bindingManager: DataBindingManager;

        beforeEach(() => {
            bindingManager = new DataBindingManager();
        });

        test('should register and sync bindings', async () => {
            const binding: EnhancedDataBinding = {
                componentId: 'test-component',
                property: 'text',
                serverPath: 'user.name',
                direction: 'two-way'
            };

            bindingManager.registerBinding(binding);

            const serverData = { user: { name: 'John Doe' } };
            const result = await bindingManager.syncServerToClient(
                'test-component',
                'text',
                serverData
            );

            expect(result.success).toBe(true);
            expect(result.newClientValue).toBe('John Doe');
        });

        test('should handle data transformations', async () => {
            const binding: EnhancedDataBinding = {
                componentId: 'test-component',
                property: 'percentage',
                serverPath: 'data.rate',
                direction: 'two-way',
                transformer: CommonTransformers.percentage
            };

            bindingManager.registerBinding(binding);

            const serverData = { data: { rate: 0.25 } }; // 25% as decimal
            const result = await bindingManager.syncServerToClient(
                'test-component',
                'percentage',
                serverData
            );

            expect(result.success).toBe(true);
            expect(result.newClientValue).toBe(25); // Converted to percentage
        });

        test('should validate data before sync', async () => {
            const binding: EnhancedDataBinding = {
                componentId: 'test-component',
                property: 'email',
                serverPath: 'user.email',
                direction: 'two-way',
                clientValidation: CommonValidators.email
            };

            bindingManager.registerBinding(binding);

            const serverData = {};
            const result = await bindingManager.syncClientToServer(
                'test-component',
                'email',
                'invalid-email',
                serverData
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('valid email');
        });

        test('should handle debounced updates', (done) => {
            const binding: EnhancedDataBinding = {
                componentId: 'test-component',
                property: 'text',
                serverPath: 'data.text',
                direction: 'two-way',
                debounceMs: 100
            };

            bindingManager.registerBinding(binding);

            const serverData = {};
            bindingManager.handleClientChange('test-component', 'text', 'Test', serverData);

            // Should not sync immediately
            expect(serverData).toEqual({});

            // Should sync after debounce delay
            setTimeout(() => {
                expect(serverData).toEqual({ data: { text: 'Test' } });
                done();
            }, 150);
        });
    });

    describe('Computed Properties System', () => {
        let computedManager: ComputedPropertiesManager;
        let mockGetState: jest.Mock;
        let mockSetState: jest.Mock;

        beforeEach(() => {
            mockGetState = jest.fn();
            mockSetState = jest.fn();
            computedManager = new ComputedPropertiesManager(mockGetState, mockSetState);
        });

        test('should compute sum property', () => {
            const sumProperty = ComputedPropertyFactories.sum(
                'result-component',
                'total',
                [
                    { componentId: 'input1', property: 'value' },
                    { componentId: 'input2', property: 'value' }
                ]
            );

            mockGetState.mockImplementation((componentId: string, property: string) => {
                if (componentId === 'input1' && property === 'value') return 10;
                if (componentId === 'input2' && property === 'value') return 20;
                return 0;
            });

            computedManager.registerComputedProperty(sumProperty);

            expect(mockSetState).toHaveBeenCalledWith('result-component', 'total', 30);
        });

        test('should compute concatenation property', () => {
            const concatProperty = ComputedPropertyFactories.concat(
                'result-component',
                'fullName',
                [
                    { componentId: 'first-name', property: 'text' },
                    { componentId: 'last-name', property: 'text' }
                ],
                ' '
            );

            mockGetState.mockImplementation((componentId: string, property: string) => {
                if (componentId === 'first-name' && property === 'text') return 'John';
                if (componentId === 'last-name' && property === 'text') return 'Doe';
                return '';
            });

            computedManager.registerComputedProperty(concatProperty);

            expect(mockSetState).toHaveBeenCalledWith('result-component', 'fullName', 'John Doe');
        });

        test('should handle dependency changes', () => {
            const sumProperty = ComputedPropertyFactories.sum(
                'result-component',
                'total',
                [
                    { componentId: 'input1', property: 'value' },
                    { componentId: 'input2', property: 'value' }
                ]
            );

            mockGetState.mockReturnValue(5);
            computedManager.registerComputedProperty(sumProperty);

            // Initial computation
            expect(mockSetState).toHaveBeenCalledWith('result-component', 'total', 10);

            // Simulate dependency change
            mockGetState.mockReturnValue(10);
            computedManager.handleDependencyChange('input1', 'value', 15);

            // Should trigger recomputation
            expect(mockSetState).toHaveBeenCalledWith('result-component', 'total', 20);
        });

        test('should cache computed values', () => {
            const sumProperty = ComputedPropertyFactories.sum(
                'result-component',
                'total',
                [
                    { componentId: 'input1', property: 'value' }
                ]
            );

            sumProperty.cache = true;
            sumProperty.cacheTimeout = 1000;

            mockGetState.mockReturnValue(5);
            computedManager.registerComputedProperty(sumProperty);

            // First call should compute
            const value1 = computedManager.getComputedValue('result-component', 'total');
            expect(value1).toBe(5);

            // Second call should use cache
            mockGetState.mockReturnValue(10); // Change underlying value
            const value2 = computedManager.getComputedValue('result-component', 'total');
            expect(value2).toBe(5); // Should still be cached value
        });
    });

    describe('State Persistence System', () => {
        test('should save and restore state', async () => {
            const config = PersistencePresets.everything('test-app');
            const persistenceManager = new StatePersistenceManager(config);

            const testState: AnvilAppState = {
                currentForm: 'testForm',
                forms: {
                    testForm: {
                        formName: 'testForm',
                        components: {
                            'component1': {
                                id: 'component1',
                                type: 'TextBox',
                                properties: { text: 'Test Value' }
                            }
                        }
                    }
                }
            };

            // Save state
            const saveResult = await persistenceManager.saveState(testState);
            expect(saveResult.success).toBe(true);

            // Load state
            const { state: loadedState } = await persistenceManager.loadState();
            expect(loadedState).toEqual(testState);
        });

        test('should handle selective persistence', async () => {
            const config = PersistencePresets.minimal('test-app');
            const persistenceManager = new StatePersistenceManager(config);

            const testState: AnvilAppState = {
                currentForm: 'testForm',
                forms: {
                    testForm: {
                        formName: 'testForm',
                        components: {
                            'component1': {
                                id: 'component1',
                                type: 'TextBox',
                                properties: { text: 'Test Value' }
                            }
                        },
                        serverData: { secret: 'sensitive' }
                    }
                },
                user: { id: 1, name: 'Test User' }
            };

            const saveResult = await persistenceManager.saveState(testState);
            expect(saveResult.success).toBe(true);

            const { state: loadedState } = await persistenceManager.loadState();

            // Should include forms but exclude server data and user
            expect(loadedState?.forms.testForm.components).toBeDefined();
            expect(loadedState?.forms.testForm.serverData).toBeUndefined();
            expect(loadedState?.user).toBeUndefined();
        });

        test('should handle compression', async () => {
            const config = PersistencePresets.everything('test-app');
            config.compress = true;
            const persistenceManager = new StatePersistenceManager(config);

            const testState: AnvilAppState = {
                forms: {
                    testForm: {
                        formName: 'testForm',
                        components: {
                            'component1': {
                                id: 'component1',
                                type: 'TextBox',
                                properties: { text: 'A'.repeat(1000) } // Large text to compress
                            }
                        }
                    }
                }
            };

            const saveResult = await persistenceManager.saveState(testState);
            expect(saveResult.success).toBe(true);
            expect(saveResult.compressed).toBe(true);

            const { state: loadedState } = await persistenceManager.loadState();
            expect(loadedState?.forms.testForm.components.component1.properties.text).toBe('A'.repeat(1000));
        });

        test('should handle expiration', async () => {
            const config = PersistencePresets.everything('test-app');
            config.expirationMs = 100; // 100ms expiration
            const persistenceManager = new StatePersistenceManager(config);

            const testState: AnvilAppState = {
                forms: {}
            };

            await persistenceManager.saveState(testState);

            // Should exist immediately
            expect(await persistenceManager.hasPersistedState()).toBe(true);

            // Wait for expiration
            await new Promise(resolve => setTimeout(resolve, 150));

            // Should be expired and removed
            const { state } = await persistenceManager.loadState();
            expect(state).toBeNull();
        });
    });

    describe('Integration Tests', () => {
        test('should integrate state management with data binding', () => {
            const { result } = renderHook(() => {
                const stateContext = useAnvilStateContext();
                const anvilState = useAnvilState({
                    componentId: 'test-component',
                    componentType: 'TextBox',
                    defaultProperties: { text: '' },
                    dataBindings: {
                        text: {
                            serverPath: 'user.name',
                            direction: 'two-way'
                        }
                    }
                });

                return { stateContext, anvilState };
            }, {
                wrapper: TestWrapper
            });

            // Set server data
            act(() => {
                result.current.stateContext.setServerData('default', { user: { name: 'John Doe' } });
            });

            // Update component property
            act(() => {
                result.current.anvilState.setProperty('text', 'Jane Doe');
            });

            expect(result.current.anvilState.properties.text).toBe('Jane Doe');
            expect(result.current.anvilState.isDirty).toBe(true);
        });

        test('should integrate computed properties with state updates', () => {
            const { result } = renderHook(() => {
                const input1 = useAnvilState({
                    componentId: 'input1',
                    componentType: 'NumberBox',
                    defaultProperties: { value: 10 }
                });

                const input2 = useAnvilState({
                    componentId: 'input2',
                    componentType: 'NumberBox',
                    defaultProperties: { value: 20 }
                });

                const sum = useAnvilState({
                    componentId: 'sum',
                    componentType: 'Label',
                    defaultProperties: { text: '' },
                    computedProperties: {
                        text: (deps) => {
                            const val1 = deps['input1.value'] || 0;
                            const val2 = deps['input2.value'] || 0;
                            return `Sum: ${Number(val1) + Number(val2)}`;
                        }
                    }
                });

                return { input1, input2, sum };
            }, {
                wrapper: TestWrapper
            });

            // Update first input
            act(() => {
                result.current.input1.setProperty('value', 15);
            });

            // Sum should be recalculated
            expect(result.current.sum.properties.text).toBe('Sum: 35');

            // Update second input
            act(() => {
                result.current.input2.setProperty('value', 25);
            });

            // Sum should be recalculated again
            expect(result.current.sum.properties.text).toBe('Sum: 40');
        });

        test('should persist and restore complete application state', async () => {
            const initialState: AnvilAppState = {
                currentForm: 'testForm',
                forms: {
                    testForm: {
                        formName: 'testForm',
                        components: {
                            'input1': {
                                id: 'input1',
                                type: 'TextBox',
                                properties: { text: 'Persisted Value' }
                            }
                        }
                    }
                }
            };

            // First render with initial state
            const { result: result1 } = renderHook(() => useAnvilStateContext(), {
                wrapper: ({ children }) => React.createElement(TestWrapper, { initialState }, children)
            });

            // Persist state
            act(() => {
                result1.current.persistState();
            });

            // Second render without initial state (simulating page reload)
            const { result: result2 } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            // Restore state
            act(() => {
                result2.current.restoreState();
            });

            // Should have restored the persisted state
            const restoredComponent = result2.current.getComponentState('input1');
            expect(restoredComponent?.properties.text).toBe('Persisted Value');
        });
    });

    describe('Performance Tests', () => {
        test('should handle large number of components efficiently', () => {
            const { result } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            const startTime = performance.now();

            // Add 1000 components
            act(() => {
                for (let i = 0; i < 1000; i++) {
                    const component: AnvilComponentState = {
                        id: `component-${i}`,
                        type: 'TextBox',
                        properties: { text: `Component ${i}` }
                    };
                    result.current.addComponent('testForm', component);
                }
            });

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (< 1 second)
            expect(duration).toBeLessThan(1000);

            // Verify all components were added
            const form = result.current.state.present.forms.testForm;
            expect(Object.keys(form.components)).toHaveLength(1000);
        });

        test('should handle rapid property updates efficiently', () => {
            const { result } = renderHook(() => useAnvilState({
                componentId: 'test-component',
                componentType: 'TextBox',
                defaultProperties: { text: '' }
            }), {
                wrapper: TestWrapper
            });

            const startTime = performance.now();

            // Perform 1000 rapid updates
            act(() => {
                for (let i = 0; i < 1000; i++) {
                    result.current.setProperty('text', `Update ${i}`);
                }
            });

            const endTime = performance.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time
            expect(duration).toBeLessThan(500);

            // Should have final value
            expect(result.current.properties.text).toBe('Update 999');
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid component operations gracefully', () => {
            const { result } = renderHook(() => useAnvilStateContext(), {
                wrapper: TestWrapper
            });

            // Try to update non-existent component
            act(() => {
                result.current.setComponentProperty('non-existent', 'text', 'value');
            });

            // Should not throw error
            expect(result.current.getComponentState('non-existent')).toBeUndefined();
        });

        test('should handle persistence errors gracefully', async () => {
            // Mock localStorage to throw error
            const originalSetItem = localStorageMock.setItem;
            localStorageMock.setItem = () => {
                throw new Error('Storage quota exceeded');
            };

            const config = PersistencePresets.everything('test-app');
            const persistenceManager = new StatePersistenceManager(config);

            const testState: AnvilAppState = { forms: {} };
            const result = await persistenceManager.saveState(testState);

            expect(result.success).toBe(false);
            expect(result.error).toContain('quota exceeded');

            // Restore original implementation
            localStorageMock.setItem = originalSetItem;
        });

        test('should handle data binding validation errors', async () => {
            const bindingManager = new DataBindingManager();

            const binding: EnhancedDataBinding = {
                componentId: 'test-component',
                property: 'email',
                serverPath: 'user.email',
                direction: 'two-way',
                clientValidation: CommonValidators.email
            };

            bindingManager.registerBinding(binding);

            const serverData = {};
            const result = await bindingManager.syncClientToServer(
                'test-component',
                'email',
                'not-an-email',
                serverData
            );

            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });
    });
});

// Additional utility tests
describe('State Management Utilities', () => {
    describe('Common Transformers', () => {
        test('should transform percentage values', () => {
            const { toServer, toClient } = CommonTransformers.percentage;

            expect(toServer!(50)).toBe(0.5);
            expect(toClient!(0.25)).toBe(25);
        });

        test('should transform dates to ISO strings', () => {
            const { toServer, toClient } = CommonTransformers.dateToISOString;

            const date = new Date('2023-01-01T00:00:00Z');
            const isoString = date.toISOString();

            expect(toServer!(date)).toBe(isoString);
            expect(toClient!(isoString)).toEqual(date);
        });

        test('should transform CSV to array', () => {
            const { toServer, toClient } = CommonTransformers.csvToArray;

            expect(toServer!(['a', 'b', 'c'])).toBe('a,b,c');
            expect(toClient!('a,b,c')).toEqual(['a', 'b', 'c']);
        });
    });

    describe('Common Validators', () => {
        test('should validate required fields', () => {
            expect(CommonValidators.required('')).toContain('required');
            expect(CommonValidators.required(null)).toContain('required');
            expect(CommonValidators.required('value')).toBeNull();
        });

        test('should validate email addresses', () => {
            expect(CommonValidators.email('invalid')).toContain('valid email');
            expect(CommonValidators.email('test@example.com')).toBeNull();
        });

        test('should validate numeric values', () => {
            expect(CommonValidators.numeric('abc')).toContain('number');
            expect(CommonValidators.numeric('123')).toBeNull();
            expect(CommonValidators.numeric(456)).toBeNull();
        });

        test('should validate string length', () => {
            const minLength5 = CommonValidators.minLength(5);
            const maxLength10 = CommonValidators.maxLength(10);

            expect(minLength5('abc')).toContain('at least 5');
            expect(minLength5('12345')).toBeNull();

            expect(maxLength10('12345678901')).toContain('no more than 10');
            expect(maxLength10('1234567890')).toBeNull();
        });

        test('should validate numeric ranges', () => {
            const range1to10 = CommonValidators.range(1, 10);

            expect(range1to10(0)).toContain('between 1 and 10');
            expect(range1to10(11)).toContain('between 1 and 10');
            expect(range1to10(5)).toBeNull();
        });
    });
}); 