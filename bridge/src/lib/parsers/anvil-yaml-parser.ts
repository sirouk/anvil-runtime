/**
 * Enhanced YAML parser for Anvil app configurations and form templates
 * Handles parsing of anvil.yaml, form_template.yaml, and theme files
 * with comprehensive validation and error handling
 */

import * as yaml from 'js-yaml';
import {
    AnvilAppConfig,
    AnvilFormTemplate,
    AnvilTheme,
    AnvilComponent
} from '@/types/anvil-protocol';

interface YamlParsingError {
    file: string;
    line?: number;
    column?: number;
    message: string;
    originalError?: Error;
}

interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

interface ComponentValidationOptions {
    allowCustomComponents?: boolean;
    validateDataBindings?: boolean;
    validateEventBindings?: boolean;
}

export class AnvilYamlParser {
    /**
     * Parse anvil.yaml app configuration
     */
    static parseAppConfig(yamlContent: string): AnvilAppConfig {
        try {
            const parsed = yaml.load(yamlContent) as any;
            return {
                dependencies: parsed.dependencies || [],
                services: parsed.services || [],
                package_name: parsed.package_name || '',
                name: parsed.name || '',
                allow_embedding: parsed.allow_embedding || false,
                runtime_options: {
                    version: parsed.runtime_options?.version || '1.0',
                    client_version: parsed.runtime_options?.client_version,
                    server_version: parsed.runtime_options?.server_version,
                },
                metadata: {
                    title: parsed.metadata?.title || parsed.name || 'Anvil App',
                    description: parsed.metadata?.description,
                    logo: parsed.metadata?.logo,
                },
                startup_form: parsed.startup_form,
                startup: parsed.startup,
                native_deps: parsed.native_deps || [],
                db_schema: parsed.db_schema,
            };
        } catch (error) {
            throw new Error(`Failed to parse anvil.yaml: ${error}`);
        }
    }

    /**
     * Parse form_template.yaml with enhanced validation
     */
    static parseFormTemplate(yamlContent: string, options: ComponentValidationOptions = {}): AnvilFormTemplate {
        try {
            const parsed = yaml.load(yamlContent) as any;

            // Parse basic structure
            const formTemplate: AnvilFormTemplate = {
                components: this.parseComponents(parsed.components || []),
                container: {
                    type: parsed.container?.type || 'ColumnPanel',
                    properties: parsed.container?.properties || {},
                },
                event_bindings: this.parseEventBindings(parsed.event_bindings || {}),
                data_bindings: this.parseDataBindings(parsed.data_bindings || []),
                is_package: parsed.is_package || false,
            };

            // Handle optional fields
            if (parsed.custom_component_events) {
                formTemplate.custom_component_events = parsed.custom_component_events;
            }

            if (parsed.layout_metadata) {
                formTemplate.layout_metadata = parsed.layout_metadata;
            }

            // Validate the parsed structure
            const validation = this.validateFormTemplate(formTemplate, options);

            // Log warnings if present
            if (validation.warnings.length > 0) {
                console.warn('Form template validation warnings:', validation.warnings);
            }

            // Throw error only if there are actual errors
            if (validation.errors.length > 0) {
                throw new Error(`Form template validation errors: ${validation.errors.join(', ')}`);
            }

            return formTemplate;
        } catch (error) {
            throw this.createParsingError('form_template.yaml', error as Error);
        }
    }

    /**
     * Parse theme parameters.yaml with enhanced support
     */
    static parseTheme(yamlContent: string): AnvilTheme {
        try {
            const parsed = yaml.load(yamlContent) as any;
            return {
                parameters: {
                    roles: parsed.roles || {},
                    color_schemes: parsed.color_schemes || {},
                    spacing: parsed.spacing || {},
                    breakpoints: parsed.breakpoints || {},
                    fonts: parsed.fonts || [],
                },
                assets: {
                    css: parsed.assets?.css || [],
                    html: parsed.assets?.html || [],
                },
            };
        } catch (error) {
            throw this.createParsingError('theme/parameters.yaml', error as Error);
        }
    }

    /**
     * Parse complete Anvil application directory
     */
    static async parseAnvilApp(appPath: string): Promise<{
        config: AnvilAppConfig;
        forms: Map<string, AnvilFormTemplate>;
        theme?: AnvilTheme;
        errors: YamlParsingError[];
    }> {
        // Only run on server side
        if (typeof window !== 'undefined') {
            return {
                config: { name: 'ClientError', package_name: '' } as AnvilAppConfig,
                forms: new Map<string, AnvilFormTemplate>(),
                theme: undefined,
                errors: [{ file: 'parseAnvilApp', line: 0, column: 0, message: 'App parsing only available on server side' }]
            };
        }

        const errors: YamlParsingError[] = [];
        const forms = new Map<string, AnvilFormTemplate>();
        let config: AnvilAppConfig;
        let theme: AnvilTheme | undefined;

        try {
            // Parse main app config
            const fs = await import('fs/promises');
            const path = await import('path');

            const configPath = path.join(appPath, 'anvil.yaml');
            const configContent = await fs.readFile(configPath, 'utf-8');
            config = this.parseAppConfig(configContent);

            // Parse theme if exists
            try {
                const themePath = path.join(appPath, 'theme', 'parameters.yaml');
                const themeContent = await fs.readFile(themePath, 'utf-8');
                theme = this.parseTheme(themeContent);
            } catch (error) {
                // Theme is optional
                console.debug('No theme file found or error parsing theme:', error);
            }

            // Parse all form templates
            const clientCodePath = path.join(appPath, 'client_code');
            try {
                const formDirs = await fs.readdir(clientCodePath, { withFileTypes: true });

                for (const dir of formDirs) {
                    if (dir.isDirectory()) {
                        try {
                            const formTemplatePath = path.join(clientCodePath, dir.name, 'form_template.yaml');
                            const formContent = await fs.readFile(formTemplatePath, 'utf-8');
                            const formTemplate = this.parseFormTemplate(formContent, {
                                allowCustomComponents: true,
                                validateEventBindings: true,
                                validateDataBindings: true
                            });
                            forms.set(dir.name, formTemplate);
                        } catch (error) {
                            errors.push(this.createParsingError(`client_code/${dir.name}/form_template.yaml`, error as Error));
                        }
                    }
                }
            } catch (error) {
                errors.push(this.createParsingError('client_code', error as Error));
            }

        } catch (error) {
            errors.push(this.createParsingError('anvil.yaml', error as Error));
            // Return a minimal config to allow partial parsing
            config = {
                dependencies: [],
                services: [],
                package_name: 'Unknown',
                name: 'Unknown App',
                allow_embedding: false,
                runtime_options: { version: '1.0' },
                metadata: { title: 'Unknown App' },
                native_deps: []
            };
        }

        return { config, forms, theme, errors };
    }

    /**
     * Recursively parse components array
     */
    private static parseComponents(components: any[]): AnvilComponent[] {
        return components.map(component => ({
            type: component.type || 'Unknown',
            name: component.name || '',
            properties: component.properties || {},
            layout_properties: component.layout_properties || {},
            components: component.components ? this.parseComponents(component.components) : undefined,
        }));
    }

    /**
     * Parse event bindings with validation
     */
    private static parseEventBindings(eventBindings: any): Record<string, string> {
        const bindings: Record<string, string> = {};

        if (typeof eventBindings === 'object' && eventBindings !== null) {
            for (const [event, handler] of Object.entries(eventBindings)) {
                if (typeof handler === 'string') {
                    bindings[event] = handler;
                } else {
                    console.warn(`Invalid event binding for ${event}: expected string, got ${typeof handler}`);
                }
            }
        }

        return bindings;
    }

    /**
     * Parse data bindings array
     */
    private static parseDataBindings(dataBindings: any[]): any[] {
        if (!Array.isArray(dataBindings)) {
            return [];
        }

        return dataBindings.filter(binding => {
            if (typeof binding !== 'object' || !binding.component || !binding.property || !binding.code) {
                console.warn('Invalid data binding structure:', binding);
                return false;
            }
            return true;
        });
    }

    /**
     * Validate form template structure
     */
    private static validateFormTemplate(template: AnvilFormTemplate, options: ComponentValidationOptions): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check container type
        if (!template.container.type) {
            errors.push('Container type is required');
        }

        // Validate components
        const componentValidation = this.validateComponents(template.components, options);
        errors.push(...componentValidation.errors);
        warnings.push(...componentValidation.warnings);

        // Validate event bindings if enabled
        if (options.validateEventBindings) {
            for (const [event, handler] of Object.entries(template.event_bindings || {})) {
                if (!handler.startsWith('self.')) {
                    warnings.push(`Event handler '${handler}' for '${event}' doesn't follow 'self.' convention`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Validate components array
     */
    private static validateComponents(components: AnvilComponent[], options: ComponentValidationOptions): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        const knownComponentTypes = new Set([
            'ColumnPanel', 'LinearPanel', 'FlowPanel', 'GridPanel', 'XYPanel', 'HtmlTemplate',
            'Label', 'TextBox', 'Button', 'CheckBox', 'RadioButton', 'DropDown', 'DatePicker',
            'DataGrid', 'RepeatingPanel', 'DataRowPanel', 'Plot', 'Image', 'FileLoader', 'Timer'
        ]);

        for (const component of components) {
            // Check component type
            if (!component.type) {
                errors.push(`Component '${component.name}' missing type`);
                continue;
            }

            // Validate known vs custom components
            if (!knownComponentTypes.has(component.type) && !component.type.startsWith('form:')) {
                if (options.allowCustomComponents) {
                    warnings.push(`Unknown component type: ${component.type}`);
                } else {
                    errors.push(`Unknown component type: ${component.type}`);
                }
            }

            // Check component name
            if (!component.name) {
                warnings.push(`Component of type '${component.type}' missing name`);
            }

            // Validate nested components
            if (component.components && component.components.length > 0) {
                const nestedValidation = this.validateComponents(component.components, options);
                errors.push(...nestedValidation.errors);
                warnings.push(...nestedValidation.warnings);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Create a structured parsing error
     */
    private static createParsingError(filename: string, originalError: Error): YamlParsingError {
        const yamlError = originalError as any;

        return {
            file: filename,
            line: yamlError.mark?.line,
            column: yamlError.mark?.column,
            message: originalError.message,
            originalError
        };
    }

    /**
     * Validate component type format
     * Handles: built-in (TextBox), dependency (form:dep_id:ComponentName), package (anvil.ComponentName)
     */
    static parseComponentType(type: string): {
        category: 'builtin' | 'dependency' | 'package';
        namespace?: string;
        name: string;
        dependencyId?: string;
    } {
        // Dependency format: form:dep_id:ComponentName
        if (type.startsWith('form:')) {
            const parts = type.split(':');
            if (parts.length === 3) {
                return {
                    category: 'dependency',
                    dependencyId: parts[1],
                    name: parts[2],
                };
            }
        }

        // Package format: anvil.ComponentName
        if (type.includes('.')) {
            const parts = type.split('.');
            return {
                category: 'package',
                namespace: parts[0],
                name: parts[1],
            };
        }

        // Built-in component
        return {
            category: 'builtin',
            name: type,
        };
    }

    /**
     * Extract all dependencies from a parsed app config
     */
    static extractDependencies(config: AnvilAppConfig): string[] {
        return config.dependencies.map(dep => dep.app_id);
    }

    /**
     * Extract all component types used in a form template
     */
    static extractComponentTypes(template: AnvilFormTemplate): string[] {
        const types = new Set<string>();

        const extractFromComponents = (components: AnvilComponent[]) => {
            components.forEach(component => {
                types.add(component.type);
                if (component.components) {
                    extractFromComponents(component.components);
                }
            });
        };

        extractFromComponents(template.components);
        types.add(template.container.type);

        return Array.from(types);
    }
} 