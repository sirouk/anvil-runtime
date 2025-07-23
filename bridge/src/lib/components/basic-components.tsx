import * as React from 'react';

/**
 * Container Components
 */

// HtmlPanel - Basic container with HTML content
export interface HtmlPanelProps {
    html?: string;
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
}

export const HtmlPanel: React.FC<HtmlPanelProps> = ({
    html,
    children,
    className = '',
    style,
    ...props
}) => {
    const classes = `anvil-html-panel ${className}`.trim();

    if (html) {
        return (
            <div
                className={classes}
                style={style}
                dangerouslySetInnerHTML={{ __html: html }}
                {...props}
            />
        );
    }

    return (
        <div className={classes} style={style} {...props}>
            {children}
        </div>
    );
};

// GridPanel - CSS Grid layout container
export interface GridPanelProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    columns?: number | string;
    rows?: number | string;
    gap?: string | number;
    [key: string]: any;
}

export const GridPanel: React.FC<GridPanelProps> = ({
    children,
    className = '',
    style,
    columns = 1,
    rows,
    gap = '8px',
    ...props
}) => {
    const classes = `anvil-grid-panel ${className}`.trim();

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: typeof columns === 'number' ? `repeat(${columns}, 1fr)` : columns,
        gap: typeof gap === 'number' ? `${gap}px` : gap,
        ...style
    };

    if (rows) {
        gridStyle.gridTemplateRows = typeof rows === 'number' ? `repeat(${rows}, auto)` : rows;
    }

    return (
        <div className={classes} style={gridStyle} {...props}>
            {children}
        </div>
    );
};

// ColumnPanel - Vertical layout container
export interface ColumnPanelProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    spacing?: string | number;
    align?: 'left' | 'center' | 'right' | 'stretch';
    [key: string]: any;
}

export const ColumnPanel: React.FC<ColumnPanelProps> = ({
    children,
    className = '',
    style,
    spacing = '8px',
    align = 'stretch',
    ...props
}) => {
    const classes = `anvil-column-panel ${className}`.trim();

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: typeof spacing === 'number' ? `${spacing}px` : spacing,
        alignItems: align === 'left' ? 'flex-start' :
            align === 'right' ? 'flex-end' :
                align === 'center' ? 'center' : 'stretch',
        ...style
    };

    return (
        <div className={classes} style={containerStyle} {...props}>
            {children}
        </div>
    );
};

// FlowPanel - Flexible layout container
export interface FlowPanelProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    direction?: 'row' | 'column';
    wrap?: boolean;
    spacing?: string | number;
    align?: string;
    justify?: string;
    [key: string]: any;
}

export const FlowPanel: React.FC<FlowPanelProps> = ({
    children,
    className = '',
    style,
    direction = 'row',
    wrap = true,
    spacing = '8px',
    align = 'flex-start',
    justify = 'flex-start',
    ...props
}) => {
    const classes = `anvil-flow-panel ${className}`.trim();

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: direction,
        flexWrap: wrap ? 'wrap' : 'nowrap',
        gap: typeof spacing === 'number' ? `${spacing}px` : spacing,
        alignItems: align,
        justifyContent: justify,
        ...style
    };

    return (
        <div className={classes} style={containerStyle} {...props}>
            {children}
        </div>
    );
};

/**
 * Form Components
 */

// Label - Text display component
export interface LabelProps {
    text?: string;
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    fontSize?: string | number;
    fontWeight?: string | number;
    color?: string;
    align?: 'left' | 'center' | 'right';
    [key: string]: any;
}

export const Label: React.FC<LabelProps> = ({
    text,
    children,
    className = '',
    style,
    fontSize,
    fontWeight,
    color,
    align = 'left',
    ...props
}) => {
    const classes = `anvil-label ${className}`.trim();

    const labelStyle: React.CSSProperties = {
        textAlign: align,
        ...style
    };

    if (fontSize) {
        labelStyle.fontSize = typeof fontSize === 'number' ? `${fontSize}px` : fontSize;
    }
    if (fontWeight) {
        labelStyle.fontWeight = fontWeight;
    }
    if (color) {
        labelStyle.color = color;
    }

    return (
        <span className={classes} style={labelStyle} {...props}>
            {text || children}
        </span>
    );
};

// TextBox - Text input component
export interface TextBoxProps {
    text?: string;
    placeholder?: string;
    multiline?: boolean;
    enabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onChange?: (value: string) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    [key: string]: any;
}

export const TextBox: React.FC<TextBoxProps> = ({
    text = '',
    placeholder,
    multiline = false,
    enabled = true,
    className = '',
    style,
    onChange,
    onFocus,
    onBlur,
    ...props
}) => {
    const [value, setValue] = React.useState(text);
    const classes = `anvil-text-box ${className}`.trim();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setValue(e.target.value);
        if (onChange) {
            onChange(e.target.value);
        }
    };

    const inputStyle: React.CSSProperties = {
        width: '100%',
        padding: '8px 12px',
        border: '1px solid #ccc',
        borderRadius: '4px',
        fontSize: '14px',
        fontFamily: 'inherit',
        backgroundColor: enabled ? '#fff' : '#f5f5f5',
        color: enabled ? '#333' : '#999',
        ...style
    };

    const commonProps = {
        className: classes,
        style: inputStyle,
        value: value,
        placeholder: placeholder,
        disabled: !enabled,
        onChange: handleChange,
        onFocus: onFocus,
        onBlur: onBlur,
        ...props
    };

    if (multiline) {
        return (
            <textarea
                {...commonProps}
                rows={4}
            />
        );
    }

    return (
        <input
            type="text"
            {...commonProps}
        />
    );
};

// Button - Button component
export interface ButtonProps {
    text?: string;
    children?: React.ReactNode;
    enabled?: boolean;
    role?: 'primary' | 'secondary' | 'outlined' | 'text';
    className?: string;
    style?: React.CSSProperties;
    onClick?: () => void;
    [key: string]: any;
}

export const Button: React.FC<ButtonProps> = ({
    text,
    children,
    enabled = true,
    role = 'primary',
    className = '',
    style,
    onClick,
    ...props
}) => {
    const classes = `anvil-button anvil-button-${role} ${className}`.trim();

    const buttonStyle: React.CSSProperties = {
        padding: '8px 16px',
        border: role === 'outlined' ? '1px solid #6750A4' : 'none',
        borderRadius: '4px',
        fontSize: '14px',
        fontWeight: 500,
        cursor: enabled ? 'pointer' : 'not-allowed',
        transition: 'background-color 0.2s ease',
        backgroundColor:
            role === 'primary' ? '#6750A4' :
                role === 'secondary' ? '#E8DEF8' :
                    role === 'outlined' ? 'transparent' :
                        'transparent',
        color:
            role === 'primary' ? '#FFFFFF' :
                role === 'secondary' ? '#1C1B1F' :
                    role === 'outlined' ? '#6750A4' :
                        '#6750A4',
        opacity: enabled ? 1 : 0.6,
        ...style
    };

    return (
        <button
            className={classes}
            style={buttonStyle}
            disabled={!enabled}
            onClick={onClick}
            {...props}
        >
            {text || children}
        </button>
    );
};

// CheckBox - Checkbox component
export interface CheckBoxProps {
    checked?: boolean;
    text?: string;
    enabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    onChange?: (checked: boolean) => void;
    [key: string]: any;
}

export const CheckBox: React.FC<CheckBoxProps> = ({
    checked = false,
    text,
    enabled = true,
    className = '',
    style,
    onChange,
    ...props
}) => {
    const [isChecked, setIsChecked] = React.useState(checked);
    const classes = `anvil-checkbox ${className}`.trim();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setIsChecked(e.target.checked);
        if (onChange) {
            onChange(e.target.checked);
        }
    };

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        ...style
    };

    const checkboxStyle: React.CSSProperties = {
        width: '18px',
        height: '18px',
        cursor: enabled ? 'pointer' : 'not-allowed'
    };

    return (
        <label className={classes} style={containerStyle}>
            <input
                type="checkbox"
                checked={isChecked}
                disabled={!enabled}
                onChange={handleChange}
                style={checkboxStyle}
                {...props}
            />
            {text && <span>{text}</span>}
        </label>
    );
};

/**
 * Data Components
 */

// RepeatingPanel - Container for repeating items
export interface RepeatingPanelProps {
    items?: any[];
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    itemTemplate?: (item: any, index: number) => React.ReactElement;
    [key: string]: any;
}

export const RepeatingPanel: React.FC<RepeatingPanelProps> = ({
    items = [],
    children,
    className = '',
    style,
    itemTemplate,
    ...props
}) => {
    const classes = `anvil-repeating-panel ${className}`.trim();

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        ...style
    };

    return (
        <div className={classes} style={containerStyle} {...props}>
            {items.map((item, index) => {
                if (itemTemplate) {
                    return itemTemplate(item, index);
                }
                return (
                    <div key={index} className="anvil-repeating-panel-item">
                        {children}
                    </div>
                );
            })}
        </div>
    );
};

// DataRowPanel - Single data row container
export interface DataRowPanelProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    selected?: boolean;
    onClick?: () => void;
    [key: string]: any;
}

export const DataRowPanel: React.FC<DataRowPanelProps> = ({
    children,
    className = '',
    style,
    selected = false,
    onClick,
    ...props
}) => {
    const classes = `anvil-data-row-panel ${selected ? 'selected' : ''} ${className}`.trim();

    const rowStyle: React.CSSProperties = {
        display: 'flex',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: '1px solid #e0e0e0',
        cursor: onClick ? 'pointer' : 'default',
        backgroundColor: selected ? '#e3f2fd' : 'transparent',
        transition: 'background-color 0.2s ease',
        ...style
    };

    return (
        <div className={classes} style={rowStyle} onClick={onClick} {...props}>
            {children}
        </div>
    );
}; 