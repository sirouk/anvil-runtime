import * as React from 'react';
import { AnvilComponent } from '../../types/anvil-protocol';
import {
    componentRegistry,
    ComponentDefinition,
    ComponentValidator,
    PropertyMapper
} from './component-registry';
// Import to ensure components are registered
import './component-registration';

/**
 * Options for component factory creation
 */
export interface ComponentFactoryOptions {
    debug?: boolean;
    validateComponents?: boolean;
    errorBoundary?: boolean;
    theme?: string;
}

/**
 * Context for component creation
 */
export interface ComponentContext {
    formName?: string;
    parentComponent?: string;
    depth: number;
    errors: string[];
}

/**
 * Component Factory - Creates React components from Anvil YAML definitions
 */
export class ComponentFactory {
    private options: ComponentFactoryOptions;

    constructor(options: ComponentFactoryOptions = {}) {
        this.options = {
            debug: false,
            validateComponents: true,
            errorBoundary: true,
            ...options
        };
    }

    /**
     * Create a React component from an Anvil component definition
     */
    createComponent(
        component: AnvilComponent,
        key?: string | number,
        context: ComponentContext = { depth: 0, errors: [] }
    ): React.ReactElement | null {
        try {
            // Validate component if enabled
            if (this.options.validateComponents) {
                const validationErrors = ComponentValidator.validateComponentTree(component);
                if (validationErrors.length > 0) {
                    context.errors.push(...validationErrors);
                    if (this.options.debug) {
                        console.warn('Component validation errors:', validationErrors);
                    }
                    return this.createErrorComponent(component, validationErrors, key);
                }
            }

            // Get component definition
            const definition = componentRegistry.getDefinition(component.type);
            if (!definition) {
                const error = `Unknown component type: ${component.type}`;
                context.errors.push(error);
                return this.createErrorComponent(component, [error], key);
            }

            // Map properties
            const reactProps = this.mapComponentProps(component, definition, context);

            // Add key if provided
            if (key !== undefined) {
                reactProps.key = key;
                reactProps['data-testid'] = key;
            }

            // Create children if component has nested components
            const children = this.createChildren(component, context);

            // Create and return React element
            return React.createElement(
                definition.component,
                reactProps,
                ...children
            );

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            context.errors.push(`Error creating component ${component.type}: ${errorMessage}`);

            if (this.options.debug) {
                console.error('Component creation error:', error);
            }

            return this.createErrorComponent(component, [errorMessage], key);
        }
    }

    /**
     * Create multiple components from an array of Anvil components
     */
    createComponents(
        components: AnvilComponent[],
        context: ComponentContext = { depth: 0, errors: [] }
    ): React.ReactElement[] {
        return components
            .map((component, index) => {
                const childContext: ComponentContext = {
                    ...context,
                    depth: context.depth + 1,
                    parentComponent: component.type
                };
                return this.createComponent(component, index, childContext);
            })
            .filter((component): component is React.ReactElement => component !== null);
    }

    /**
     * Create a complete form from Anvil form template
     */
    createForm(
        formTemplate: { container: AnvilComponent; components?: AnvilComponent[] },
        formName?: string
    ): React.ReactElement | null {
        const context: ComponentContext = {
            formName,
            depth: 0,
            errors: []
        };

        // Create the main container
        const container = this.createComponent(formTemplate.container, 'container', context);

        if (this.options.debug && context.errors.length > 0) {
            console.warn(`Form ${formName} creation errors:`, context.errors);
        }

        return container;
    }

    /**
     * Map Anvil component properties to React props
     */
    private mapComponentProps(
        component: AnvilComponent,
        definition: ComponentDefinition,
        context: ComponentContext
    ): Record<string, any> {
        // Start with mapped properties
        const reactProps = PropertyMapper.mapProps(component.properties, definition);

        // Add layout styles if supported
        if (definition.layoutSupported && component.layout_properties) {
            const layoutStyles = PropertyMapper.mapLayoutProps(component.layout_properties);
            reactProps.style = {
                ...layoutStyles,
                ...reactProps.style
            };
        }

        // Add component name as className for styling
        if (component.name) {
            const existingClassName = reactProps.className || '';
            reactProps.className = `${existingClassName} anvil-component-${component.name}`.trim();
        }

        // Add data attributes for debugging
        if (this.options.debug) {
            reactProps['data-anvil-type'] = component.type;
            reactProps['data-anvil-name'] = component.name;
            reactProps['data-anvil-depth'] = context.depth;
        }

        return reactProps;
    }

    /**
     * Create child components recursively
     */
    private createChildren(
        component: AnvilComponent,
        context: ComponentContext
    ): React.ReactElement[] {
        if (!component.components || component.components.length === 0) {
            return [];
        }

        const childContext: ComponentContext = {
            ...context,
            depth: context.depth + 1,
            parentComponent: component.type
        };

        return this.createComponents(component.components, childContext);
    }

    /**
     * Create an error component when component creation fails
     */
    private createErrorComponent(
        component: AnvilComponent,
        errors: string[],
        key?: string | number
    ): React.ReactElement {
        const props: any = {
            className: 'anvil-component-error',
            style: {
                border: '2px solid #ff4444',
                borderRadius: '4px',
                padding: '16px',
                margin: '8px',
                backgroundColor: '#ffeeee',
                color: '#cc0000'
            }
        };

        if (key !== undefined) {
            props.key = key;
        }

        if (this.options.debug) {
            props['data-anvil-type'] = component.type;
            props['data-anvil-name'] = component.name;
            props['data-anvil-errors'] = JSON.stringify(errors);
        }

        return React.createElement(
            'div',
            props,
            React.createElement('strong', null, `Error in ${component.type}:`),
            React.createElement('ul', null,
                ...errors.map((error, index) =>
                    React.createElement('li', { key: index }, error)
                )
            )
        );
    }

    /**
     * Get validation errors from the last component creation
     */
    getErrors(): string[] {
        // This would need to be implemented with context tracking
        return [];
    }
}

/**
 * Default component factory instance
 */
export const defaultComponentFactory = new ComponentFactory({
    debug: process.env.NODE_ENV === 'development',
    validateComponents: true,
    errorBoundary: true
});

/**
 * Convenience function to create a component with the default factory
 */
export function createAnvilComponent(
    component: AnvilComponent,
    key?: string | number
): React.ReactElement | null {
    return defaultComponentFactory.createComponent(component, key);
}

/**
 * Convenience function to create multiple components with the default factory
 */
export function createAnvilComponents(
    components: AnvilComponent[]
): React.ReactElement[] {
    return defaultComponentFactory.createComponents(components);
}

/**
 * Convenience function to create a form with the default factory
 */
export function createAnvilForm(
    formTemplate: { container: AnvilComponent; components?: AnvilComponent[] },
    formName?: string
): React.ReactElement | null {
    return defaultComponentFactory.createForm(formTemplate, formName);
} 