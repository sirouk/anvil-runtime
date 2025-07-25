import * as React from 'react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../theme/theme-context';
import { AnvilLayoutProps } from './enhanced-layouts';
import { AnvilFormProps } from './enhanced-forms';

/**
 * Enhanced Interactive and Navigation Components
 * 
 * These components provide interactive functionality matching Anvil's behavior
 * including navigation, data display, timing, and user notifications.
 */

// Enhanced Button with loading states, variants, and advanced Material Design styling
export interface EnhancedButtonProps extends AnvilLayoutProps {
    text?: string;
    icon?: string;
    iconAlign?: 'left' | 'right';
    role?: 'primary-color' | 'secondary-color' | 'raised' | 'filled' | 'outlined' | 'filled-button' | 'outlined-button';
    variant?: 'contained' | 'outlined' | 'text';
    size?: 'small' | 'medium' | 'large';
    loading?: boolean;
    loadingText?: string;
    enabled?: boolean;
    disabled?: boolean;
    tooltip?: string;
    tabIndex?: number;
    className?: string;
    style?: React.CSSProperties;
    onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onFocus?: () => void;
    onBlur?: () => void;
    onHover?: () => void;
}

export const Button: React.FC<EnhancedButtonProps> = ({
    text,
    icon,
    iconAlign = 'left',
    role = 'primary-color',
    variant = 'contained',
    size = 'medium',
    loading = false,
    loadingText = 'Loading...',
    enabled = true,
    disabled = false,
    tooltip,
    tabIndex,
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    className = '',
    style,
    onClick,
    onFocus,
    onBlur,
    onHover,
    ...props
}) => {
    const theme = useTheme();
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [isPressed, setIsPressed] = useState(false);

    if (!visible) return null;

    const isDisabled = !enabled || disabled || loading;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        if (!isDisabled) {
            onClick?.(e);
        }
    };

    const handleFocus = () => {
        setIsFocused(true);
        onFocus?.();
    };

    const handleBlur = () => {
        setIsFocused(false);
        onBlur?.();
    };

    const handleMouseEnter = () => {
        setIsHovered(true);
        onHover?.();
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    const handleMouseDown = () => {
        setIsPressed(true);
    };

    const handleMouseUp = () => {
        setIsPressed(false);
    };

    // Get theme colors based on role
    const getButtonColors = () => {
        const themeColors = theme?.colors || {} as any;

        switch (role) {
            case 'primary-color':
            case 'filled':
            case 'filled-button':
                return {
                    background: themeColors.primary || '#1976d2',
                    color: '#ffffff',
                    borderColor: themeColors.primary || '#1976d2'
                };
            case 'secondary-color':
                return {
                    background: themeColors.secondary || '#dc004e',
                    color: '#ffffff',
                    borderColor: themeColors.secondary || '#dc004e'
                };
            case 'outlined':
            case 'outlined-button':
                return {
                    background: 'transparent',
                    color: themeColors.primary || '#1976d2',
                    borderColor: themeColors.primary || '#1976d2'
                };
            case 'raised':
                return {
                    background: '#f5f5f5',
                    color: '#333333',
                    borderColor: '#cccccc'
                };
            default:
                return {
                    background: themeColors.primary || '#1976d2',
                    color: '#ffffff',
                    borderColor: themeColors.primary || '#1976d2'
                };
        }
    };

    const getSizeStyles = () => {
        switch (size) {
            case 'small':
                return {
                    padding: '6px 12px',
                    fontSize: '12px',
                    minHeight: '28px'
                };
            case 'large':
                return {
                    padding: '12px 24px',
                    fontSize: '16px',
                    minHeight: '48px'
                };
            default: // medium
                return {
                    padding: '8px 16px',
                    fontSize: '14px',
                    minHeight: '36px'
                };
        }
    };

    const colors = getButtonColors();
    const sizeStyles = getSizeStyles();

    const buttonStyle: React.CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: icon ? '8px' : 0,
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        margin: margin ? (typeof margin === 'number' ? `${margin}px` : margin) : undefined,
        marginTop: spacingAbove ? theme?.spacing?.[spacingAbove] : undefined,
        marginBottom: spacingBelow ? theme?.spacing?.[spacingBelow] : undefined,
        fontFamily: theme?.roles?.button?.fontFamily || "'Roboto', sans-serif",
        fontWeight: theme?.roles?.button?.fontWeight || 500,
        textTransform: 'none',
        textDecoration: 'none',
        border: variant === 'outlined' || role === 'outlined' || role === 'outlined-button' ?
            `1px solid ${colors.borderColor}` : 'none',
        borderRadius: '4px',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        transition: 'all 0.2s ease-in-out',
        boxShadow: (variant === 'contained' || role === 'raised') && !isDisabled ?
            (isPressed ? '0 1px 2px rgba(0,0,0,0.2)' :
                isHovered ? '0 2px 8px rgba(0,0,0,0.15)' :
                    '0 1px 3px rgba(0,0,0,0.12)') : 'none',
        backgroundColor: variant === 'text' ? 'transparent' : colors.background,
        color: colors.color,
        opacity: isDisabled ? 0.6 : 1,
        transform: isPressed && !isDisabled ? 'scale(0.98)' : 'scale(1)',
        ...sizeStyles,
        ...style
    };

    // Hover effects
    if (isHovered && !isDisabled) {
        if (variant === 'text') {
            buttonStyle.backgroundColor = `${colors.color}08`; // 8% opacity
        } else if (variant === 'outlined' || role === 'outlined' || role === 'outlined-button') {
            buttonStyle.backgroundColor = `${colors.color}08`;
        } else {
            // Darken the background slightly
            const darkenFactor = 0.1;
            buttonStyle.filter = `brightness(${1 - darkenFactor})`;
        }
    }

    // Focus ring
    if (isFocused) {
        buttonStyle.boxShadow = `${buttonStyle.boxShadow || 'none'}, 0 0 0 2px ${colors.color}40`;
    }

    const containerClasses = [
        'anvil-button',
        'anvil-enhanced-button',
        `anvil-button-${variant}`,
        `anvil-button-${role}`,
        `anvil-button-${size}`,
        loading && 'anvil-button-loading',
        isDisabled && 'anvil-button-disabled',
        className
    ].filter(Boolean).join(' ');

    const displayText = loading ? loadingText : text;

    return (
        <button
            className={containerClasses}
            style={buttonStyle}
            disabled={isDisabled}
            tabIndex={tabIndex}
            title={tooltip}
            onClick={handleClick}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            {...props}
        >
            {loading && (
                <span className="anvil-button-spinner" style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: `2px solid ${colors.color}`,
                    borderRadius: '50%',
                    animation: 'anvil-spin 1s linear infinite',
                    marginRight: displayText ? '8px' : 0
                }}>
                </span>
            )}

            {!loading && icon && iconAlign === 'left' && (
                <span className="anvil-button-icon anvil-button-icon-left">
                    {icon}
                </span>
            )}

            {displayText && (
                <span className="anvil-button-text">
                    {displayText}
                </span>
            )}

            {!loading && icon && iconAlign === 'right' && (
                <span className="anvil-button-icon anvil-button-icon-right">
                    {icon}
                </span>
            )}
        </button>
    );
};

// Link component with NextJS routing integration and anvil.open_form() compatibility
export interface LinkProps extends AnvilLayoutProps {
    text?: string;
    url?: string;
    target?: '_blank' | '_self' | '_parent' | '_top';
    formName?: string; // For Anvil form navigation
    navigate?: boolean; // Use NextJS routing
    role?: string;
    underline?: 'none' | 'hover' | 'always';
    className?: string;
    style?: React.CSSProperties;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    onNavigate?: (formName: string) => void;
}

export const Link: React.FC<LinkProps> = ({
    text,
    url,
    target = '_self',
    formName,
    navigate = false,
    role,
    underline = 'hover',
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    className = '',
    style,
    onClick,
    onNavigate,
    ...props
}) => {
    const theme = useTheme();
    const [isHovered, setIsHovered] = useState(false);

    if (!visible) return null;

    const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Handle Anvil form navigation
        if (formName && onNavigate) {
            e.preventDefault();
            onNavigate(formName);
            return;
        }

        // Handle NextJS navigation
        if (navigate && url) {
            e.preventDefault();
            // In a real implementation, you'd use Next.js router here
            // router.push(url);
            console.log('Navigate to:', url);
        }

        onClick?.(e);
    };

    const linkStyle: React.CSSProperties = {
        display: 'inline-block',
        width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        margin: margin ? (typeof margin === 'number' ? `${margin}px` : margin) : undefined,
        padding: padding ? (typeof padding === 'number' ? `${padding}px` : padding) : undefined,
        marginTop: spacingAbove ? theme?.spacing?.[spacingAbove] : undefined,
        marginBottom: spacingBelow ? theme?.spacing?.[spacingBelow] : undefined,
        color: theme?.colors?.primary || '#1976d2',
        textDecoration: underline === 'always' ? 'underline' :
            underline === 'hover' && isHovered ? 'underline' : 'none',
        cursor: 'pointer',
        transition: 'color 0.2s ease, text-decoration 0.2s ease',
        fontFamily: theme?.roles?.body?.fontFamily || "'Roboto', sans-serif",
        fontSize: theme?.roles?.body?.fontSize || '14px',
        ...(role && theme?.roles?.[role] ? theme.roles[role] : {}),
        ...style
    };

    const containerClasses = [
        'anvil-link',
        role && `anvil-role-${role}`,
        className
    ].filter(Boolean).join(' ');

    const href = formName ? `#${formName}` : url || '#';

    return (
        <a
            className={containerClasses}
            href={href}
            target={target}
            style={linkStyle}
            onClick={handleClick}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            {...props}
        >
            {text}
        </a>
    );
};

// Timer component with interval management and events
export interface TimerProps extends AnvilLayoutProps {
    interval?: number; // milliseconds
    enabled?: boolean;
    autoStart?: boolean;
    onTick?: () => void;
    onStart?: () => void;
    onStop?: () => void;
    onReset?: () => void;
}

export const Timer: React.FC<TimerProps> = ({
    interval = 1000,
    enabled = true,
    autoStart = false,
    visible = true,
    onTick,
    onStart,
    onStop,
    onReset,
    ...props
}) => {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (autoStart && enabled) {
            onStart?.();

            intervalRef.current = setInterval(() => {
                onTick?.();
            }, interval);
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [autoStart, enabled, interval, onTick, onStart]);

    if (!visible) return null;

    // Timer is invisible but functional
    return null;
};

// Notification/Alert component with Material Design styling
export interface NotificationProps extends AnvilLayoutProps {
    type?: 'info' | 'success' | 'warning' | 'error';
    title?: string;
    message?: string;
    dismissible?: boolean;
    autoHide?: boolean;
    duration?: number; // milliseconds
    position?: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
    className?: string;
    style?: React.CSSProperties;
    onDismiss?: () => void;
    onShow?: () => void;
    onHide?: () => void;
}

export const Notification: React.FC<NotificationProps> = ({
    type = 'info',
    title,
    message,
    dismissible = true,
    autoHide = false,
    duration = 5000,
    position = 'top-right',
    visible = true,
    className = '',
    style,
    onDismiss,
    onShow,
    onHide,
    ...props
}) => {
    const theme = useTheme();
    const [isShown, setIsShown] = useState(visible);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (visible && !isShown) {
            setIsShown(true);
            onShow?.();
        }
    }, [visible, isShown, onShow]);

    useEffect(() => {
        if (isShown && autoHide && duration > 0) {
            timeoutRef.current = setTimeout(() => {
                handleDismiss();
            }, duration);
        }

        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
        };
    }, [isShown, autoHide, duration]);

    const handleDismiss = () => {
        setIsShown(false);
        onHide?.();
        onDismiss?.();

        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
        }
    };

    if (!isShown) return null;

    const getNotificationColors = () => {
        switch (type) {
            case 'success':
                return {
                    background: '#4caf50',
                    color: '#ffffff',
                    icon: '✓'
                };
            case 'warning':
                return {
                    background: '#ff9800',
                    color: '#ffffff',
                    icon: '⚠'
                };
            case 'error':
                return {
                    background: '#f44336',
                    color: '#ffffff',
                    icon: '✕'
                };
            default: // info
                return {
                    background: '#2196f3',
                    color: '#ffffff',
                    icon: 'ℹ'
                };
        }
    };

    const getPositionStyles = (): React.CSSProperties => {
        const baseStyles: React.CSSProperties = {
            position: 'fixed',
            zIndex: 1000,
            maxWidth: '400px',
            minWidth: '250px'
        };

        switch (position) {
            case 'top-left':
                return { ...baseStyles, top: '20px', left: '20px' };
            case 'top-center':
                return { ...baseStyles, top: '20px', left: '50%', transform: 'translateX(-50%)' };
            case 'top-right':
                return { ...baseStyles, top: '20px', right: '20px' };
            case 'bottom-left':
                return { ...baseStyles, bottom: '20px', left: '20px' };
            case 'bottom-center':
                return { ...baseStyles, bottom: '20px', left: '50%', transform: 'translateX(-50%)' };
            case 'bottom-right':
                return { ...baseStyles, bottom: '20px', right: '20px' };
            default:
                return { ...baseStyles, top: '20px', right: '20px' };
        }
    };

    const colors = getNotificationColors();
    const positionStyles = getPositionStyles();

    const notificationStyle: React.CSSProperties = {
        ...positionStyles,
        backgroundColor: colors.background,
        color: colors.color,
        padding: '16px',
        borderRadius: '4px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        fontFamily: theme?.roles?.body?.fontFamily || "'Roboto', sans-serif",
        fontSize: theme?.roles?.body?.fontSize || '14px',
        animation: 'anvil-notification-slide-in 0.3s ease-out',
        ...style
    };

    const containerClasses = [
        'anvil-notification',
        `anvil-notification-${type}`,
        `anvil-notification-${position}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={containerClasses} style={notificationStyle} {...props}>
            <span className="anvil-notification-icon" style={{ fontSize: '16px' }}>
                {colors.icon}
            </span>

            <div className="anvil-notification-content" style={{ flex: 1 }}>
                {title && (
                    <div className="anvil-notification-title" style={{
                        fontWeight: 600,
                        marginBottom: message ? '4px' : 0
                    }}>
                        {title}
                    </div>
                )}

                {message && (
                    <div className="anvil-notification-message">
                        {message}
                    </div>
                )}
            </div>

            {dismissible && (
                <button
                    className="anvil-notification-close"
                    onClick={handleDismiss}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: colors.color,
                        cursor: 'pointer',
                        fontSize: '18px',
                        lineHeight: 1,
                        padding: '0',
                        opacity: 0.7,
                        transition: 'opacity 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                >
                    ×
                </button>
            )}
        </div>
    );
};

// Basic DataGrid component (placeholder for more advanced implementation)
export interface DataGridColumn {
    id: string;
    title: string;
    data_key: string;
    width?: number | string;
    sortable?: boolean;
    filterable?: boolean;
    format?: (value: any) => string;
}

export interface DataGridProps extends AnvilLayoutProps {
    columns?: DataGridColumn[];
    rows?: any[];
    selectedRows?: any[];
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    filterable?: boolean;
    paginated?: boolean;
    pageSize?: number;
    currentPage?: number;
    className?: string;
    style?: React.CSSProperties;
    onRowSelect?: (row: any, selected: boolean) => void;
    onSort?: (column: string, order: 'asc' | 'desc') => void;
    onFilter?: (filters: Record<string, string>) => void;
    onPageChange?: (page: number) => void;
}

export const DataGrid: React.FC<DataGridProps> = ({
    columns = [],
    rows = [],
    selectedRows = [],
    sortBy,
    sortOrder = 'asc',
    filterable = false,
    paginated = false,
    pageSize = 10,
    currentPage = 1,
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    className = '',
    style,
    onRowSelect,
    onSort,
    onFilter,
    onPageChange,
    ...props
}) => {
    const theme = useTheme();
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [localSortBy, setLocalSortBy] = useState(sortBy);
    const [localSortOrder, setLocalSortOrder] = useState(sortOrder);

    if (!visible) return null;

    const handleSort = (columnId: string) => {
        const newOrder = localSortBy === columnId && localSortOrder === 'asc' ? 'desc' : 'asc';
        setLocalSortBy(columnId);
        setLocalSortOrder(newOrder);
        onSort?.(columnId, newOrder);
    };

    const handleFilter = (columnId: string, value: string) => {
        const newFilters = { ...filters, [columnId]: value };
        setFilters(newFilters);
        onFilter?.(newFilters);
    };

    const isRowSelected = (row: any) => {
        return selectedRows.some(selectedRow => selectedRow === row);
    };

    const containerStyle: React.CSSProperties = {
        width: width ? (typeof width === 'number' ? `${width}px` : width) : '100%',
        height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
        margin: margin ? (typeof margin === 'number' ? `${margin}px` : margin) : undefined,
        padding: padding ? (typeof padding === 'number' ? `${padding}px` : padding) : undefined,
        marginTop: spacingAbove ? theme?.spacing?.[spacingAbove] : undefined,
        marginBottom: spacingBelow ? theme?.spacing?.[spacingBelow] : undefined,
        border: '1px solid #e0e0e0',
        borderRadius: '4px',
        overflow: 'auto',
        backgroundColor: '#ffffff',
        fontFamily: theme?.roles?.body?.fontFamily || "'Roboto', sans-serif",
        fontSize: theme?.roles?.body?.fontSize || '14px',
        ...style
    };

    const tableStyle: React.CSSProperties = {
        width: '100%',
        borderCollapse: 'collapse'
    };

    const headerStyle: React.CSSProperties = {
        backgroundColor: '#f5f5f5',
        borderBottom: '2px solid #e0e0e0'
    };

    const cellStyle: React.CSSProperties = {
        padding: '12px 16px',
        borderBottom: '1px solid #e0e0e0',
        textAlign: 'left'
    };

    const containerClasses = [
        'anvil-data-grid',
        className
    ].filter(Boolean).join(' ');

    // Simple pagination logic
    const startIndex = paginated ? (currentPage - 1) * pageSize : 0;
    const endIndex = paginated ? startIndex + pageSize : rows.length;
    const visibleRows = rows.slice(startIndex, endIndex);
    const totalPages = paginated ? Math.ceil(rows.length / pageSize) : 1;

    return (
        <div className={containerClasses} style={containerStyle} {...props}>
            <table style={tableStyle}>
                <thead style={headerStyle}>
                    <tr>
                        {columns.map((column) => (
                            <th
                                key={column.id}
                                style={{
                                    ...cellStyle,
                                    width: column.width,
                                    cursor: column.sortable ? 'pointer' : 'default',
                                    userSelect: 'none'
                                }}
                                onClick={() => column.sortable && handleSort(column.id)}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {column.title}
                                    {column.sortable && localSortBy === column.id && (
                                        <span>{localSortOrder === 'asc' ? '↑' : '↓'}</span>
                                    )}
                                </div>
                                {filterable && column.filterable && (
                                    <input
                                        type="text"
                                        placeholder="Filter..."
                                        style={{
                                            marginTop: '8px',
                                            padding: '4px 8px',
                                            border: '1px solid #ccc',
                                            borderRadius: '2px',
                                            fontSize: '12px',
                                            width: '100%'
                                        }}
                                        onChange={(e) => handleFilter(column.id, e.target.value)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                )}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {visibleRows.map((row, rowIndex) => (
                        <tr
                            key={rowIndex}
                            style={{
                                backgroundColor: isRowSelected(row) ? '#e3f2fd' :
                                    rowIndex % 2 === 0 ? '#ffffff' : '#fafafa',
                                cursor: onRowSelect ? 'pointer' : 'default'
                            }}
                            onClick={() => onRowSelect?.(row, !isRowSelected(row))}
                        >
                            {columns.map((column) => (
                                <td key={column.id} style={cellStyle}>
                                    {column.format ?
                                        column.format(row[column.data_key]) :
                                        row[column.data_key]}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>

            {paginated && totalPages > 1 && (
                <div style={{
                    padding: '16px',
                    borderTop: '1px solid #e0e0e0',
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '8px'
                }}>
                    <button
                        disabled={currentPage === 1}
                        onClick={() => onPageChange?.(currentPage - 1)}
                        style={{
                            padding: '4px 8px',
                            border: '1px solid #ccc',
                            backgroundColor: '#fff',
                            cursor: currentPage === 1 ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Previous
                    </button>

                    <span style={{ padding: '4px 8px' }}>
                        Page {currentPage} of {totalPages}
                    </span>

                    <button
                        disabled={currentPage === totalPages}
                        onClick={() => onPageChange?.(currentPage + 1)}
                        style={{
                            padding: '4px 8px',
                            border: '1px solid #ccc',
                            backgroundColor: '#fff',
                            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer'
                        }}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}; 