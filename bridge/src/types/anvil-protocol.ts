/**
 * TypeScript definitions for Anvil protocol communication
 * Based on analysis of anvil-runtime WebSocket and HTTP communication patterns
 */

// Base message structure for WebSocket communication
export interface AnvilMessage {
    type: string;
    id?: string;
    sessionId?: string;
    payload?: any;
    timestamp?: number;
}

// WebSocket message types observed in Anvil runtime
export type AnvilMessageType =
    | 'CALL'           // Server function calls
    | 'RESPONSE'       // Server function responses
    | 'EVENT'          // UI events
    | 'PING'           // Heartbeat ping
    | 'PONG'           // Heartbeat pong
    | 'AUTH'           // Authentication
    | 'ERROR'          // Error messages
    | 'FORM_SHOW'      // Form navigation
    | 'FORM_HIDE'      // Form navigation
    | 'DATA_UPDATE';   // Data table updates

// Authentication and session management
export interface AnvilSession {
    sessionToken: string;
    uplinkKey: string;
    userId?: string;
    authenticated: boolean;
}

// App configuration structure from anvil.yaml
export interface AnvilAppConfig {
    dependencies: AnvilDependency[];
    services: AnvilService[];
    package_name: string;
    name: string;
    allow_embedding: boolean;
    runtime_options: {
        version: string;
        client_version?: string;
        server_version?: string;
    };
    metadata: {
        title: string;
        description?: string;
        logo?: string;
    };
    startup_form?: string;
    startup?: string;
    native_deps?: AnvilNativeDep[];
    db_schema?: any;
}

export interface AnvilDependency {
    app_id: string;
    version: string;
}

export interface AnvilService {
    source: string;
    client_config?: any;
    server_config?: any;
}

export interface AnvilNativeDep {
    name: string;
    version: string;
    source?: string;
}

// Form template structure from form_template.yaml
export interface AnvilFormTemplate {
    components: AnvilComponent[];
    container: AnvilContainer;
    event_bindings?: Record<string, string>;
    data_bindings?: AnvilDataBinding[];
    is_package: boolean;
    custom_component_events?: AnvilCustomComponentEvent[];
    layout_metadata?: Record<string, any>;
}

export interface AnvilDataBinding {
    component: string;
    property: string;
    code: string;
}

export interface AnvilCustomComponentEvent {
    name: string;
    description?: string;
    parameters?: {
        name: string;
        description?: string;
    }[];
}

export interface AnvilComponent {
    type: string;
    name: string;
    properties: Record<string, any>;
    layout_properties: Record<string, any>;
    components?: AnvilComponent[];
}

export interface AnvilContainer {
    type: string;
    properties: Record<string, any>;
}

// Theme configuration
export interface AnvilTheme {
    parameters: AnvilThemeParameters;
    assets?: AnvilThemeAssets;
}

export interface AnvilThemeParameters {
    roles: Record<string, AnvilThemeRole>;
    color_schemes: Record<string, AnvilColorScheme>;
    spacing?: Record<string, string>;
    breakpoints?: Record<string, string>;
    fonts?: AnvilThemeFont[];
}

export interface AnvilThemeFont {
    name: string;
    url: string;
}

export interface AnvilThemeRole {
    [property: string]: any; // Allow any CSS properties for flexibility
    background?: string;
    foreground?: string;
    border?: string;
    color?: string;
    font_size?: string;
    font_family?: string;
    font_weight?: string;
    background_color?: string;
    border_radius?: string;
    padding?: string;
    margin?: string;
    box_shadow?: string;
}

export interface AnvilColorScheme {
    primary: string;
    secondary: string;
    error: string;
    warning: string;
    info: string;
    success: string;
}

export interface AnvilThemeAssets {
    css?: string[];
    html?: string[];
} 