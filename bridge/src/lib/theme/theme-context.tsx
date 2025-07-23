import * as React from 'react';
import { createContext, useContext, useState, useEffect } from 'react';

/**
 * Material Design Theme Context
 * 
 * Provides theme configuration including roles, color schemes, spacing,
 * and breakpoints to all Anvil components.
 */

export interface ThemeRole {
    [key: string]: string | number;
}

export interface ColorScheme {
    primary: string;
    primary_variant: string;
    secondary: string;
    secondary_variant: string;
    background: string;
    surface: string;
    error: string;
    on_primary: string;
    on_secondary: string;
    on_background: string;
    on_surface: string;
    on_error: string;
}

export interface ThemeConfig {
    roles: Record<string, ThemeRole>;
    color_schemes: Record<string, ColorScheme>;
    spacing: Record<string, string>;
    breakpoints: Record<string, string>;
    fonts?: Array<{ name: string; url: string }>;
    assets?: {
        css?: string[];
        html?: string[];
    };
}

export interface Theme {
    name: string;
    config: ThemeConfig;
    activeColorScheme: string;
    roles: Record<string, React.CSSProperties>;
    colors: ColorScheme;
    spacing: Record<string, string>;
    breakpoints: Record<string, string>;
}

interface ThemeContextValue {
    theme: Theme | null;
    setTheme: (theme: Theme) => void;
    setColorScheme: (schemeName: string) => void;
    loadThemeConfig: (config: ThemeConfig) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

// Default Material Design theme
const defaultThemeConfig: ThemeConfig = {
    roles: {
        headline: {
            font_family: "'Roboto', sans-serif",
            font_size: "24px",
            font_weight: "500",
            color: "#1976d2",
            margin_bottom: "16px"
        },
        body: {
            font_family: "'Roboto', sans-serif",
            font_size: "16px",
            font_weight: "400",
            color: "#333333",
            line_height: "1.5"
        },
        card: {
            background_color: "#ffffff",
            border_radius: "8px",
            box_shadow: "0 2px 4px rgba(0,0,0,0.1)",
            padding: "16px",
            margin_bottom: "16px"
        },
        "primary-color": {
            background_color: "#1976d2",
            color: "#ffffff",
            border: "none",
            border_radius: "4px",
            padding: "8px 16px",
            font_weight: "500",
            cursor: "pointer"
        },
        "secondary-color": {
            background_color: "#424242",
            color: "#ffffff",
            border: "none",
            border_radius: "4px",
            padding: "8px 16px",
            font_weight: "500",
            cursor: "pointer"
        }
    },
    color_schemes: {
        primary: {
            primary: "#1976d2",
            primary_variant: "#1565c0",
            secondary: "#424242",
            secondary_variant: "#303030",
            background: "#ffffff",
            surface: "#f5f5f5",
            error: "#f44336",
            on_primary: "#ffffff",
            on_secondary: "#ffffff",
            on_background: "#000000",
            on_surface: "#000000",
            on_error: "#ffffff"
        }
    },
    spacing: {
        none: "0px",
        small: "8px",
        medium: "16px",
        large: "24px",
        extra_large: "32px"
    },
    breakpoints: {
        xs: "0px",
        sm: "600px",
        md: "960px",
        lg: "1280px",
        xl: "1920px"
    }
};

// Convert snake_case to camelCase for CSS properties
function toCamelCase(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// Convert theme roles to CSS properties
function convertRolesToStyles(roles: Record<string, ThemeRole>): Record<string, React.CSSProperties> {
    const styles: Record<string, React.CSSProperties> = {};

    for (const [roleName, roleStyle] of Object.entries(roles)) {
        const cssProps: React.CSSProperties = {};

        for (const [prop, value] of Object.entries(roleStyle)) {
            const cssProp = toCamelCase(prop);
            (cssProps as any)[cssProp] = value;
        }

        styles[roleName] = cssProps;
    }

    return styles;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode; initialTheme?: ThemeConfig }> = ({
    children,
    initialTheme
}) => {
    const [theme, setThemeState] = useState<Theme | null>(null);

    useEffect(() => {
        const config = initialTheme || defaultThemeConfig;
        const defaultScheme = 'primary';

        setThemeState({
            name: 'default',
            config,
            activeColorScheme: defaultScheme,
            roles: convertRolesToStyles(config.roles),
            colors: config.color_schemes[defaultScheme] || config.color_schemes.primary,
            spacing: config.spacing,
            breakpoints: config.breakpoints
        });
    }, [initialTheme]);

    const setTheme = (newTheme: Theme) => {
        setThemeState(newTheme);
    };

    const setColorScheme = (schemeName: string) => {
        if (!theme) return;

        const colors = theme.config.color_schemes[schemeName];
        if (colors) {
            setThemeState({
                ...theme,
                activeColorScheme: schemeName,
                colors
            });
        }
    };

    const loadThemeConfig = (config: ThemeConfig) => {
        const defaultScheme = Object.keys(config.color_schemes)[0] || 'primary';

        setThemeState({
            name: 'custom',
            config,
            activeColorScheme: defaultScheme,
            roles: convertRolesToStyles(config.roles),
            colors: config.color_schemes[defaultScheme],
            spacing: config.spacing,
            breakpoints: config.breakpoints
        });
    };

    const value: ThemeContextValue = {
        theme,
        setTheme,
        setColorScheme,
        loadThemeConfig
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
};

export function useTheme(): Theme | null {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context.theme;
}

export function useThemeConfig(): ThemeContextValue {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useThemeConfig must be used within a ThemeProvider');
    }
    return context;
}

// CSS utility to generate theme CSS variables
export function generateThemeCSS(theme: Theme): string {
    const css: string[] = [':root {'];

    // Add color scheme variables
    for (const [key, value] of Object.entries(theme.colors)) {
        const cssVarName = `--anvil-${key.replace(/_/g, '-')}`;
        css.push(`  ${cssVarName}: ${value};`);
    }

    // Add spacing variables
    for (const [key, value] of Object.entries(theme.spacing)) {
        css.push(`  --anvil-spacing-${key}: ${value};`);
    }

    // Add breakpoint variables
    for (const [key, value] of Object.entries(theme.breakpoints)) {
        css.push(`  --anvil-breakpoint-${key}: ${value};`);
    }

    css.push('}');

    // Add role classes
    for (const [roleName, styles] of Object.entries(theme.roles)) {
        css.push(`.anvil-role-${roleName} {`);

        for (const [prop, value] of Object.entries(styles)) {
            const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
            css.push(`  ${cssProp}: ${value};`);
        }

        css.push('}');
    }

    return css.join('\n');
} 