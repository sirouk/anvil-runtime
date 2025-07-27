import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../theme/theme-context';
import { AnvilLayoutProps } from './enhanced-layouts';

/**
 * Enhanced Form Components with Full Anvil Functionality
 * 
 * These components provide complete form functionality matching Anvil's behavior
 * including validation, Material Design styling, and proper event handling.
 */

// Common form component properties
export interface AnvilFormProps extends AnvilLayoutProps {
    enabled?: boolean;
    readOnly?: boolean;
    required?: boolean;
    error?: boolean;
    errorText?: string;
    tooltip?: string;
    tabIndex?: number;
}

// Helper to apply common form styles
const getFormStyles = (theme: any, role?: string, error?: boolean) => {
    const baseStyles: React.CSSProperties = {
        fontFamily: theme?.roles?.body?.fontFamily || "'Roboto', sans-serif",
        fontSize: theme?.roles?.body?.fontSize || '16px',
        ...(role && theme?.roles?.[role] ? theme.roles[role] : {})
    };

    if (error) {
        baseStyles.borderColor = theme?.colors?.error || '#f44336';
    }

    return baseStyles;
};

// Enhanced TextBox with validation and multiline support
export interface TextBoxProps extends AnvilFormProps {
    text?: string;
    value?: string; // Support both text and value props
    placeholder?: string;
    type?: 'text' | 'password' | 'email' | 'number' | 'tel' | 'url';
    multiline?: boolean;
    rows?: number;
    maxLength?: number;
    minLength?: number;
    pattern?: string;
    autoComplete?: string;
    autoFocus?: boolean;
    selectOnFocus?: boolean;
    onChange?: (value: string) => void;
    onPressedEnter?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    validate?: (value: string) => string | null;
}

export const TextBox: React.FC<TextBoxProps> = ({
    text = '',
    value,
    placeholder,
    type = 'text',
    multiline = false,
    rows = 3,
    maxLength,
    minLength,
    pattern,
    autoComplete,
    autoFocus,
    selectOnFocus,
    enabled = true,
    readOnly = false,
    required = false,
    error: externalError,
    errorText: externalErrorText,
    tooltip,
    tabIndex,
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    className = '',
    style,
    onChange,
    onPressedEnter,
    onFocus,
    onBlur,
    validate,
    ...props
}) => {
    const theme = useTheme();
    const [internalValue, setInternalValue] = useState(value ?? text);
    const [isFocused, setIsFocused] = useState(false);
    const [internalError, setInternalError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    // Update internal value when props change
    useEffect(() => {
        setInternalValue(value ?? text);
    }, [value, text]);

    if (!visible) return null;

    const error = externalError || !!internalError;
    const errorText = externalErrorText || internalError;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setInternalValue(newValue);

        // Clear internal error on change
        if (internalError) {
            setInternalError(null);
        }

        onChange?.(newValue);
    };

    const handleBlur = () => {
        setIsFocused(false);

        // Run validation on blur
        if (validate && internalValue) {
            const validationError = validate(internalValue);
            setInternalError(validationError);
        }

        // Check required
        if (required && !internalValue) {
            setInternalError('This field is required');
        }

        onBlur?.();
    };

    const handleFocus = () => {
        setIsFocused(true);

        if (selectOnFocus && inputRef.current) {
            inputRef.current.select();
        }

        onFocus?.();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline && onPressedEnter) {
            e.preventDefault();
            onPressedEnter();
        }
    };

    const formStyles = getFormStyles(theme, role, error);

    const inputStyle: React.CSSProperties = {
        width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        margin: margin ? (typeof margin === 'number' ? `${margin}px` : margin) : undefined,
        padding: padding ? (typeof padding === 'number' ? `${padding}px` : padding) : '8px 12px',
        marginTop: spacingAbove ? theme?.spacing?.[spacingAbove] : undefined,
        marginBottom: spacingBelow ? theme?.spacing?.[spacingBelow] : undefined,
        border: `1px solid ${error ? theme?.colors?.error || '#f44336' : isFocused ? theme?.colors?.primary || '#1976d2' : '#ddd'}`,
        borderRadius: '4px',
        outline: 'none',
        transition: 'border-color 0.2s ease',
        opacity: enabled ? 1 : 0.6,
        cursor: enabled && !readOnly ? 'text' : 'not-allowed',
        backgroundColor: enabled && !readOnly ? '#fff' : '#f5f5f5',
        resize: multiline ? 'vertical' : undefined,
        minHeight: multiline && rows ? `${rows * 1.5}em` : undefined,
        ...formStyles,
        ...style
    };

    const containerClasses = [
        'anvil-textbox-container',
        role && `anvil-role-${role}`,
        error && 'anvil-error',
        className
    ].filter(Boolean).join(' ');

    const inputProps = {
        ref: inputRef,
        value: internalValue,
        placeholder,
        disabled: !enabled,
        readOnly,
        required,
        maxLength,
        minLength,
        pattern,
        autoComplete,
        autoFocus,
        tabIndex,
        title: tooltip,
        onChange: handleChange,
        onFocus: handleFocus,
        onBlur: handleBlur,
        onKeyDown: handleKeyDown,
        style: inputStyle,
        ...props
    };

    return (
        <div className={containerClasses}>
            {multiline ? (
                <textarea
                    {...inputProps}
                    rows={rows}
                    className="anvil-textbox anvil-textbox-multiline"
                />
            ) : (
                <input
                    {...inputProps}
                    type={type}
                    className="anvil-textbox"
                />
            )}
            {errorText && (
                <div className="anvil-error-text" style={{
                    color: theme?.colors?.error || '#f44336',
                    fontSize: '12px',
                    marginTop: '4px'
                }}>
                    {errorText}
                </div>
            )}
        </div>
    );
};

// TextArea component with auto-resize
export interface TextAreaProps extends TextBoxProps {
    autoResize?: boolean;
    minRows?: number;
    maxRows?: number;
}

export const TextArea: React.FC<TextAreaProps> = ({
    autoResize = true,
    minRows = 3,
    maxRows = 10,
    rows = minRows,
    ...props
}) => {
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const [dynamicRows, setDynamicRows] = useState(rows);

    const adjustHeight = useCallback(() => {
        const textArea = textAreaRef.current;
        if (!textArea || !autoResize) return;

        // Reset height to calculate scroll height
        textArea.style.height = 'auto';

        const lineHeight = parseInt(window.getComputedStyle(textArea).lineHeight);
        const paddingTop = parseInt(window.getComputedStyle(textArea).paddingTop);
        const paddingBottom = parseInt(window.getComputedStyle(textArea).paddingBottom);

        const scrollHeight = textArea.scrollHeight - paddingTop - paddingBottom;
        const newRows = Math.ceil(scrollHeight / lineHeight);

        setDynamicRows(Math.max(minRows, Math.min(maxRows, newRows)));
    }, [autoResize, minRows, maxRows]);

    useEffect(() => {
        adjustHeight();
    }, [props.text, props.value, adjustHeight]);

    const handleChange = (value: string) => {
        props.onChange?.(value);
        adjustHeight();
    };

    return (
        <TextBox
            {...props}
            multiline={true}
            rows={dynamicRows}
            onChange={handleChange}
        />
    );
};

// RadioButton component
export interface RadioButtonProps extends AnvilFormProps {
    text?: string;
    value?: string;
    checked?: boolean;
    defaultChecked?: boolean;
    groupName?: string;
    onChange?: (checked: boolean) => void;
    onClick?: () => void;
}

export const RadioButton: React.FC<RadioButtonProps> = ({
    text,
    value,
    checked,
    defaultChecked,
    groupName,
    enabled = true,
    readOnly = false,
    required = false,
    error,
    errorText,
    tooltip,
    tabIndex,
    width,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    className = '',
    style,
    onChange,
    onClick,
    ...props
}) => {
    const theme = useTheme();
    const [isChecked, setIsChecked] = useState(checked ?? defaultChecked ?? false);

    useEffect(() => {
        if (checked !== undefined) {
            setIsChecked(checked);
        }
    }, [checked]);

    if (!visible) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newChecked = e.target.checked;

        if (checked === undefined) {
            // Uncontrolled mode
            setIsChecked(newChecked);
        }

        onChange?.(newChecked);
    };

    const handleClick = () => {
        if (enabled && !readOnly) {
            onClick?.();
        }
    };

    const formStyles = getFormStyles(theme, role, error);

    const containerStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        margin: margin ? (typeof margin === 'number' ? `${margin}px` : margin) : undefined,
        padding: padding ? (typeof padding === 'number' ? `${padding}px` : padding) : undefined,
        marginTop: spacingAbove ? theme?.spacing?.[spacingAbove] : undefined,
        marginBottom: spacingBelow ? theme?.spacing?.[spacingBelow] : undefined,
        opacity: enabled ? 1 : 0.6,
        cursor: enabled && !readOnly ? 'pointer' : 'not-allowed',
        ...style
    };

    const radioStyle: React.CSSProperties = {
        marginRight: '8px',
        cursor: enabled && !readOnly ? 'pointer' : 'not-allowed'
    };

    const labelStyle: React.CSSProperties = {
        cursor: enabled && !readOnly ? 'pointer' : 'not-allowed',
        userSelect: 'none',
        ...formStyles
    };

    const containerClasses = [
        'anvil-radio-button',
        role && `anvil-role-${role}`,
        error && 'anvil-error',
        className
    ].filter(Boolean).join(' ');

    return (
        <label
            className={containerClasses}
            style={containerStyle}
            title={tooltip}
            onClick={handleClick}
        >
            <input
                type="radio"
                name={groupName}
                value={value}
                checked={isChecked}
                disabled={!enabled}
                readOnly={readOnly}
                required={required}
                tabIndex={tabIndex}
                onChange={handleChange}
                style={radioStyle}
                {...props}
            />
            {text && <span style={labelStyle}>{text}</span>}
            {errorText && error && (
                <span className="anvil-error-text" style={{
                    color: theme?.colors?.error || '#f44336',
                    fontSize: '12px',
                    marginLeft: '8px'
                }}>
                    {errorText}
                </span>
            )}
        </label>
    );
};

// DropDown component with data binding
export interface DropDownOption {
    value: string | number;
    label: string;
    disabled?: boolean;
}

export interface DropDownProps extends AnvilFormProps {
    items?: DropDownOption[] | string[];
    selectedValue?: string | number | null;
    placeholder?: string;
    includeBlank?: boolean;
    onChange?: (value: string | number | null) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export const DropDown: React.FC<DropDownProps> = ({
    items = [],
    selectedValue,
    placeholder = 'Select an option',
    includeBlank = true,
    enabled = true,
    readOnly = false,
    required = false,
    error,
    errorText,
    tooltip,
    tabIndex,
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    className = '',
    style,
    onChange,
    onFocus,
    onBlur,
    ...props
}) => {
    const theme = useTheme();
    const [internalValue, setInternalValue] = useState<string | number | null>(selectedValue ?? null);
    const [isFocused, setIsFocused] = useState(false);

    useEffect(() => {
        setInternalValue(selectedValue ?? null);
    }, [selectedValue]);

    if (!visible) return null;

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const typedValue = value === '' ? null :
            items.some(item => typeof item === 'object' && typeof item.value === 'number') ?
                Number(value) : value;

        setInternalValue(typedValue);
        onChange?.(typedValue);
    };

    const handleFocus = () => {
        setIsFocused(true);
        onFocus?.();
    };

    const handleBlur = () => {
        setIsFocused(false);
        onBlur?.();
    };

    const formStyles = getFormStyles(theme, role, error);

    const selectStyle: React.CSSProperties = {
        width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        margin: margin ? (typeof margin === 'number' ? `${margin}px` : margin) : undefined,
        padding: padding ? (typeof padding === 'number' ? `${padding}px` : padding) : '8px 12px',
        marginTop: spacingAbove ? theme?.spacing?.[spacingAbove] : undefined,
        marginBottom: spacingBelow ? theme?.spacing?.[spacingBelow] : undefined,
        border: `1px solid ${error ? theme?.colors?.error || '#f44336' : isFocused ? theme?.colors?.primary || '#1976d2' : '#ddd'}`,
        borderRadius: '4px',
        outline: 'none',
        transition: 'border-color 0.2s ease',
        opacity: enabled ? 1 : 0.6,
        cursor: enabled && !readOnly ? 'pointer' : 'not-allowed',
        backgroundColor: enabled && !readOnly ? '#fff' : '#f5f5f5',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23333' d='M10.293 3.293L6 7.586 1.707 3.293A1 1 0 00.293 4.707l5 5a1 1 0 001.414 0l5-5a1 1 0 10-1.414-1.414z'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 12px center',
        paddingRight: '36px',
        ...formStyles,
        ...style
    };

    const containerClasses = [
        'anvil-dropdown-container',
        role && `anvil-role-${role}`,
        error && 'anvil-error',
        className
    ].filter(Boolean).join(' ');

    // Normalize items to DropDownOption format (handle null/undefined)
    const safeItems = Array.isArray(items) ? items : [];
    const normalizedItems: DropDownOption[] = safeItems.map((item) => {
        if (typeof item === 'string') {
            return { value: item, label: item };
        }
        return item;
    });

    return (
        <div className={containerClasses}>
            <select
                className="anvil-dropdown"
                value={internalValue ?? ''}
                disabled={!enabled}
                readOnly={readOnly}
                required={required}
                tabIndex={tabIndex}
                title={tooltip}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                style={selectStyle}
                {...props}
            >
                {includeBlank && (
                    <option value="">{placeholder}</option>
                )}
                {normalizedItems.map((option, index) => (
                    <option
                        key={`${option.value}-${index}`}
                        value={option.value}
                        disabled={option.disabled}
                    >
                        {option.label}
                    </option>
                ))}
            </select>
            {errorText && error && (
                <div className="anvil-error-text" style={{
                    color: theme?.colors?.error || '#f44336',
                    fontSize: '12px',
                    marginTop: '4px'
                }}>
                    {errorText}
                </div>
            )}
        </div>
    );
};

// NumberBox component with formatting
export interface NumberBoxProps extends Omit<TextBoxProps, 'type' | 'onChange'> {
    value?: number | null;
    min?: number;
    max?: number;
    step?: number;
    decimalPlaces?: number;
    thousandsSeparator?: boolean;
    prefix?: string;
    suffix?: string;
    onChange?: (value: number | null) => void;
}

export const NumberBox: React.FC<NumberBoxProps> = ({
    value,
    min,
    max,
    step = 1,
    decimalPlaces,
    thousandsSeparator = false,
    prefix = '',
    suffix = '',
    placeholder,
    onChange,
    onBlur,
    validate,
    ...props
}) => {
    const [displayValue, setDisplayValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    // Format number for display
    const formatNumber = useCallback((num: number | null): string => {
        if (num === null || num === undefined || isNaN(num)) return '';

        let formatted = decimalPlaces !== undefined ?
            num.toFixed(decimalPlaces) : num.toString();

        if (thousandsSeparator) {
            const parts = formatted.split('.');
            parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
            formatted = parts.join('.');
        }

        return `${prefix}${formatted}${suffix}`;
    }, [decimalPlaces, thousandsSeparator, prefix, suffix]);

    // Parse display value to number
    const parseNumber = useCallback((str: string): number | null => {
        // Remove prefix, suffix, and thousand separators
        let cleaned = str;
        if (prefix) cleaned = cleaned.replace(new RegExp(`^${prefix}`), '');
        if (suffix) cleaned = cleaned.replace(new RegExp(`${suffix}$`), '');
        if (thousandsSeparator) cleaned = cleaned.replace(/,/g, '');

        const num = parseFloat(cleaned);
        return isNaN(num) ? null : num;
    }, [prefix, suffix, thousandsSeparator]);

    // Update display value when prop changes
    useEffect(() => {
        if (!isEditing) {
            setDisplayValue(formatNumber(value ?? null));
        }
    }, [value, formatNumber, isEditing]);

    const handleChange = (textValue: string) => {
        setDisplayValue(textValue);

        // Try to parse the number while typing
        const num = parseNumber(textValue);
        if (num !== null) {
            onChange?.(num);
        }
    };

    const handleFocus = () => {
        setIsEditing(true);
        // Show raw number when editing
        if (value !== null && value !== undefined) {
            setDisplayValue(value.toString());
        }
        props.onFocus?.();
    };

    const handleBlur = () => {
        setIsEditing(false);

        // Parse and validate the final value
        const num = parseNumber(displayValue);

        if (num !== null) {
            // Apply min/max constraints
            let constrained = num;
            if (min !== undefined) constrained = Math.max(min, constrained);
            if (max !== undefined) constrained = Math.min(max, constrained);

            onChange?.(constrained);
            setDisplayValue(formatNumber(constrained));
        } else {
            onChange?.(null);
            setDisplayValue('');
        }

        onBlur?.();
    };

    const numberValidate = (textValue: string): string | null => {
        const num = parseNumber(textValue);

        if (num === null && textValue.trim() !== '') {
            return 'Please enter a valid number';
        }

        if (num !== null) {
            if (min !== undefined && num < min) {
                return `Value must be at least ${min}`;
            }
            if (max !== undefined && num > max) {
                return `Value must be at most ${max}`;
            }
        }

        return validate ? validate(textValue) : null;
    };

    return (
        <TextBox
            {...props}
            type="text" // Use text to allow custom formatting
            value={displayValue}
            text={displayValue}
            placeholder={placeholder || (isEditing ? '' : formatNumber(0))}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            validate={numberValidate}
        />
    );
};

// DatePicker component (basic implementation - can be enhanced with a date picker library)
export interface DatePickerProps extends AnvilFormProps {
    date?: Date | string | null;
    format?: string;
    minDate?: Date | string;
    maxDate?: Date | string;
    placeholder?: string;
    onChange?: (date: Date | null) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

export const DatePicker: React.FC<DatePickerProps> = ({
    date,
    format = 'yyyy-MM-dd',
    minDate,
    maxDate,
    placeholder = 'Select a date',
    enabled = true,
    readOnly = false,
    required = false,
    error,
    errorText,
    tooltip,
    tabIndex,
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    className = '',
    style,
    onChange,
    onFocus,
    onBlur,
    ...props
}) => {
    const theme = useTheme();
    const [internalDate, setInternalDate] = useState<string>('');

    // Convert Date to string for input
    const dateToString = (d: Date | string | null): string => {
        if (!d) return '';
        const dateObj = typeof d === 'string' ? new Date(d) : d;
        if (isNaN(dateObj.getTime())) return '';
        return dateObj.toISOString().split('T')[0]; // YYYY-MM-DD format
    };

    // Convert string to Date
    const stringToDate = (s: string): Date | null => {
        if (!s) return null;
        const date = new Date(s);
        return isNaN(date.getTime()) ? null : date;
    };

    useEffect(() => {
        setInternalDate(dateToString(date ?? null));
    }, [date]);

    if (!visible) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInternalDate(value);
        onChange?.(stringToDate(value));
    };

    const formStyles = getFormStyles(theme, role, error);

    const inputStyle: React.CSSProperties = {
        width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        margin: margin ? (typeof margin === 'number' ? `${margin}px` : margin) : undefined,
        padding: padding ? (typeof padding === 'number' ? `${padding}px` : padding) : '8px 12px',
        marginTop: spacingAbove ? theme?.spacing?.[spacingAbove] : undefined,
        marginBottom: spacingBelow ? theme?.spacing?.[spacingBelow] : undefined,
        border: `1px solid ${error ? theme?.colors?.error || '#f44336' : '#ddd'}`,
        borderRadius: '4px',
        outline: 'none',
        transition: 'border-color 0.2s ease',
        opacity: enabled ? 1 : 0.6,
        cursor: enabled && !readOnly ? 'text' : 'not-allowed',
        backgroundColor: enabled && !readOnly ? '#fff' : '#f5f5f5',
        ...formStyles,
        ...style
    };

    const containerClasses = [
        'anvil-datepicker-container',
        role && `anvil-role-${role}`,
        error && 'anvil-error',
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={containerClasses}>
            <input
                type="date"
                className="anvil-datepicker"
                value={internalDate}
                min={dateToString(minDate ?? null)}
                max={dateToString(maxDate ?? null)}
                placeholder={placeholder}
                disabled={!enabled}
                readOnly={readOnly}
                required={required}
                tabIndex={tabIndex}
                title={tooltip}
                onChange={handleChange}
                onFocus={onFocus}
                onBlur={onBlur}
                style={inputStyle}
                {...props}
            />
            {errorText && error && (
                <div className="anvil-error-text" style={{
                    color: theme?.colors?.error || '#f44336',
                    fontSize: '12px',
                    marginTop: '4px'
                }}>
                    {errorText}
                </div>
            )}
        </div>
    );
}; 