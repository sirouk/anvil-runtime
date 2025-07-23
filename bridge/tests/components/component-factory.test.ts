import React from 'react';
import { render, screen } from '@testing-library/react';
import { AnvilComponent } from '../../src/types/anvil-protocol';
import { ComponentFactory, createAnvilComponent } from '../../src/lib/components/component-factory';
import { componentRegistry } from '../../src/lib/components/component-registry';
// Import component registration to auto-register components
import '../../src/lib/components/component-registration';
import { ThemeProvider } from '../../src/lib/theme/theme-context';

// Helper to wrap components with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
    return render(React.createElement(ThemeProvider, { children: component }));
};

describe('ComponentFactory', () => {
    let factory: ComponentFactory;

    beforeEach(() => {
        factory = new ComponentFactory({ debug: true, validateComponents: true });
    });

    describe('Basic Component Creation', () => {
        test('creates a simple Label component', () => {
            const component: AnvilComponent = {
                type: 'Label',
                name: 'test_label',
                properties: {
                    text: 'Hello World'
                },
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();
            expect(element?.type).toBeDefined();

            // Test rendering
            const { container } = render(element!);
            expect(container.textContent).toBe('Hello World');
        });

        test('creates a Button component with properties', () => {
            const component: AnvilComponent = {
                type: 'Button',
                name: 'test_button',
                properties: {
                    text: 'Click Me',
                    enabled: true,
                    role: 'primary'
                },
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            const button = container.querySelector('button');
            expect(button).not.toBeNull();
            expect(button?.textContent).toBe('Click Me');
            expect(button?.disabled).toBe(false);
        });

        test('creates a TextBox component', () => {
            const component: AnvilComponent = {
                type: 'TextBox',
                name: 'test_textbox',
                properties: {
                    text: 'Initial text',
                    placeholder: 'Enter text...',
                    enabled: true
                },
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            const input = container.querySelector('input');
            expect(input).not.toBeNull();
            expect(input?.value).toBe('Initial text');
            expect(input?.placeholder).toBe('Enter text...');
        });
    });

    describe('Container Components', () => {
        test('creates a GridPanel with nested components', () => {
            const component: AnvilComponent = {
                type: 'GridPanel',
                name: 'test_grid',
                properties: {
                    columns: 2,
                    gap: '16px'
                },
                layout_properties: {},
                components: [
                    {
                        type: 'Label',
                        name: 'label1',
                        properties: { text: 'Label 1' },
                        layout_properties: {}
                    },
                    {
                        type: 'Label',
                        name: 'label2',
                        properties: { text: 'Label 2' },
                        layout_properties: {}
                    }
                ]
            };

            const element = factory.createComponent(component, 'grid_panel');
            const { container } = renderWithTheme(element!);

            expect(container.querySelector('.anvil-grid-panel')).toBeInTheDocument();
            expect(screen.getByText('Label 1')).toBeInTheDocument();
            expect(screen.getByText('Label 2')).toBeInTheDocument();
        });

        test('creates a ColumnPanel with vertical layout', () => {
            const component: AnvilComponent = {
                type: 'ColumnPanel',
                name: 'test_column',
                properties: {
                    spacing: '12px',
                    align: 'center'
                },
                layout_properties: {},
                components: [
                    {
                        type: 'Label',
                        name: 'title',
                        properties: { text: 'Title' },
                        layout_properties: {}
                    },
                    {
                        type: 'Button',
                        name: 'action',
                        properties: { text: 'Action' },
                        layout_properties: {}
                    }
                ]
            };

            const element = factory.createComponent(component, 'column_panel');
            const { container } = renderWithTheme(element!);

            expect(container.querySelector('.anvil-column-panel')).toBeInTheDocument();
        });
    });

    describe('Property Mapping', () => {
        test('maps Anvil properties to React props correctly', () => {
            const component: AnvilComponent = {
                type: 'Label',
                name: 'styled_label',
                properties: {
                    text: 'Styled Text',
                    font_size: '18px',
                    foreground: '#ff0000',
                    align: 'center'
                },
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            const label = container.querySelector('.anvil-label') as HTMLElement;
            expect(label).not.toBeNull();

            expect(label?.style.textAlign).toBe('center');
            // Browser converts hex to RGB, so check for both formats
            expect(label?.style.color).toMatch(/^(#ff0000|rgb\(255,\s*0,\s*0\))$/);
            expect(label?.style.fontSize).toBe('18px');
        });

        test('applies layout properties as CSS styles', () => {
            const component: AnvilComponent = {
                type: 'Button',
                name: 'positioned_button',
                properties: {
                    text: 'Positioned Button'
                },
                layout_properties: {
                    width: 200,
                    height: 50,
                    margin: '10px',
                    padding: '5px'
                }
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            const button = container.querySelector('button') as HTMLButtonElement;
            expect(button).not.toBeNull();
            expect(button?.style.width).toBe('200px');
            expect(button?.style.height).toBe('50px');
            expect(button?.style.margin).toBe('10px');
            expect(button?.style.padding).toBe('5px');
        });
    });

    describe('Validation and Error Handling', () => {
        test('handles unknown component types gracefully', () => {
            const component: AnvilComponent = {
                type: 'UnknownComponent',
                name: 'unknown',
                properties: {},
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            const errorComponent = container.querySelector('.anvil-component-error');
            expect(errorComponent).not.toBeNull();
            expect(container.textContent).toContain('Error in UnknownComponent');
            expect(container.textContent).toContain('Unknown component type');
        });

        test('validates component properties', () => {
            const component: AnvilComponent = {
                type: 'Button',
                name: 'invalid_button',
                properties: {
                    text: 123, // Invalid: should be string
                    enabled: 'true', // Invalid: should be boolean
                    role: 'invalid-role' // Invalid: not in allowed values
                },
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            // Should create error component due to validation failures
            const errorComponent = container.querySelector('.anvil-component-error');
            expect(errorComponent).not.toBeNull();
        });
    });

    describe('Nested Component Trees', () => {
        test('creates complex nested component hierarchies', () => {
            const rootComponent: AnvilComponent = {
                type: 'HtmlPanel',
                name: 'main_panel',
                properties: {},
                layout_properties: {},
                components: [
                    {
                        type: 'GridPanel',
                        name: 'header_grid',
                        properties: { columns: 2 },
                        layout_properties: {},
                        components: [
                            {
                                type: 'Label',
                                name: 'title',
                                properties: { text: 'Application Title' },
                                layout_properties: {}
                            },
                            {
                                type: 'Button',
                                name: 'menu_button',
                                properties: { text: 'Menu' },
                                layout_properties: {}
                            }
                        ]
                    },
                    {
                        type: 'ColumnPanel',
                        name: 'content_panel',
                        properties: { spacing: '16px' },
                        layout_properties: {},
                        components: [
                            {
                                type: 'TextBox',
                                name: 'search_box',
                                properties: { placeholder: 'Search...' },
                                layout_properties: {}
                            },
                            {
                                type: 'RepeatingPanel',
                                name: 'results_panel',
                                properties: { items: [1, 2, 3] },
                                layout_properties: {}
                            }
                        ]
                    }
                ]
            };

            const element = factory.createComponent(rootComponent, 'root');
            const { container } = renderWithTheme(element!);

            expect(screen.getByText('Application Title')).toBeInTheDocument();
            expect(screen.getByText('Menu')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
            expect(container.querySelector('.anvil-repeating-panel')).toBeInTheDocument();
        });
    });

    describe('Form Creation', () => {
        test('creates a complete form from template', () => {
            const formTemplate = {
                container: {
                    type: 'FormTemplate',
                    name: 'login_form',
                    properties: {},
                    layout_properties: {},
                    components: [
                        {
                            type: 'ColumnPanel',
                            name: 'form_panel',
                            properties: { spacing: '16px', align: 'center' },
                            layout_properties: {},
                            components: [
                                {
                                    type: 'Label',
                                    name: 'title',
                                    properties: { text: 'Login Form' },
                                    layout_properties: {}
                                },
                                {
                                    type: 'TextBox',
                                    name: 'username',
                                    properties: { placeholder: 'Username' },
                                    layout_properties: {}
                                },
                                {
                                    type: 'TextBox',
                                    name: 'password',
                                    properties: { placeholder: 'Password' },
                                    layout_properties: {}
                                },
                                {
                                    type: 'Button',
                                    name: 'submit',
                                    properties: { text: 'Login', role: 'primary' },
                                    layout_properties: {}
                                }
                            ]
                        }
                    ]
                }
            };

            const form = factory.createForm(formTemplate, 'TestForm');
            renderWithTheme(form!);

            expect(screen.getByText('Login Form')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Username')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Password')).toBeInTheDocument();
            expect(screen.getByRole('button')).toBeInTheDocument();
        });
    });

    describe('Convenience Functions', () => {
        test('createAnvilComponent function works correctly', () => {
            const component: AnvilComponent = {
                type: 'Button',
                name: 'convenience_button',
                properties: { text: 'Convenience Test' },
                layout_properties: {}
            };

            const element = createAnvilComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            expect(container.textContent).toBe('Convenience Test');
        });
    });

    describe('Custom Component Handling', () => {
        test('handles dependency components with form:dep_id:ComponentName format', () => {
            const component: AnvilComponent = {
                type: 'form:dep_123:CustomButton',
                name: 'custom_component',
                properties: { text: 'Custom Component' },
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            const customComponent = container.querySelector('.anvil-custom-component');
            expect(customComponent).not.toBeNull();
            expect(container.textContent).toContain('Custom Component: CustomButton');
            expect(customComponent?.getAttribute('data-dep-id')).toBe('dep_123');
        });

        test('handles package components with anvil.ComponentName format', () => {
            const component: AnvilComponent = {
                type: 'anvil.DataGrid',
                name: 'data_grid',
                properties: {},
                layout_properties: {}
            };

            const element = factory.createComponent(component);
            expect(element).not.toBeNull();

            const { container } = render(element!);
            // This should create a custom component placeholder since anvil.DataGrid isn't registered
            const customComponent = container.querySelector('.anvil-custom-component');
            expect(customComponent).not.toBeNull();
            expect(container.textContent).toContain('Custom Component: DataGrid');
        });
    });

    describe('Component Registry', () => {
        test('component registry has basic components registered', () => {
            expect(componentRegistry.hasComponent('Label')).toBe(true);
            expect(componentRegistry.hasComponent('Button')).toBe(true);
            expect(componentRegistry.hasComponent('TextBox')).toBe(true);
            expect(componentRegistry.hasComponent('GridPanel')).toBe(true);
            expect(componentRegistry.hasComponent('ColumnPanel')).toBe(true);
        });

        test('component registry returns registered types', () => {
            const types = componentRegistry.getRegisteredTypes();
            expect(types).toContain('Label');
            expect(types).toContain('Button');
            expect(types).toContain('TextBox');
            expect(types).toContain('GridPanel');
            expect(types).toContain('ColumnPanel');
        });
    });
}); 