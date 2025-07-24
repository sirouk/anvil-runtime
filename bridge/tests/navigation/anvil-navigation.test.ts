import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { renderHook, act } from '@testing-library/react';
import {
    FormValidationManager,
    FormValidators,
    ValidationPresets,
    NavigationUtils,
    type FormValidationConfig,
    type ValidationError
} from '../../src/lib/navigation';

/**
 * Comprehensive Navigation System Test Suite
 * 
 * Tests form validation, lifecycle management, and navigation utilities
 */

// Mock Next.js router hooks
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockForward = jest.fn();

jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
        back: mockBack,
        forward: mockForward
    }),
    usePathname: () => '/app/TestForm',
    useSearchParams: () => new URLSearchParams('?param1=value1&param2={"key":"value"}')
}));

describe('Form Validation System', () => {
    let validationManager: FormValidationManager;
    let config: FormValidationConfig;

    beforeEach(() => {
        config = {
            formName: 'TestForm',
            fields: [
                {
                    fieldId: 'email',
                    fieldName: 'Email',
                    rules: [
                        { type: 'required', message: 'Email is required' },
                        { type: 'email', message: 'Invalid email format' }
                    ],
                    validateOnChange: true,
                    debounceMs: 100
                },
                {
                    fieldId: 'age',
                    fieldName: 'Age',
                    rules: [
                        { type: 'required', message: 'Age is required' },
                        { type: 'numeric', message: 'Age must be a number' },
                        { type: 'range', message: 'Age must be between 1 and 120', min: 1, max: 120 }
                    ]
                },
                {
                    fieldId: 'name',
                    fieldName: 'Name',
                    rules: [
                        { type: 'required', message: 'Name is required' },
                        { type: 'length', message: 'Name must be 2-50 characters', minLength: 2, maxLength: 50 }
                    ]
                }
            ],
            showErrorsInline: true,
            preventNavigationOnErrors: true
        };

        validationManager = new FormValidationManager(config);
    });

    afterEach(() => {
        validationManager.destroy();
        jest.clearAllMocks();
    });

    describe('Field Value Management', () => {
        test('should set and get field values', () => {
            validationManager.setFieldValue('email', 'test@example.com');
            validationManager.setFieldValue('age', 25);
            validationManager.setFieldValue('name', 'John Doe');

            expect(validationManager.getFieldValue('email')).toBe('test@example.com');
            expect(validationManager.getFieldValue('age')).toBe(25);
            expect(validationManager.getFieldValue('name')).toBe('John Doe');

            const allValues = validationManager.getAllFieldValues();
            expect(allValues).toEqual({
                email: 'test@example.com',
                age: 25,
                name: 'John Doe'
            });
        });

        test('should trigger validation on change when configured', async () => {
            // Email field has validateOnChange: true
            validationManager.setFieldValue('email', 'invalid-email');

            // Wait for debounce
            await new Promise(resolve => setTimeout(resolve, 150));

            const emailError = validationManager.getFieldError('email');
            expect(emailError).toBeTruthy();
            expect(emailError?.message).toBe('Invalid email format');
        });
    });

    describe('Built-in Validators', () => {
        test('should validate required fields', () => {
            expect(FormValidators.required('')).toBe(false);
            expect(FormValidators.required(null)).toBe(false);
            expect(FormValidators.required(undefined)).toBe(false);
            expect(FormValidators.required('test')).toBe(true);
            expect(FormValidators.required(0)).toBe(true);
            expect(FormValidators.required([])).toBe(false);
            expect(FormValidators.required(['item'])).toBe(true);
        });

        test('should validate email addresses', () => {
            expect(FormValidators.email('')).toBe(true); // Allow empty
            expect(FormValidators.email('test@example.com')).toBe(true);
            expect(FormValidators.email('user@domain.co.uk')).toBe(true);
            expect(FormValidators.email('invalid-email')).toBe(false);
            expect(FormValidators.email('test@')).toBe(false);
            expect(FormValidators.email('@example.com')).toBe(false);
        });

        test('should validate numeric values', () => {
            expect(FormValidators.numeric('')).toBe(true); // Allow empty
            expect(FormValidators.numeric('123')).toBe(true);
            expect(FormValidators.numeric('123.45')).toBe(true);
            expect(FormValidators.numeric('-123')).toBe(true);
            expect(FormValidators.numeric('0')).toBe(true);
            expect(FormValidators.numeric('abc')).toBe(false);
            expect(FormValidators.numeric('12abc')).toBe(false);
        });

        test('should validate string length', () => {
            expect(FormValidators.validateLength('', 2, 10)).toBe(true); // Allow empty
            expect(FormValidators.validateLength('ab', 2, 10)).toBe(true);
            expect(FormValidators.validateLength('abcdefghij', 2, 10)).toBe(true);
            expect(FormValidators.validateLength('a', 2, 10)).toBe(false); // Too short
            expect(FormValidators.validateLength('abcdefghijk', 2, 10)).toBe(false); // Too long
        });

        test('should validate numeric ranges', () => {
            expect(FormValidators.range(undefined as any, 1, 10)).toBe(true); // Allow empty
            expect(FormValidators.range(5, 1, 10)).toBe(true);
            expect(FormValidators.range(1, 1, 10)).toBe(true);
            expect(FormValidators.range(10, 1, 10)).toBe(true);
            expect(FormValidators.range(0, 1, 10)).toBe(false); // Too low
            expect(FormValidators.range(11, 1, 10)).toBe(false); // Too high
        });

        test('should validate patterns', () => {
            const phonePattern = /^\d{3}-\d{3}-\d{4}$/;
            expect(FormValidators.pattern('', phonePattern)).toBe(true); // Allow empty
            expect(FormValidators.pattern('123-456-7890', phonePattern)).toBe(true);
            expect(FormValidators.pattern('1234567890', phonePattern)).toBe(false);
            expect(FormValidators.pattern('123-45-6789', phonePattern)).toBe(false);
        });
    });

    describe('Field Validation', () => {
        test('should validate individual fields correctly', async () => {
            validationManager.setFieldValue('email', 'invalid');
            const emailError = await validationManager.validateField('email');

            expect(emailError).toBeTruthy();
            expect(emailError?.fieldId).toBe('email');
            expect(emailError?.message).toBe('Invalid email format');

            // Fix the email
            validationManager.setFieldValue('email', 'test@example.com');
            const fixedEmailError = await validationManager.validateField('email');
            expect(fixedEmailError).toBeNull();
        });

        test('should validate required fields', async () => {
            // Empty required field should fail
            validationManager.setFieldValue('name', '');
            const nameError = await validationManager.validateField('name');

            expect(nameError).toBeTruthy();
            expect(nameError?.message).toBe('Name is required');

            // Valid name should pass
            validationManager.setFieldValue('name', 'John Doe');
            const validNameError = await validationManager.validateField('name');
            expect(validNameError).toBeNull();
        });

        test('should validate multiple rules in sequence', async () => {
            // Age field has required, numeric, and range rules

            // Empty value - should fail on required
            validationManager.setFieldValue('age', '');
            const requiredError = await validationManager.validateField('age');
            expect(requiredError?.message).toBe('Age is required');

            // Non-numeric value - should fail on numeric
            validationManager.setFieldValue('age', 'abc');
            const numericError = await validationManager.validateField('age');
            expect(numericError?.message).toBe('Age must be a number');

            // Out of range - should fail on range
            validationManager.setFieldValue('age', '150');
            const rangeError = await validationManager.validateField('age');
            expect(rangeError?.message).toBe('Age must be between 1 and 120');

            // Valid age - should pass all rules
            validationManager.setFieldValue('age', '25');
            const validError = await validationManager.validateField('age');
            expect(validError).toBeNull();
        });
    });

    describe('Form Validation', () => {
        test('should validate entire form', async () => {
            // Set invalid values
            validationManager.setFieldValue('email', 'invalid');
            validationManager.setFieldValue('age', '');
            validationManager.setFieldValue('name', 'X'); // Too short

            const errors = await validationManager.validateForm();

            expect(errors).toHaveLength(3);
            expect(errors.find(e => e.fieldId === 'email')?.message).toBe('Invalid email format');
            expect(errors.find(e => e.fieldId === 'age')?.message).toBe('Age is required');
            expect(errors.find(e => e.fieldId === 'name')?.message).toBe('Name must be 2-50 characters');
        });

        test('should return no errors for valid form', async () => {
            // Set valid values
            validationManager.setFieldValue('email', 'test@example.com');
            validationManager.setFieldValue('age', '25');
            validationManager.setFieldValue('name', 'John Doe');

            const errors = await validationManager.validateForm();
            expect(errors).toHaveLength(0);
            expect(validationManager.isFormValid()).toBe(true);
        });
    });

    describe('Error Management', () => {
        test('should track and clear field errors', async () => {
            validationManager.setFieldValue('email', 'invalid');
            await validationManager.validateField('email');

            expect(validationManager.hasErrors()).toBe(true);
            expect(validationManager.getAllErrors()).toHaveLength(1);

            const emailError = validationManager.getFieldError('email');
            expect(emailError).toBeTruthy();

            validationManager.clearFieldError('email');
            expect(validationManager.getFieldError('email')).toBeNull();
            expect(validationManager.hasErrors()).toBe(false);
        });

        test('should clear all errors', async () => {
            validationManager.setFieldValue('email', 'invalid');
            validationManager.setFieldValue('name', '');

            await validationManager.validateForm();
            expect(validationManager.getAllErrors().length).toBeGreaterThan(0);

            validationManager.clearAllErrors();
            expect(validationManager.getAllErrors()).toHaveLength(0);
            expect(validationManager.hasErrors()).toBe(false);
        });
    });

    describe('Form Submission', () => {
        test('should submit valid form successfully', async () => {
            // Set valid data
            validationManager.setFieldValue('email', 'test@example.com');
            validationManager.setFieldValue('age', '25');
            validationManager.setFieldValue('name', 'John Doe');

            const mockSubmit = jest.fn().mockResolvedValue({ id: 123, message: 'Success' }) as any;

            const result = await validationManager.submitForm(mockSubmit);

            expect(result.success).toBe(true);
            expect(result.data).toEqual({
                email: 'test@example.com',
                age: '25',
                name: 'John Doe'
            });
            expect(result.serverResponse).toEqual({ id: 123, message: 'Success' });
            expect(mockSubmit).toHaveBeenCalledWith({
                email: 'test@example.com',
                age: '25',
                name: 'John Doe'
            });
        });

        test('should reject invalid form submission', async () => {
            // Set invalid data
            validationManager.setFieldValue('email', 'invalid');
            validationManager.setFieldValue('age', '');

            const mockSubmit = jest.fn() as any;

            const result = await validationManager.submitForm(mockSubmit);

            expect(result.success).toBe(false);
            expect(result.errors).toBeTruthy();
            expect(result.errors!.length).toBeGreaterThan(0);
            expect(mockSubmit).not.toHaveBeenCalled();
        });

        test('should handle submission errors', async () => {
            // Set valid data
            validationManager.setFieldValue('email', 'test@example.com');
            validationManager.setFieldValue('age', '25');
            validationManager.setFieldValue('name', 'John Doe');

            const mockSubmit = jest.fn().mockRejectedValue(new Error('Server error')) as any;

            const result = await validationManager.submitForm(mockSubmit);

            expect(result.success).toBe(false);
            expect(result.errors).toBeTruthy();
            expect(result.errors![0].message).toBe('Server error');
        });

        test('should handle server validation errors', async () => {
            validationManager.setFieldValue('email', 'test@example.com');
            validationManager.setFieldValue('age', '25');
            validationManager.setFieldValue('name', 'John Doe');

            const serverError = {
                validationErrors: {
                    email: 'Email already exists',
                    name: 'Name is not allowed'
                }
            };

            const mockSubmit = jest.fn().mockRejectedValue(serverError) as any;

            const result = await validationManager.submitForm(mockSubmit);

            expect(result.success).toBe(false);
            expect(result.errors).toHaveLength(2);
            expect(result.errors!.find(e => e.fieldId === 'email')?.message).toBe('Email already exists');
            expect(result.errors!.find(e => e.fieldId === 'name')?.message).toBe('Name is not allowed');
        });
    });

    describe('Form Completion Tracking', () => {
        test('should calculate form completion percentage', () => {
            // No fields completed
            expect(validationManager.getFormCompletionPercentage()).toBe(0);

            // One field completed
            validationManager.setFieldValue('email', 'test@example.com');
            expect(validationManager.getFormCompletionPercentage()).toBe(33); // 1/3 fields

            // Two fields completed
            validationManager.setFieldValue('name', 'John Doe');
            expect(validationManager.getFormCompletionPercentage()).toBe(67); // 2/3 fields

            // All fields completed
            validationManager.setFieldValue('age', '25');
            expect(validationManager.getFormCompletionPercentage()).toBe(100); // 3/3 fields
        });
    });

    describe('Field Configuration Management', () => {
        test('should add new field configurations', () => {
            const newField = {
                fieldId: 'phone',
                fieldName: 'Phone',
                rules: [
                    { type: 'pattern' as const, message: 'Invalid phone format', pattern: /^\d{3}-\d{3}-\d{4}$/ }
                ]
            };

            validationManager.addField(newField);
            validationManager.setFieldValue('phone', '123-456-7890');

            expect(validationManager.getFieldValue('phone')).toBe('123-456-7890');
        });

        test('should remove field configurations', () => {
            validationManager.setFieldValue('email', 'test@example.com');
            expect(validationManager.getFieldValue('email')).toBe('test@example.com');

            validationManager.removeField('email');
            expect(validationManager.getFieldValue('email')).toBeUndefined();
        });
    });
});

describe('Navigation Utilities', () => {
    describe('Parameter Serialization', () => {
        test('should serialize parameters to URL format', () => {
            const params = {
                name: 'John Doe',
                age: 25,
                active: true,
                data: { key: 'value' }
            };

            const serialized = NavigationUtils.serializeParams(params);
            expect(serialized).toContain('name=John+Doe');
            expect(serialized).toContain('age=25');
            expect(serialized).toContain('active=true');
            expect(serialized).toContain('data=%7B%22key%22%3A%22value%22%7D'); // JSON encoded
        });

        test('should deserialize parameters from URL format', () => {
            const searchParams = 'name=John+Doe&age=25&active=true&data=%7B%22key%22%3A%22value%22%7D';
            const deserialized = NavigationUtils.deserializeParams(searchParams);

            expect(deserialized).toEqual({
                name: 'John Doe',
                age: 25,
                active: true,
                data: { key: 'value' }
            });
        });

        test('should handle URLSearchParams objects', () => {
            const urlParams = new URLSearchParams();
            urlParams.set('simple', 'value');
            urlParams.set('complex', JSON.stringify({ nested: 'data' }));

            const deserialized = NavigationUtils.deserializeParams(urlParams);
            expect(deserialized).toEqual({
                simple: 'value',
                complex: { nested: 'data' }
            });
        });
    });

    describe('Form Validation', () => {
        test('should validate form names', () => {
            expect(NavigationUtils.isValidFormName('ValidForm')).toBe(true);
            expect(NavigationUtils.isValidFormName('Valid_Form_123')).toBe(true);
            expect(NavigationUtils.isValidFormName('form1')).toBe(true);

            expect(NavigationUtils.isValidFormName('123Form')).toBe(false); // Can't start with number
            expect(NavigationUtils.isValidFormName('Invalid-Form')).toBe(false); // No hyphens
            expect(NavigationUtils.isValidFormName('Invalid Form')).toBe(false); // No spaces
            expect(NavigationUtils.isValidFormName('')).toBe(false); // Empty
        });
    });

    describe('ID Generation', () => {
        test('should generate unique form IDs', () => {
            const id1 = NavigationUtils.generateFormId('TestForm');
            const id2 = NavigationUtils.generateFormId('TestForm');

            expect(id1).toContain('TestForm_');
            expect(id2).toContain('TestForm_');
            expect(id1).not.toBe(id2); // Should be unique
        });
    });

    describe('Route Creation', () => {
        test('should create form routes with parameters', () => {
            const route1 = NavigationUtils.createFormRoute('/app', 'TestForm');
            expect(route1).toBe('/app/TestForm');

            const route2 = NavigationUtils.createFormRoute('/app', 'TestForm', { id: 123, mode: 'edit' });
            expect(route2).toContain('/app/TestForm?');
            expect(route2).toContain('id=123');
            expect(route2).toContain('mode=edit');
        });
    });
});

describe('Validation Presets', () => {
    test('should provide user registration preset', () => {
        const preset = ValidationPresets.userRegistration();

        expect(preset.formName).toBe('UserRegistration');
        expect(preset.fields).toHaveLength(3);

        const emailField = preset.fields.find(f => f.fieldId === 'email');
        expect(emailField).toBeTruthy();
        expect(emailField?.rules).toHaveLength(2);

        const passwordField = preset.fields.find(f => f.fieldId === 'password');
        expect(passwordField).toBeTruthy();
        expect(passwordField?.rules).toHaveLength(2);
    });

    test('should provide contact form preset', () => {
        const preset = ValidationPresets.contactForm();

        expect(preset.formName).toBe('ContactForm');
        expect(preset.fields).toHaveLength(3);

        const nameField = preset.fields.find(f => f.fieldId === 'name');
        const emailField = preset.fields.find(f => f.fieldId === 'email');
        const messageField = preset.fields.find(f => f.fieldId === 'message');

        expect(nameField).toBeTruthy();
        expect(emailField).toBeTruthy();
        expect(messageField).toBeTruthy();
    });
}); 