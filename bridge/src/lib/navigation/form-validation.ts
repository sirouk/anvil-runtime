/**
 * Form Validation System for Anvil Bridge
 * 
 * Provides comprehensive validation, submission handling, and error management
 * Compatible with Anvil's form validation patterns
 */

export interface ValidationRule {
    type: 'required' | 'email' | 'numeric' | 'length' | 'range' | 'pattern' | 'custom';
    message: string;
    // Rule-specific options
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: RegExp;
    validator?: (value: any) => boolean | Promise<boolean>;
}

export interface FieldValidationConfig {
    fieldId: string;
    fieldName: string;
    rules: ValidationRule[];
    validateOnChange?: boolean;
    validateOnBlur?: boolean;
    debounceMs?: number;
}

export interface ValidationError {
    fieldId: string;
    fieldName: string;
    message: string;
    rule: ValidationRule;
}

export interface FormValidationConfig {
    formName: string;
    fields: FieldValidationConfig[];
    submitOnValid?: boolean;
    showErrorsInline?: boolean;
    preventNavigationOnErrors?: boolean;
}

export interface FormSubmissionData {
    [fieldId: string]: any;
}

export interface FormSubmissionResult {
    success: boolean;
    errors?: ValidationError[];
    data?: FormSubmissionData;
    serverResponse?: any;
}

// Built-in validators
export class FormValidators {
    static required(value: any): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
    }

    static email(value: string): boolean {
        if (!value) return true; // Allow empty unless required rule also present
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }

    static numeric(value: any): boolean {
        if (!value && value !== 0) return true; // Allow empty unless required
        return !isNaN(Number(value));
    }

    static validateLength(value: string, minLength?: number, maxLength?: number): boolean {
        if (!value) return true; // Allow empty unless required
        const length = value.length;
        if (minLength !== undefined && length < minLength) return false;
        if (maxLength !== undefined && length > maxLength) return false;
        return true;
    }

    static range(value: number, min?: number, max?: number): boolean {
        if (value === null || value === undefined) return true; // Allow empty unless required
        const num = Number(value);
        if (isNaN(num)) return false;
        if (min !== undefined && num < min) return false;
        if (max !== undefined && num > max) return false;
        return true;
    }

    static pattern(value: string, pattern: RegExp): boolean {
        if (!value) return true; // Allow empty unless required
        return pattern.test(value);
    }
}

// Form Validation Manager
export class FormValidationManager {
    private config: FormValidationConfig;
    private fieldValues: FormSubmissionData = {};
    private validationErrors: Record<string, ValidationError> = {};
    private isValidating: boolean = false;
    private validationTimeouts: Record<string, NodeJS.Timeout> = {};

    constructor(config: FormValidationConfig) {
        this.config = config;
    }

    // Field value management
    setFieldValue(fieldId: string, value: any): void {
        this.fieldValues[fieldId] = value;

        const fieldConfig = this.getFieldConfig(fieldId);
        if (fieldConfig?.validateOnChange) {
            this.validateField(fieldId);
        }
    }

    getFieldValue(fieldId: string): any {
        return this.fieldValues[fieldId];
    }

    getAllFieldValues(): FormSubmissionData {
        return { ...this.fieldValues };
    }

    // Validation methods
    async validateField(fieldId: string): Promise<ValidationError | null> {
        const fieldConfig = this.getFieldConfig(fieldId);
        if (!fieldConfig) return null;

        const value = this.fieldValues[fieldId];

        // Clear existing timeout for this field
        if (this.validationTimeouts[fieldId]) {
            clearTimeout(this.validationTimeouts[fieldId]);
        }

        // Debounce validation if configured
        if (fieldConfig.debounceMs && fieldConfig.debounceMs > 0) {
            return new Promise((resolve) => {
                this.validationTimeouts[fieldId] = setTimeout(async () => {
                    const error = await this.performFieldValidation(fieldId, value, fieldConfig);
                    resolve(error);
                }, fieldConfig.debounceMs);
            });
        }

        return this.performFieldValidation(fieldId, value, fieldConfig);
    }

    private async performFieldValidation(
        fieldId: string,
        value: any,
        fieldConfig: FieldValidationConfig
    ): Promise<ValidationError | null> {
        for (const rule of fieldConfig.rules) {
            const isValid = await this.validateRule(value, rule);

            if (!isValid) {
                const error: ValidationError = {
                    fieldId,
                    fieldName: fieldConfig.fieldName,
                    message: rule.message,
                    rule
                };

                this.validationErrors[fieldId] = error;
                return error;
            }
        }

        // Clear error if validation passes
        delete this.validationErrors[fieldId];
        return null;
    }

    private async validateRule(value: any, rule: ValidationRule): Promise<boolean> {
        switch (rule.type) {
            case 'required':
                return FormValidators.required(value);

            case 'email':
                return FormValidators.email(value);

            case 'numeric':
                return FormValidators.numeric(value);

            case 'length':
                return FormValidators.validateLength(value, rule.minLength, rule.maxLength);

            case 'range':
                return FormValidators.range(value, rule.min, rule.max);

            case 'pattern':
                return rule.pattern ? FormValidators.pattern(value, rule.pattern) : true;

            case 'custom':
                if (rule.validator) {
                    return await rule.validator(value);
                }
                return true;

            default:
                return true;
        }
    }

    async validateForm(): Promise<ValidationError[]> {
        this.isValidating = true;
        const errors: ValidationError[] = [];

        for (const fieldConfig of this.config.fields) {
            const error = await this.validateField(fieldConfig.fieldId);
            if (error) {
                errors.push(error);
            }
        }

        this.isValidating = false;
        return errors;
    }

    // Error management
    getFieldError(fieldId: string): ValidationError | null {
        return this.validationErrors[fieldId] || null;
    }

    getAllErrors(): ValidationError[] {
        return Object.values(this.validationErrors);
    }

    hasErrors(): boolean {
        return Object.keys(this.validationErrors).length > 0;
    }

    clearFieldError(fieldId: string): void {
        delete this.validationErrors[fieldId];
    }

    clearAllErrors(): void {
        this.validationErrors = {};
    }

    // Form submission
    async submitForm(
        onSubmit: (data: FormSubmissionData) => Promise<any>,
        options: {
            validateBeforeSubmit?: boolean;
            showLoadingState?: boolean;
        } = {}
    ): Promise<FormSubmissionResult> {
        const { validateBeforeSubmit = true, showLoadingState = true } = options;

        try {
            // Validate if requested
            if (validateBeforeSubmit) {
                const errors = await this.validateForm();
                if (errors.length > 0) {
                    return {
                        success: false,
                        errors,
                        data: this.getAllFieldValues()
                    };
                }
            }

            // Submit form data
            const formData = this.getAllFieldValues();
            const serverResponse = await onSubmit(formData);

            return {
                success: true,
                data: formData,
                serverResponse
            };

        } catch (error) {
            console.error('Form submission failed:', error);

            // Convert server errors to validation errors if needed
            const errors: ValidationError[] = [];
            if (error && typeof error === 'object' && 'validationErrors' in error) {
                // Handle server validation errors
                const serverErrors = error.validationErrors as Record<string, string>;
                Object.entries(serverErrors).forEach(([fieldId, message]) => {
                    errors.push({
                        fieldId,
                        fieldName: this.getFieldConfig(fieldId)?.fieldName || fieldId,
                        message: String(message),
                        rule: { type: 'custom', message: String(message) }
                    });
                });
            }

            return {
                success: false,
                errors: errors.length > 0 ? errors : [{
                    fieldId: '_form',
                    fieldName: 'Form',
                    message: (error as Error)?.message || 'Submission failed',
                    rule: { type: 'custom', message: 'Submission failed' }
                }],
                data: this.getAllFieldValues()
            };
        }
    }

    // Utility methods
    private getFieldConfig(fieldId: string): FieldValidationConfig | undefined {
        return this.config.fields.find(field => field.fieldId === fieldId);
    }

    isFormValid(): boolean {
        return !this.hasErrors();
    }

    getFormCompletionPercentage(): number {
        const totalFields = this.config.fields.length;
        if (totalFields === 0) return 100;

        const completedFields = this.config.fields.filter(field => {
            const value = this.fieldValues[field.fieldId];
            return FormValidators.required(value);
        }).length;

        return Math.round((completedFields / totalFields) * 100);
    }

    // Configuration updates
    updateConfig(config: Partial<FormValidationConfig>): void {
        this.config = { ...this.config, ...config };
    }

    addField(fieldConfig: FieldValidationConfig): void {
        const existingIndex = this.config.fields.findIndex(
            field => field.fieldId === fieldConfig.fieldId
        );

        if (existingIndex >= 0) {
            this.config.fields[existingIndex] = fieldConfig;
        } else {
            this.config.fields.push(fieldConfig);
        }
    }

    removeField(fieldId: string): void {
        this.config.fields = this.config.fields.filter(
            field => field.fieldId !== fieldId
        );
        delete this.fieldValues[fieldId];
        delete this.validationErrors[fieldId];
    }

    // Cleanup
    destroy(): void {
        // Clear all timeouts
        Object.values(this.validationTimeouts).forEach(timeout => {
            clearTimeout(timeout);
        });
        this.validationTimeouts = {};

        // Clear data
        this.fieldValues = {};
        this.validationErrors = {};
    }
}

// Pre-built validation configurations
export class ValidationPresets {
    static userRegistration(): FormValidationConfig {
        return {
            formName: 'UserRegistration',
            fields: [
                {
                    fieldId: 'email',
                    fieldName: 'Email',
                    rules: [
                        { type: 'required', message: 'Email is required' },
                        { type: 'email', message: 'Please enter a valid email address' }
                    ],
                    validateOnChange: true,
                    debounceMs: 500
                },
                {
                    fieldId: 'password',
                    fieldName: 'Password',
                    rules: [
                        { type: 'required', message: 'Password is required' },
                        { type: 'length', message: 'Password must be at least 8 characters', minLength: 8 }
                    ],
                    validateOnBlur: true
                },
                {
                    fieldId: 'confirmPassword',
                    fieldName: 'Confirm Password',
                    rules: [
                        { type: 'required', message: 'Please confirm your password' },
                        {
                            type: 'custom',
                            message: 'Passwords do not match',
                            validator: (value) => {
                                // This would need access to the form manager to compare with password field
                                return true; // Placeholder
                            }
                        }
                    ]
                }
            ],
            submitOnValid: true,
            showErrorsInline: true,
            preventNavigationOnErrors: true
        };
    }

    static contactForm(): FormValidationConfig {
        return {
            formName: 'ContactForm',
            fields: [
                {
                    fieldId: 'name',
                    fieldName: 'Name',
                    rules: [
                        { type: 'required', message: 'Name is required' },
                        { type: 'length', message: 'Name must be at least 2 characters', minLength: 2 }
                    ]
                },
                {
                    fieldId: 'email',
                    fieldName: 'Email',
                    rules: [
                        { type: 'required', message: 'Email is required' },
                        { type: 'email', message: 'Please enter a valid email address' }
                    ]
                },
                {
                    fieldId: 'message',
                    fieldName: 'Message',
                    rules: [
                        { type: 'required', message: 'Message is required' },
                        { type: 'length', message: 'Message must be at least 10 characters', minLength: 10 }
                    ]
                }
            ],
            showErrorsInline: true
        };
    }
} 