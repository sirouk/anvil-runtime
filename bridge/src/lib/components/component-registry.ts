import * as React from 'react';
import { AnvilComponent } from '../../types/anvil-protocol';

// Type for component properties (subset of any)
type ComponentProps = Record<string, any>;

// Registry for mapping Anvil component types to React components
export interface ComponentDefinition {
    component: React.ComponentType<any>;
    defaultProps?: Record<string, any>;
    propMapping?: Record<string, string>;
    layoutSupported?: boolean;
    validation?: (props: ComponentProps) => string[];
}

class ComponentRegistry {
    private registry = new Map<string, ComponentDefinition>();
    private packages = new Map<string, Map<string, ComponentDefinition>>();

    /**
     * Register a built-in component type
     */
    register(type: string, definition: ComponentDefinition): void {
        this.registry.set(type, definition);
    }

    /**
     * Register a package component
     */
    registerPackage(packageName: string, componentName: string, definition: ComponentDefinition): void {
        if (!this.packages.has(packageName)) {
            this.packages.set(packageName, new Map());
        }
        this.packages.get(packageName)!.set(componentName, definition);
    }

    /**
     * Get component definition for any component type format
     */
    getDefinition(type: string): ComponentDefinition | null {
        // Handle built-in components (e.g., "ColumnPanel", "TextBox", "Button")
        if (this.registry.has(type)) {
            return this.registry.get(type)!;
        }

        // Handle dependency components (e.g., "form:dep_id:ComponentName")
        if (type.startsWith('form:')) {
            const parts = type.split(':');
            if (parts.length === 3) {
                const [, depId, componentName] = parts;

                // Handle Material 3 Theme components (dep_lin1x4oec0ytd)
                if (depId === 'dep_lin1x4oec0ytd') {
                    const standardType = this.mapMaterial3Component(componentName);
                    if (standardType && this.registry.has(standardType)) {
                        return this.registry.get(standardType)!;
                    }
                }

                // For other dependency components, create custom placeholder
                return this.createCustomComponentDefinition(componentName, depId);
            }
        }

        // Handle package components (e.g., "anvil.ComponentName")
        if (type.includes('.')) {
            const [packageName, componentName] = type.split('.', 2);
            const packageMap = this.packages.get(packageName);
            if (packageMap && packageMap.has(componentName)) {
                return packageMap.get(componentName)!;
            }
            // If package component not found, create a placeholder
            return this.createCustomComponentDefinition(componentName, packageName);
        }

        return null;
    }

    /**
     * Map Material 3 Theme components to standard Anvil components
     */
    private mapMaterial3Component(componentName: string): string | null {
        const material3Mappings: Record<string, string> = {
            '_Components.Button': 'Button',
            '_Components.TextInput.TextArea': 'TextArea',
            '_Components.TextField': 'TextBox',
            '_Components.RadioButton': 'RadioButton',
            '_Components.RadioGroupPanel': 'ColumnPanel',
            '_Components.Checkbox': 'CheckBox',
            '_Components.Switch': 'CheckBox',
            '_Components.Slider': 'Slider',
            '_Components.Dropdown': 'DropDown',
            '_Components.Card': 'ColumnPanel',
            '_Components.Navigation': 'ColumnPanel'
        };

        return material3Mappings[componentName] || null;
    }

    /**
     * Create a placeholder definition for custom/dependency components
     */
    private createCustomComponentDefinition(componentName: string, depId?: string): ComponentDefinition {
        const CustomComponent: React.FC<any> = (props) => {
            return React.createElement('div', {
                className: 'anvil-custom-component',
                'data-component': componentName,
                'data-dep-id': depId,
                style: {
                    border: '2px dashed #ccc',
                    padding: '16px',
                    margin: '8px',
                    textAlign: 'center',
                    color: '#666'
                }
            }, `Custom Component: ${componentName}${depId ? ` (${depId})` : ''}`);
        };

        return {
            component: CustomComponent,
            defaultProps: {},
            layoutSupported: true
        };
    }

    /**
     * Check if a component type is registered
     */
    hasComponent(type: string): boolean {
        return this.getDefinition(type) !== null;
    }

    /**
     * Get all registered component types
     */
    getRegisteredTypes(): string[] {
        const types = Array.from(this.registry.keys());

        // Add package components using Array.from for compatibility
        const packageEntries = Array.from(this.packages.entries());
        for (const [packageName, packageMap] of packageEntries) {
            const componentNames = Array.from(packageMap.keys());
            for (const componentName of componentNames) {
                types.push(`${packageName}.${componentName}`);
            }
        }

        return types;
    }
}

// Singleton instance
export const componentRegistry = new ComponentRegistry();

// Component validation utilities
export class ComponentValidator {
    static validateComponent(type: string, props: ComponentProps): string[] {
        const definition = componentRegistry.getDefinition(type);
        if (!definition) {
            return [`Unknown component type: ${type}`];
        }

        const errors: string[] = [];

        // Run custom validation if available
        if (definition.validation) {
            errors.push(...definition.validation(props));
        }

        // Basic validation
        if (props.name && typeof props.name !== 'string') {
            errors.push('Component name must be a string');
        }

        return errors;
    }

    static validateComponentTree(component: AnvilComponent): string[] {
        const errors: string[] = [];

        // Validate current component
        if (component.type) {
            errors.push(...this.validateComponent(component.type, component.properties || {}));
        }

        // Validate children recursively
        if (component.components) {
            for (const child of component.components) {
                errors.push(...this.validateComponentTree(child));
            }
        }

        return errors;
    }
}

// Property mapping utilities
export class PropertyMapper {
    /**
     * Map Anvil properties to React props using component definition
     */
    static mapProps(
        anvilProps: ComponentProps,
        definition: ComponentDefinition,
        componentContext?: { name?: string; formName?: string }
    ): Record<string, any> {
        const reactProps: Record<string, any> = { ...definition.defaultProps };

        // Apply property mapping if defined
        if (definition.propMapping) {
            const mappingEntries = Object.entries(definition.propMapping);
            for (const [anvilProp, reactProp] of mappingEntries) {
                if (anvilProp in anvilProps) {
                    // Handle event handlers specially
                    if (this.isEventHandler(anvilProp)) {
                        reactProps[reactProp] = this.createEventHandler(
                            anvilProp,
                            definition.component.name || 'Unknown',
                            componentContext?.name,
                            componentContext?.formName
                        );
                    } else {
                        reactProps[reactProp] = anvilProps[anvilProp];
                    }
                }
            }
        } else {
            // Direct mapping if no specific mapping defined
            Object.assign(reactProps, anvilProps);
        }

        return reactProps;
    }

    /**
     * Check if a property is an event handler
     */
    private static isEventHandler(propName: string): boolean {
        const eventHandlers = ['click', 'change', 'submit', 'focus', 'blur', 'hover', 'select'];
        return eventHandlers.includes(propName);
    }

    /**
     * Create a server-bound event handler
     */
    private static createEventHandler(
        eventType: string,
        componentType: string,
        componentName?: string,
        formName?: string
    ) {
        return async () => {
            try {
                // Dynamically import the event bridge to avoid circular dependencies
                const { createServerEventHandler } = await import('../events/anvil-event-bridge');
                const handler = createServerEventHandler(eventType, componentType, componentName, formName);
                return handler();
            } catch (error) {
                console.error(`Failed to create event handler for ${eventType}:`, error);
            }
        };
    }

    /**
     * Map layout properties to CSS styles
     */
    static mapLayoutProps(layoutProps: Record<string, any> = {}): React.CSSProperties {
        const styles: React.CSSProperties = {};

        // Width and height
        if (layoutProps.width !== undefined) {
            styles.width = this.normalizeSize(layoutProps.width);
        }
        if (layoutProps.height !== undefined) {
            styles.height = this.normalizeSize(layoutProps.height);
        }

        // Margin and padding
        if (layoutProps.margin !== undefined) {
            styles.margin = this.normalizeSpacing(layoutProps.margin);
        }
        if (layoutProps.padding !== undefined) {
            styles.padding = this.normalizeSpacing(layoutProps.padding);
        }

        // Alignment
        if (layoutProps.align) {
            styles.textAlign = layoutProps.align;
        }

        // Grid properties
        if (layoutProps.row !== undefined) {
            styles.gridRow = layoutProps.row;
        }
        if (layoutProps.col !== undefined) {
            styles.gridColumn = layoutProps.col;
        }
        if (layoutProps.col_span !== undefined) {
            styles.gridColumnEnd = `span ${layoutProps.col_span}`;
        }
        if (layoutProps.row_span !== undefined) {
            styles.gridRowEnd = `span ${layoutProps.row_span}`;
        }

        // Flex properties
        if (layoutProps.flex_grow !== undefined) {
            styles.flexGrow = layoutProps.flex_grow;
        }
        if (layoutProps.flex_shrink !== undefined) {
            styles.flexShrink = layoutProps.flex_shrink;
        }

        return styles;
    }

    private static normalizeSize(size: any): string {
        if (typeof size === 'number') {
            return `${size}px`;
        }
        if (typeof size === 'string') {
            return size;
        }
        return 'auto';
    }

    private static normalizeSpacing(spacing: any): string {
        if (typeof spacing === 'number') {
            return `${spacing}px`;
        }
        if (typeof spacing === 'string') {
            return spacing;
        }
        if (Array.isArray(spacing)) {
            return spacing.map(s => this.normalizeSize(s)).join(' ');
        }
        return '0';
    }
} 