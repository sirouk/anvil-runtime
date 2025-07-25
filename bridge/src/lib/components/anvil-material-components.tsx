import * as React from 'react';
import {
    TextField,
    Button as MuiButton,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Checkbox as MuiCheckbox,
    FormControlLabel,
    RadioGroup,
    Radio as MuiRadio,
    TextareaAutosize,
    Paper,
    Box,
    Typography,
    FormHelperText
} from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { createAnvilTheme } from '../theme/anvil-material-theme';

/**
 * Anvil Material Design Components
 * 
 * These components match the exact appearance and behavior of native Anvil
 * Material Design components, using Material UI as the implementation.
 */

const anvilTheme = createAnvilTheme();

// Common component props that match Anvil's API
export interface AnvilComponentProps {
    visible?: boolean;
    enabled?: boolean;
    spacing_above?: 'small' | 'medium' | 'large' | 'none';
    spacing_below?: 'small' | 'medium' | 'large' | 'none';
    role?: string;
    width?: string | number;
    tag?: any;  // User data
}

// Anvil TextBox component with Material Design styling
export interface AnvilTextBoxProps extends AnvilComponentProps {
    text?: string;
    placeholder?: string;
    type?: 'text' | 'password' | 'email' | 'number';
    multiline?: boolean;
    hide_text?: boolean;
    format?: string;
    change?: (args: { sender: any }) => void;
    pressed_enter?: (args: { sender: any }) => void;
    focus?: (args: { sender: any }) => void;
    lost_focus?: (args: { sender: any }) => void;
}

export const AnvilTextBox: React.FC<AnvilTextBoxProps> = ({
    text = '',
    placeholder = '',
    type = 'text',
    multiline = false,
    hide_text = false,
    visible = true,
    enabled = true,
    width,
    change,
    pressed_enter,
    focus,
    lost_focus,
    ...props
}) => {
    const [value, setValue] = React.useState(text);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        setValue(newValue);
        if (change) {
            change({ sender: { text: newValue, ...props } });
        }
    };

    const handleKeyPress = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && !multiline && pressed_enter) {
            pressed_enter({ sender: { text: value, ...props } });
        }
    };

    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <TextField
                value={value}
                onChange={handleChange}
                onKeyPress={handleKeyPress}
                onFocus={() => focus && focus({ sender: { text: value, ...props } })}
                onBlur={() => lost_focus && lost_focus({ sender: { text: value, ...props } })}
                placeholder={placeholder}
                type={hide_text ? 'password' : type}
                multiline={multiline}
                disabled={!enabled}
                fullWidth
                variant="outlined"
                size="medium"
                sx={{
                    width: typeof width === 'number' ? `${width}px` : width,
                    mb: 2
                }}
            />
        </ThemeProvider>
    );
};

// Anvil Button component with Material Design styling
export interface AnvilButtonProps extends AnvilComponentProps {
    text?: string;
    icon?: string;
    background?: string;
    foreground?: string;
    border?: string;
    click?: (args: { sender: any }) => void;
}

export const AnvilButton: React.FC<AnvilButtonProps> = ({
    text = 'Button',
    visible = true,
    enabled = true,
    background,
    foreground,
    width,
    click,
    ...props
}) => {
    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <MuiButton
                onClick={() => click && click({ sender: { text, ...props } })}
                disabled={!enabled}
                variant="contained"
                sx={{
                    width: typeof width === 'number' ? `${width}px` : width,
                    backgroundColor: background,
                    color: foreground,
                    mb: 2
                }}
            >
                {text}
            </MuiButton>
        </ThemeProvider>
    );
};

// Anvil DropDown component with Material Design styling
export interface AnvilDropDownProps extends AnvilComponentProps {
    items?: Array<{ value: any; label: string }> | string[];
    selected_value?: any;
    placeholder?: string;
    include_placeholder?: boolean;
    change?: (args: { sender: any }) => void;
}

export const AnvilDropDown: React.FC<AnvilDropDownProps> = ({
    items = [],
    selected_value,
    placeholder = 'Select...',
    include_placeholder = true,
    visible = true,
    enabled = true,
    width,
    change,
    ...props
}) => {
    const [value, setValue] = React.useState(selected_value || '');

    const handleChange = (event: any) => {
        const newValue = event.target.value;
        setValue(newValue);
        if (change) {
            change({ sender: { selected_value: newValue, ...props } });
        }
    };

    if (!visible) return null;

    // Normalize items to objects with value and label
    const normalizedItems = items.map(item =>
        typeof item === 'string' ? { value: item, label: item } : item
    );

    return (
        <ThemeProvider theme={anvilTheme}>
            <FormControl fullWidth variant="outlined" sx={{ mb: 2 }}>
                <InputLabel>{placeholder}</InputLabel>
                <Select
                    value={value}
                    onChange={handleChange}
                    label={placeholder}
                    disabled={!enabled}
                    sx={{
                        width: typeof width === 'number' ? `${width}px` : width,
                    }}
                >
                    {include_placeholder && (
                        <MenuItem value="">
                            <em>{placeholder}</em>
                        </MenuItem>
                    )}
                    {normalizedItems.map((item, index) => (
                        <MenuItem key={index} value={item.value}>
                            {item.label}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </ThemeProvider>
    );
};

// Anvil CheckBox component with Material Design styling
export interface AnvilCheckBoxProps extends AnvilComponentProps {
    text?: string;
    checked?: boolean;
    allow_indeterminate?: boolean;
    change?: (args: { sender: any }) => void;
}

export const AnvilCheckBox: React.FC<AnvilCheckBoxProps> = ({
    text = '',
    checked = false,
    visible = true,
    enabled = true,
    change,
    ...props
}) => {
    const [isChecked, setIsChecked] = React.useState(checked);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newChecked = event.target.checked;
        setIsChecked(newChecked);
        if (change) {
            change({ sender: { checked: newChecked, ...props } });
        }
    };

    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <FormControlLabel
                control={
                    <MuiCheckbox
                        checked={isChecked}
                        onChange={handleChange}
                        disabled={!enabled}
                    />
                }
                label={text}
                sx={{ mb: 1 }}
            />
        </ThemeProvider>
    );
};

// Anvil RadioButton component with Material Design styling
export interface AnvilRadioButtonProps extends AnvilComponentProps {
    text?: string;
    value?: any;
    group_name?: string;
    selected?: boolean;
    change?: (args: { sender: any }) => void;
}

export const AnvilRadioButton: React.FC<AnvilRadioButtonProps> = ({
    text = '',
    value,
    selected = false,
    visible = true,
    enabled = true,
    change,
    ...props
}) => {
    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <FormControlLabel
                control={
                    <MuiRadio
                        checked={selected}
                        onChange={() => change && change({ sender: { value, selected: true, ...props } })}
                        disabled={!enabled}
                        value={value}
                    />
                }
                label={text}
                sx={{ mb: 1 }}
            />
        </ThemeProvider>
    );
};

// Anvil TextArea component with Material Design styling
export interface AnvilTextAreaProps extends AnvilComponentProps {
    text?: string;
    placeholder?: string;
    rows?: number;
    auto_expand?: boolean;
    change?: (args: { sender: any }) => void;
}

export const AnvilTextArea: React.FC<AnvilTextAreaProps> = ({
    text = '',
    placeholder = '',
    rows = 4,
    visible = true,
    enabled = true,
    width,
    change,
    ...props
}) => {
    const [value, setValue] = React.useState(text);

    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = event.target.value;
        setValue(newValue);
        if (change) {
            change({ sender: { text: newValue, ...props } });
        }
    };

    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <TextField
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                multiline
                rows={rows}
                disabled={!enabled}
                fullWidth
                variant="outlined"
                sx={{
                    width: typeof width === 'number' ? `${width}px` : width,
                    mb: 2
                }}
            />
        </ThemeProvider>
    );
};

// Anvil NumberBox component with Material Design styling
export interface AnvilNumberBoxProps extends AnvilComponentProps {
    text?: number | string;
    placeholder?: string;
    format?: string;
    change?: (args: { sender: any }) => void;
}

export const AnvilNumberBox: React.FC<AnvilNumberBoxProps> = ({
    text = '',
    placeholder = '',
    visible = true,
    enabled = true,
    width,
    change,
    ...props
}) => {
    const [value, setValue] = React.useState(text);

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        setValue(newValue);
        if (change) {
            change({ sender: { text: parseFloat(newValue) || 0, ...props } });
        }
    };

    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <TextField
                value={value}
                onChange={handleChange}
                placeholder={placeholder}
                type="number"
                disabled={!enabled}
                fullWidth
                variant="outlined"
                sx={{
                    width: typeof width === 'number' ? `${width}px` : width,
                    mb: 2
                }}
            />
        </ThemeProvider>
    );
};

// Anvil DatePicker component with Material Design styling
export interface AnvilDatePickerProps extends AnvilComponentProps {
    date?: Date | string;
    format?: string;
    min_date?: Date;
    max_date?: Date;
    change?: (args: { sender: any }) => void;
}

export const AnvilDatePicker: React.FC<AnvilDatePickerProps> = ({
    date,
    visible = true,
    enabled = true,
    width,
    change,
    ...props
}) => {
    const [value, setValue] = React.useState(
        date instanceof Date ? date.toISOString().split('T')[0] : date || ''
    );

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = event.target.value;
        setValue(newValue);
        if (change) {
            change({ sender: { date: new Date(newValue), ...props } });
        }
    };

    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <TextField
                value={value}
                onChange={handleChange}
                type="date"
                disabled={!enabled}
                fullWidth
                variant="outlined"
                InputLabelProps={{
                    shrink: true,
                }}
                sx={{
                    width: typeof width === 'number' ? `${width}px` : width,
                    mb: 2
                }}
            />
        </ThemeProvider>
    );
};

// Anvil Card/Panel component with Material Design styling
export interface AnvilCardProps extends AnvilComponentProps {
    col_background?: string;
    border?: string;
    children?: React.ReactNode;
}

export const AnvilCard: React.FC<AnvilCardProps> = ({
    visible = true,
    col_background,
    width,
    children,
    ...props
}) => {
    if (!visible) return null;

    return (
        <ThemeProvider theme={anvilTheme}>
            <Paper
                elevation={1}
                sx={{
                    p: 3,
                    mb: 2,
                    width: typeof width === 'number' ? `${width}px` : width,
                    backgroundColor: col_background
                }}
            >
                {children}
            </Paper>
        </ThemeProvider>
    );
};

// Export all components for easy use
export {
    AnvilTextBox as TextBox,
    AnvilButton as Button,
    AnvilDropDown as DropDown,
    AnvilCheckBox as CheckBox,
    AnvilRadioButton as RadioButton,
    AnvilTextArea as TextArea,
    AnvilNumberBox as NumberBox,
    AnvilDatePicker as DatePicker,
    AnvilCard as Card
}; 