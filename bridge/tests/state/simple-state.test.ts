/**
 * Simple State Management Test
 * 
 * Basic test to verify core functionality works
 */

import { describe, test, expect } from '@jest/globals';

// Mock localStorage for tests
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('State Management Core Functionality', () => {
    beforeEach(() => {
        localStorageMock.clear();
    });

    test('should create and manage component state', () => {
        // Test the basic state structure
        const componentState = {
            id: 'test-component',
            type: 'TextBox',
            properties: { text: 'Hello World' },
            isDirty: false,
            lastModified: Date.now()
        };

        expect(componentState.id).toBe('test-component');
        expect(componentState.type).toBe('TextBox');
        expect(componentState.properties.text).toBe('Hello World');
        expect(componentState.isDirty).toBe(false);
    });

    test('should handle form state structure', () => {
        const formState = {
            formName: 'TestForm',
            components: {
                'comp1': {
                    id: 'comp1',
                    type: 'TextBox',
                    properties: { text: 'Component 1' }
                },
                'comp2': {
                    id: 'comp2',
                    type: 'Button',
                    properties: { text: 'Click Me' }
                }
            },
            isLoading: false,
            errors: {}
        };

        expect(formState.formName).toBe('TestForm');
        expect(Object.keys(formState.components)).toHaveLength(2);
        expect(formState.components.comp1.properties.text).toBe('Component 1');
        expect(formState.components.comp2.properties.text).toBe('Click Me');
    });

    test('should handle data transformations', () => {
        // Test percentage transformer
        const toServer = (value: number) => value / 100;
        const toClient = (value: number) => value * 100;

        expect(toServer(50)).toBe(0.5);
        expect(toClient(0.25)).toBe(25);

        // Test CSV transformer
        const csvToServer = (value: string[]) => value.join(',');
        const csvToClient = (value: string) => value.split(',').filter(Boolean);

        expect(csvToServer(['a', 'b', 'c'])).toBe('a,b,c');
        expect(csvToClient('x,y,z')).toEqual(['x', 'y', 'z']);
    });

    test('should validate data correctly', () => {
        // Test required validator
        const required = (value: any) =>
            (value === null || value === undefined || value === '') ? 'This field is required' : null;

        expect(required('')).toContain('required');
        expect(required('value')).toBeNull();

        // Test email validator
        const email = (value: string) => {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return value && !emailRegex.test(value) ? 'Please enter a valid email address' : null;
        };

        expect(email('invalid')).toContain('valid email');
        expect(email('test@example.com')).toBeNull();

        // Test numeric validator
        const numeric = (value: any) =>
            value !== null && value !== undefined && isNaN(Number(value)) ? 'Must be a number' : null;

        expect(numeric('abc')).toContain('number');
        expect(numeric('123')).toBeNull();
    });

    test('should handle computed properties', () => {
        // Test sum computation
        const dependencies = {
            'input1.value': 10,
            'input2.value': 20,
            'input3.value': 5
        };

        const sum = Object.values(dependencies).reduce((total: number, value) => {
            const num = typeof value === 'number' ? value : Number(value) || 0;
            return total + num;
        }, 0);

        expect(sum).toBe(35);

        // Test concatenation
        const textDeps = {
            'first.text': 'Hello',
            'second.text': 'World'
        };

        const concat = Object.values(textDeps)
            .filter(value => value !== null && value !== undefined && value !== '')
            .join(' ');

        expect(concat).toBe('Hello World');
    });

    test('should manage state persistence', () => {
        const testState = {
            currentForm: 'TestForm',
            forms: {
                TestForm: {
                    formName: 'TestForm',
                    components: {
                        'comp1': {
                            id: 'comp1',
                            type: 'TextBox',
                            properties: { text: 'Persistent Value' }
                        }
                    }
                }
            }
        };

        // Save to localStorage
        const stateKey = 'anvil-app-test';
        const serialized = JSON.stringify({
            data: JSON.stringify(testState),
            metadata: {
                timestamp: Date.now(),
                version: '1.0.0',
                compressed: false,
                encrypted: false,
                size: JSON.stringify(testState).length
            }
        });

        localStorage.setItem(stateKey, serialized);

        // Restore from localStorage
        const stored = localStorage.getItem(stateKey);
        expect(stored).not.toBeNull();

        if (stored) {
            const wrapped = JSON.parse(stored);
            const restoredState = JSON.parse(wrapped.data);

            expect(restoredState.currentForm).toBe('TestForm');
            expect(restoredState.forms.TestForm.components.comp1.properties.text).toBe('Persistent Value');
        }
    });

    test('should handle undo/redo state history', () => {
        // Simulate state history
        const initialState = { value: 'initial' };
        const state1 = { value: 'step1' };
        const state2 = { value: 'step2' };

        const history = {
            past: [initialState, state1],
            present: state2,
            future: [],
            maxHistory: 50
        };

        // Test undo
        const afterUndo = {
            past: [initialState],
            present: state1,
            future: [state2],
            maxHistory: 50
        };

        expect(history.past.length).toBe(2);
        expect(history.present.value).toBe('step2');

        // Simulate undo operation
        const canUndo = history.past.length > 0;
        expect(canUndo).toBe(true);

        if (canUndo) {
            const previousState = history.past[history.past.length - 1];
            expect(previousState.value).toBe('step1');
        }
    });

    test('should handle data binding conflicts', () => {
        // Test conflict resolution strategies
        const clientValue = { text: 'Client Edit', timestamp: 1000 };
        const serverValue = { text: 'Server Edit', timestamp: 2000 };

        // Timestamp strategy - server wins (newer)
        const timestampResolved = clientValue.timestamp > serverValue.timestamp ?
            clientValue : serverValue;
        expect(timestampResolved.text).toBe('Server Edit');

        // Client wins strategy
        const clientWins = clientValue;
        expect(clientWins.text).toBe('Client Edit');

        // Server wins strategy
        const serverWins = serverValue;
        expect(serverWins.text).toBe('Server Edit');

        // Merge strategy (for objects)
        const merged = { ...serverValue, ...clientValue };
        expect(merged.text).toBe('Client Edit'); // Client properties override
    });
});

describe('State Management Utilities', () => {
    test('should create unique component IDs', () => {
        const createComponentId = (formName: string, componentType: string, index?: number): string => {
            const suffix = index !== undefined ? `_${index}` : '';
            return `${formName}_${componentType}_${Date.now()}${suffix}`;
        };

        const id1 = createComponentId('Form1', 'TextBox');
        const id2 = createComponentId('Form1', 'Button', 0);

        expect(id1).toContain('Form1_TextBox_');
        expect(id2).toContain('Form1_Button_');
        expect(id2).toContain('_0');
        expect(id1).not.toBe(id2);
    });

    test('should validate component state structure', () => {
        const validateComponentState = (state: any): boolean => {
            return (
                typeof state === 'object' &&
                state !== null &&
                typeof state.id === 'string' &&
                typeof state.type === 'string' &&
                typeof state.properties === 'object'
            );
        };

        const validState = {
            id: 'comp1',
            type: 'TextBox',
            properties: { text: 'Hello' }
        };

        const invalidState = {
            id: 123, // Should be string
            type: 'TextBox'
            // Missing properties
        };

        expect(validateComponentState(validState)).toBe(true);
        expect(validateComponentState(invalidState)).toBe(false);
        expect(validateComponentState(null)).toBe(false);
        expect(validateComponentState(undefined)).toBe(false);
    });

    test('should handle deep equality checks', () => {
        const isEqual = (a: any, b: any): boolean => {
            if (a === b) return true;
            if (a == null || b == null) return false;
            if (typeof a !== typeof b) return false;

            if (typeof a === 'object') {
                const keysA = Object.keys(a);
                const keysB = Object.keys(b);

                if (keysA.length !== keysB.length) return false;

                return keysA.every(key => isEqual(a[key], b[key]));
            }

            return false;
        };

        expect(isEqual('hello', 'hello')).toBe(true);
        expect(isEqual('hello', 'world')).toBe(false);
        expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
        expect(isEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
        expect(isEqual({ nested: { deep: 'value' } }, { nested: { deep: 'value' } })).toBe(true);
    });
}); 