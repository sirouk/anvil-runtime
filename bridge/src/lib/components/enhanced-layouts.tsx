import * as React from 'react';
import { useTheme } from '../theme/theme-context';

/**
 * Enhanced Layout Components with Full Anvil Behavior
 * 
 * These components provide complete layout functionality matching Anvil's behavior
 * including responsive grid system, Material Design theming, and proper spacing.
 */

// Common layout property interfaces
export interface AnvilLayoutProps {
    width?: string | number;
    height?: string | number;
    margin?: string | number;
    padding?: string | number;
    spacingAbove?: 'none' | 'small' | 'medium' | 'large' | 'extra_large';
    spacingBelow?: 'none' | 'small' | 'medium' | 'large' | 'extra_large';
    visible?: boolean;
    role?: string;
}

export interface AnvilGridPosition {
    row?: string;          // "A", "B", "C" etc.
    col?: number;         // Column for all breakpoints
    colXs?: number;       // Extra small screens
    colSm?: number;       // Small screens  
    colMd?: number;       // Medium screens
    colLg?: number;       // Large screens
    colXl?: number;       // Extra large screens
    width?: number;       // Width span for all breakpoints
    widthXs?: number;     // Span width for xs
    widthSm?: number;     // Span width for sm
    widthMd?: number;     // Span width for md
    widthLg?: number;     // Span width for lg
    widthXl?: number;     // Span width for xl
}

// Helper to normalize size values
const normalizeSize = (size: string | number | undefined): string | undefined => {
    if (size === undefined) return undefined;
    if (typeof size === 'number') return `${size}px`;
    return size;
};

// Helper to get spacing value from theme
const getSpacing = (spacing: string | undefined, theme: any): string => {
    if (!spacing || !theme?.spacing) return '0';
    return theme.spacing[spacing] || spacing;
};

// Helper to generate responsive grid classes
const generateGridClasses = (position: AnvilGridPosition): string => {
    const classes: string[] = [];

    if (position.col !== undefined) {
        classes.push(`col-${position.col}`);
        if (position.width) classes.push(`width-${position.width}`);
    }

    if (position.colXs !== undefined) {
        classes.push(`col-xs-${position.colXs}`);
        if (position.widthXs) classes.push(`width-xs-${position.widthXs}`);
    }

    if (position.colSm !== undefined) {
        classes.push(`col-sm-${position.colSm}`);
        if (position.widthSm) classes.push(`width-sm-${position.widthSm}`);
    }

    if (position.colMd !== undefined) {
        classes.push(`col-md-${position.colMd}`);
        if (position.widthMd) classes.push(`width-md-${position.widthMd}`);
    }

    if (position.colLg !== undefined) {
        classes.push(`col-lg-${position.colLg}`);
        if (position.widthLg) classes.push(`width-lg-${position.widthLg}`);
    }

    if (position.colXl !== undefined) {
        classes.push(`col-xl-${position.colXl}`);
        if (position.widthXl) classes.push(`width-xl-${position.widthXl}`);
    }

    return classes.join(' ');
};

// Enhanced HtmlPanel with theme support
export interface HtmlPanelProps extends AnvilLayoutProps {
    html?: string;
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    theme?: string;
    slots?: Record<string, React.ReactNode>;
    [key: string]: any;
}

export const HtmlPanel: React.FC<HtmlPanelProps> = ({
    html,
    children,
    className = '',
    style,
    theme: themeName,
    slots,
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    ...props
}) => {
    const theme = useTheme();

    if (!visible) return null;

    const roleStyles = role && theme?.roles?.[role] ? theme.roles[role] : {};

    const containerStyle: React.CSSProperties = {
        width: normalizeSize(width),
        height: normalizeSize(height),
        margin: normalizeSize(margin),
        padding: normalizeSize(padding),
        marginTop: spacingAbove ? getSpacing(spacingAbove, theme) : undefined,
        marginBottom: spacingBelow ? getSpacing(spacingBelow, theme) : undefined,
        ...roleStyles,
        ...style
    };

    const classes = [
        'anvil-html-panel',
        role && `anvil-role-${role}`,
        themeName && `anvil-theme-${themeName}`,
        className
    ].filter(Boolean).join(' ');

    if (html) {
        return (
            <div
                className={classes}
                style={containerStyle}
                dangerouslySetInnerHTML={{ __html: html }}
                {...props}
            />
        );
    }

    // Support theme template slots
    if (themeName && slots) {
        return (
            <div className={classes} style={containerStyle} {...props}>
                {slots.title && <header className="anvil-slot-title">{slots.title}</header>}
                {slots['nav-right'] && <nav className="anvil-slot-nav-right">{slots['nav-right']}</nav>}
                {slots['left-nav'] && <aside className="anvil-slot-left-nav">{slots['left-nav']}</aside>}
                <main className="anvil-slot-main">{children}</main>
            </div>
        );
    }

    return (
        <div className={classes} style={containerStyle} {...props}>
            {children}
        </div>
    );
};

// Enhanced GridPanel with responsive grid system
export interface GridPanelProps extends AnvilLayoutProps {
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
    columns = 12, // Default to 12-column grid like Bootstrap
    rows,
    gap = '16px',
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    ...props
}) => {
    const theme = useTheme();

    if (!visible) return null;

    const roleStyles = role && theme?.roles?.[role] ? theme.roles[role] : {};

    const gridStyle: React.CSSProperties = {
        display: 'grid',
        gridTemplateColumns: typeof columns === 'number' ? `repeat(${columns}, 1fr)` : columns,
        gap: normalizeSize(gap),
        width: normalizeSize(width),
        height: normalizeSize(height),
        margin: normalizeSize(margin),
        padding: normalizeSize(padding),
        marginTop: spacingAbove ? getSpacing(spacingAbove, theme) : undefined,
        marginBottom: spacingBelow ? getSpacing(spacingBelow, theme) : undefined,
        ...roleStyles,
        ...style
    };

    if (rows) {
        gridStyle.gridTemplateRows = typeof rows === 'number' ? `repeat(${rows}, auto)` : rows;
    }

    const classes = [
        'anvil-grid-panel',
        role && `anvil-role-${role}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} style={gridStyle} {...props}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    const childProps = child.props as any;
                    if (childProps.gridPosition) {
                        const position = childProps.gridPosition as AnvilGridPosition;
                        const gridClasses = generateGridClasses(position);
                        const gridItemStyle: React.CSSProperties = {
                            gridRow: position.row,
                            ...childProps.style
                        };

                        return React.cloneElement(child as React.ReactElement<any>, {
                            className: `${childProps.className || ''} ${gridClasses}`.trim(),
                            style: gridItemStyle
                        });
                    }
                }
                return child;
            })}
        </div>
    );
};

// Enhanced ColumnPanel with proper spacing and alignment
export interface ColumnPanelProps extends AnvilLayoutProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    spacing?: 'none' | 'small' | 'medium' | 'large' | 'extra_large';
    align?: 'left' | 'center' | 'right' | 'stretch';
    justify?: 'start' | 'center' | 'end' | 'between' | 'around';
    [key: string]: any;
}

export const ColumnPanel: React.FC<ColumnPanelProps> = ({
    children,
    className = '',
    style,
    spacing = 'medium',
    align = 'stretch',
    justify = 'start',
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    ...props
}) => {
    const theme = useTheme();

    if (!visible) return null;

    const roleStyles = role && theme?.roles?.[role] ? theme.roles[role] : {};

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: 'column',
        gap: getSpacing(spacing, theme),
        alignItems: align === 'left' ? 'flex-start' :
            align === 'right' ? 'flex-end' :
                align === 'center' ? 'center' : 'stretch',
        justifyContent: justify === 'start' ? 'flex-start' :
            justify === 'center' ? 'center' :
                justify === 'end' ? 'flex-end' :
                    justify === 'between' ? 'space-between' :
                        justify === 'around' ? 'space-around' : 'flex-start',
        width: normalizeSize(width),
        height: normalizeSize(height),
        margin: normalizeSize(margin),
        padding: normalizeSize(padding),
        marginTop: spacingAbove ? getSpacing(spacingAbove, theme) : undefined,
        marginBottom: spacingBelow ? getSpacing(spacingBelow, theme) : undefined,
        ...roleStyles,
        ...style
    };

    const classes = [
        'anvil-column-panel',
        role && `anvil-role-${role}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} style={containerStyle} {...props}>
            {children}
        </div>
    );
};

// LinearPanel - Can be horizontal or vertical
export interface LinearPanelProps extends AnvilLayoutProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    orientation?: 'horizontal' | 'vertical';
    spacing?: 'none' | 'small' | 'medium' | 'large' | 'extra_large';
    align?: 'start' | 'center' | 'end' | 'stretch';
    justify?: 'start' | 'center' | 'end' | 'between' | 'around';
    [key: string]: any;
}

export const LinearPanel: React.FC<LinearPanelProps> = ({
    children,
    className = '',
    style,
    orientation = 'vertical',
    spacing = 'medium',
    align = 'stretch',
    justify = 'start',
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    ...props
}) => {
    const theme = useTheme();

    if (!visible) return null;

    const roleStyles = role && theme?.roles?.[role] ? theme.roles[role] : {};

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        gap: getSpacing(spacing, theme),
        alignItems: align === 'start' ? 'flex-start' :
            align === 'end' ? 'flex-end' :
                align === 'center' ? 'center' : 'stretch',
        justifyContent: justify === 'start' ? 'flex-start' :
            justify === 'center' ? 'center' :
                justify === 'end' ? 'flex-end' :
                    justify === 'between' ? 'space-between' :
                        justify === 'around' ? 'space-around' : 'flex-start',
        width: normalizeSize(width),
        height: normalizeSize(height),
        margin: normalizeSize(margin),
        padding: normalizeSize(padding),
        marginTop: spacingAbove ? getSpacing(spacingAbove, theme) : undefined,
        marginBottom: spacingBelow ? getSpacing(spacingBelow, theme) : undefined,
        ...roleStyles,
        ...style
    };

    const classes = [
        'anvil-linear-panel',
        `anvil-linear-${orientation}`,
        role && `anvil-role-${role}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} style={containerStyle} {...props}>
            {children}
        </div>
    );
};

// Enhanced FlowPanel with wrapping behavior
export interface FlowPanelProps extends AnvilLayoutProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    direction?: 'row' | 'column';
    wrap?: boolean | 'wrap' | 'nowrap' | 'wrap-reverse';
    spacing?: 'none' | 'small' | 'medium' | 'large' | 'extra_large';
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
    spacing = 'medium',
    align = 'flex-start',
    justify = 'flex-start',
    width,
    height,
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    ...props
}) => {
    const theme = useTheme();

    if (!visible) return null;

    const roleStyles = role && theme?.roles?.[role] ? theme.roles[role] : {};

    const wrapValue = wrap === true ? 'wrap' :
        wrap === false ? 'nowrap' :
            wrap;

    const containerStyle: React.CSSProperties = {
        display: 'flex',
        flexDirection: direction,
        flexWrap: wrapValue as any,
        gap: getSpacing(spacing, theme),
        alignItems: align,
        justifyContent: justify,
        width: normalizeSize(width),
        height: normalizeSize(height),
        margin: normalizeSize(margin),
        padding: normalizeSize(padding),
        marginTop: spacingAbove ? getSpacing(spacingAbove, theme) : undefined,
        marginBottom: spacingBelow ? getSpacing(spacingBelow, theme) : undefined,
        ...roleStyles,
        ...style
    };

    const classes = [
        'anvil-flow-panel',
        role && `anvil-role-${role}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} style={containerStyle} {...props}>
            {children}
        </div>
    );
};

// XYPanel - Absolute positioning container
export interface XYPanelProps extends AnvilLayoutProps {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: any;
}

export interface XYPosition {
    x?: number | string;
    y?: number | string;
    width?: number | string;
    height?: number | string;
    anchor?: 'top-left' | 'top-center' | 'top-right' |
    'center-left' | 'center' | 'center-right' |
    'bottom-left' | 'bottom-center' | 'bottom-right';
}

export const XYPanel: React.FC<XYPanelProps> = ({
    children,
    className = '',
    style,
    width = '100%',
    height = '400px', // Default height for absolute positioning
    margin,
    padding,
    spacingAbove,
    spacingBelow,
    visible = true,
    role,
    ...props
}) => {
    const theme = useTheme();

    if (!visible) return null;

    const roleStyles = role && theme?.roles?.[role] ? theme.roles[role] : {};

    const containerStyle: React.CSSProperties = {
        position: 'relative',
        width: normalizeSize(width),
        height: normalizeSize(height),
        margin: normalizeSize(margin),
        padding: normalizeSize(padding),
        marginTop: spacingAbove ? getSpacing(spacingAbove, theme) : undefined,
        marginBottom: spacingBelow ? getSpacing(spacingBelow, theme) : undefined,
        overflow: 'hidden',
        ...roleStyles,
        ...style
    };

    const classes = [
        'anvil-xy-panel',
        role && `anvil-role-${role}`,
        className
    ].filter(Boolean).join(' ');

    return (
        <div className={classes} style={containerStyle} {...props}>
            {React.Children.map(children, (child) => {
                if (React.isValidElement(child)) {
                    const childProps = child.props as any;
                    if (childProps.position) {
                        const pos = childProps.position as XYPosition;
                        const itemStyle: React.CSSProperties = {
                            position: 'absolute',
                            ...getXYPositionStyles(pos),
                            ...childProps.style
                        };

                        return React.cloneElement(child as React.ReactElement<any>, {
                            style: itemStyle
                        });
                    }
                }
                return child;
            })}
        </div>
    );
};

// Helper function to calculate XY position styles
function getXYPositionStyles(position: XYPosition): React.CSSProperties {
    const styles: React.CSSProperties = {};

    // Handle anchor-based positioning
    if (position.anchor) {
        switch (position.anchor) {
            case 'top-left':
                styles.top = 0;
                styles.left = 0;
                break;
            case 'top-center':
                styles.top = 0;
                styles.left = '50%';
                styles.transform = 'translateX(-50%)';
                break;
            case 'top-right':
                styles.top = 0;
                styles.right = 0;
                break;
            case 'center-left':
                styles.top = '50%';
                styles.left = 0;
                styles.transform = 'translateY(-50%)';
                break;
            case 'center':
                styles.top = '50%';
                styles.left = '50%';
                styles.transform = 'translate(-50%, -50%)';
                break;
            case 'center-right':
                styles.top = '50%';
                styles.right = 0;
                styles.transform = 'translateY(-50%)';
                break;
            case 'bottom-left':
                styles.bottom = 0;
                styles.left = 0;
                break;
            case 'bottom-center':
                styles.bottom = 0;
                styles.left = '50%';
                styles.transform = 'translateX(-50%)';
                break;
            case 'bottom-right':
                styles.bottom = 0;
                styles.right = 0;
                break;
        }
    } else {
        // Handle x/y coordinate positioning
        if (position.x !== undefined) {
            styles.left = normalizeSize(position.x);
        }
        if (position.y !== undefined) {
            styles.top = normalizeSize(position.y);
        }
    }

    // Set width and height
    if (position.width !== undefined) {
        styles.width = normalizeSize(position.width);
    }
    if (position.height !== undefined) {
        styles.height = normalizeSize(position.height);
    }

    return styles;
}

// Export grid position helper for child components
export function withGridPosition<P extends object>(
    Component: React.ComponentType<P>
): React.FC<P & { gridPosition?: AnvilGridPosition }> {
    return ({ gridPosition, ...props }) => {
        return <Component {...props as P} />;
    };
}

// Export XY position helper for child components
export function withXYPosition<P extends object>(
    Component: React.ComponentType<P>
): React.FC<P & { position?: XYPosition }> {
    return ({ position, ...props }) => {
        return <Component {...props as P} />;
    };
} 