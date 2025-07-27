import React from 'react';
import { componentRegistry } from './component-registry';
// Import basic components for backward compatibility
import * as BasicComponents from './basic-components';

// Import enhanced layout components
import {
    HtmlPanel,
    GridPanel,
    ColumnPanel,
    LinearPanel,
    FlowPanel,
    XYPanel
} from './enhanced-layouts';

// Import enhanced form components
import {
    TextBox,
    TextArea,
    RadioButton,
    DropDown,
    NumberBox,
    DatePicker
} from './enhanced-forms';

// Import enhanced display and media components
import {
    Label as EnhancedLabel,
    AnvilImage,
    Plot,
    RichText,
    FileLoader
} from './enhanced-display-media';

// Import enhanced interactive and navigation components
import {
    Button as EnhancedButton,
    Link,
    Timer,
    Notification,
    DataGrid
} from './enhanced-interactive';

// Import form components from basic-components for backward compatibility
const {
    Label: BasicLabel,
    TextBox: BasicTextBox,
    Button,
    CheckBox,
    RepeatingPanel,
    DataRowPanel
} = BasicComponents;

/**
 * Register all built-in Anvil components with the component registry
 */
export function registerBasicComponents(): void {
    // Container Components
    componentRegistry.register('HtmlPanel', {
        component: HtmlPanel,
        defaultProps: {
            className: '',
            style: {}
        },
        propMapping: {
            'html': 'html'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.html && typeof props.html !== 'string') {
                errors.push('html property must be a string');
            }
            return errors;
        }
    });

    componentRegistry.register('GridPanel', {
        component: GridPanel,
        defaultProps: {
            columns: 1,
            gap: '8px'
        },
        propMapping: {
            'spacing': 'gap'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.columns && typeof props.columns !== 'number' && typeof props.columns !== 'string') {
                errors.push('columns property must be a number or string');
            }
            return errors;
        }
    });

    componentRegistry.register('ColumnPanel', {
        component: ColumnPanel,
        defaultProps: {
            spacing: '8px',
            align: 'stretch'
        },
        propMapping: {
            'spacing': 'spacing',
            'align': 'align'
        },
        layoutSupported: true
    });

    componentRegistry.register('FlowPanel', {
        component: FlowPanel,
        defaultProps: {
            direction: 'row',
            wrap: true,
            spacing: '8px'
        },
        propMapping: {
            'spacing': 'spacing',
            'align': 'align',
            'justify': 'justify'
        },
        layoutSupported: true
    });

    // Form Components - Using enhanced versions
    componentRegistry.register('Label', {
        component: EnhancedLabel,
        defaultProps: {
            align: 'left'
        },
        propMapping: {
            'text': 'text',
            'font_size': 'fontSize',
            'font_weight': 'fontWeight',
            'foreground': 'color',
            'align': 'align'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.text && typeof props.text !== 'string') {
                errors.push('text property must be a string');
            }
            return errors;
        }
    });

    // Handle form references (form:component_name pattern)
    // These are references to other forms in the Anvil app
    // Create a form reference component
    const FormReference = ({ type, children, ...props }: any) => {
        const formName = type && typeof type === 'string' ? type.replace('form:', '') : 'unknown';
        return React.createElement('div', {
            className: `anvil-form-reference anvil-form-${formName}`,
            'data-form-reference': formName,
            style: {
                padding: '16px',
                border: '2px dashed #ccc',
                borderRadius: '4px',
                color: '#666',
                textAlign: 'center',
                ...props.style
            }
        }, children && children.length > 0 ? children : `Form Reference: ${formName}`);
    };

    // Register specific form references that appear in the app
    componentRegistry.register('form:left_side_panel', {
        component: FormReference,
        defaultProps: {
            className: 'anvil-form-reference'
        },
        layoutSupported: true
    });

    // Enhanced TextBox registration
    componentRegistry.register('TextBox', {
        component: TextBox,
        defaultProps: {
            text: '',
            enabled: true,
            multiline: false
        },
        propMapping: {
            'text': 'text',
            'placeholder': 'placeholder',
            'enabled': 'enabled',
            'multiline': 'multiline',
            'type': 'type',
            'hide_text': 'type', // Map hide_text to password type
            'validate_regex': 'pattern',
            'max_length': 'maxLength'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.hide_text) {
                // Transform hide_text to password type
                props.type = 'password';
            }
            return errors;
        }
    });

    // TextArea registration
    componentRegistry.register('TextArea', {
        component: TextArea,
        defaultProps: {
            text: '',
            enabled: true,
            rows: 3,
            autoResize: true
        },
        propMapping: {
            'text': 'text',
            'placeholder': 'placeholder',
            'enabled': 'enabled',
            'rows': 'rows',
            'auto_expand': 'autoResize'
        },
        layoutSupported: true
    });

    componentRegistry.register('Button', {
        component: EnhancedButton,
        defaultProps: {
            enabled: true,
            role: 'primary-color',
            variant: 'contained',
            size: 'medium',
            loading: false
        },
        propMapping: {
            'text': 'text',
            'enabled': 'enabled',
            'role': 'role',
            'icon': 'icon',
            'icon_align': 'iconAlign',
            'variant': 'variant',
            'size': 'size',
            'loading': 'loading',
            'loading_text': 'loadingText',
            'click': 'onClick'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.text && typeof props.text !== 'string') {
                errors.push('text property must be a string');
            }
            if (props.enabled && typeof props.enabled !== 'boolean') {
                errors.push('enabled property must be a boolean');
            }
            if (props.role && !['primary-color', 'secondary-color', 'raised', 'filled', 'outlined', 'filled-button', 'outlined-button'].includes(props.role)) {
                errors.push('role must be one of: primary-color, secondary-color, raised, filled, outlined, filled-button, outlined-button');
            }
            if (props.variant && !['contained', 'outlined', 'text'].includes(props.variant)) {
                errors.push('variant must be one of: contained, outlined, text');
            }
            if (props.size && !['small', 'medium', 'large'].includes(props.size)) {
                errors.push('size must be one of: small, medium, large');
            }
            return errors;
        }
    });

    componentRegistry.register('CheckBox', {
        component: CheckBox,
        defaultProps: {
            checked: false,
            enabled: true
        },
        propMapping: {
            'checked': 'checked',
            'text': 'text',
            'enabled': 'enabled'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.checked && typeof props.checked !== 'boolean') {
                errors.push('checked property must be a boolean');
            }
            if (props.enabled && typeof props.enabled !== 'boolean') {
                errors.push('enabled property must be a boolean');
            }
            return errors;
        }
    });

    // Data Components
    componentRegistry.register('RepeatingPanel', {
        component: RepeatingPanel,
        defaultProps: {
            items: []
        },
        propMapping: {
            'items': 'items',
            'item_template': 'itemTemplate'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.items && !Array.isArray(props.items)) {
                errors.push('items property must be an array');
            }
            return errors;
        }
    });

    componentRegistry.register('DataRowPanel', {
        component: DataRowPanel,
        defaultProps: {
            selected: false
        },
        propMapping: {
            'selected': 'selected'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.selected && typeof props.selected !== 'boolean') {
                errors.push('selected property must be a boolean');
            }
            return errors;
        }
    });

    // Register LinearPanel with proper implementation
    componentRegistry.register('LinearPanel', {
        component: LinearPanel,
        defaultProps: {
            orientation: 'vertical',
            spacing: 'medium',
            align: 'stretch'
        },
        propMapping: {
            'orientation': 'orientation',
            'spacing': 'spacing',
            'align': 'align',
            'justify': 'justify'
        },
        layoutSupported: true
    });

    // Register XYPanel for absolute positioning
    componentRegistry.register('XYPanel', {
        component: XYPanel,
        defaultProps: {
            width: '100%',
            height: '400px'
        },
        propMapping: {
            'width': 'width',
            'height': 'height'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            // XYPanel specific validation can be added here
            return errors;
        }
    });

    // RadioButton registration
    componentRegistry.register('RadioButton', {
        component: RadioButton,
        defaultProps: {
            text: '',
            checked: false,
            enabled: true
        },
        propMapping: {
            'text': 'text',
            'selected': 'checked',
            'enabled': 'enabled',
            'group_name': 'groupName',
            'value': 'value'
        },
        layoutSupported: true
    });

    // DropDown registration
    componentRegistry.register('DropDown', {
        component: DropDown,
        defaultProps: {
            items: [],
            selectedValue: null,
            enabled: true,
            includeBlank: true
        },
        propMapping: {
            'items': 'items',
            'selected_value': 'selectedValue',
            'placeholder': 'placeholder',
            'enabled': 'enabled',
            'include_placeholder': 'includeBlank'
        },
        layoutSupported: true
    });

    // NumberBox registration (custom component)
    componentRegistry.register('NumberBox', {
        component: NumberBox,
        defaultProps: {
            value: null,
            enabled: true,
            step: 1
        },
        propMapping: {
            'value': 'value',
            'minimum': 'min',
            'maximum': 'max',
            'step': 'step',
            'format': 'decimalPlaces',
            'enabled': 'enabled'
        },
        layoutSupported: true
    });

    // DatePicker registration
    componentRegistry.register('DatePicker', {
        component: DatePicker,
        defaultProps: {
            date: null,
            enabled: true
        },
        propMapping: {
            'date': 'date',
            'format': 'format',
            'min_date': 'minDate',
            'max_date': 'maxDate',
            'enabled': 'enabled',
            'placeholder': 'placeholder'
        },
        layoutSupported: true
    });

    // Create a form template container
    componentRegistry.register('FormTemplate', {
        component: HtmlPanel,
        defaultProps: {
            className: 'anvil-form-template',
            style: {
                width: '100%',
                minHeight: '100vh',
                padding: '16px'
            }
        },
        layoutSupported: true
    });

    // HtmlTemplate - maps to HtmlPanel for HTML content containers
    componentRegistry.register('HtmlTemplate', {
        component: HtmlPanel,
        defaultProps: {
            className: 'anvil-html-template',
            style: {}
        },
        propMapping: {
            'html': 'html',
            'properties': 'properties'
        },
        layoutSupported: true
    });

    // Display and Media Components - Enhanced versions
    componentRegistry.register('Image', {
        component: AnvilImage,
        defaultProps: {
            display_mode: 'original_size',
            horizontal_align: 'left',
            vertical_align: 'top'
        },
        propMapping: {
            'source': 'source',
            'height': 'height',
            'width': 'width',
            'display_mode': 'display_mode',
            'horizontal_align': 'horizontal_align',
            'vertical_align': 'vertical_align'
        },
        layoutSupported: true
    });

    componentRegistry.register('Plot', {
        component: Plot,
        defaultProps: {
            height: 400
        },
        propMapping: {
            'figure': 'figure',
            'layout': 'layout',
            'data': 'data',
            'config': 'config'
        },
        layoutSupported: true
    });

    componentRegistry.register('RichText', {
        component: RichText,
        defaultProps: {
            enabled: true,
            format: 'html'
        },
        propMapping: {
            'content': 'content',
            'placeholder': 'placeholder',
            'enabled': 'enabled',
            'format': 'format'
        },
        layoutSupported: true
    });

    componentRegistry.register('FileLoader', {
        component: FileLoader,
        defaultProps: {
            multiple: false,
            align: 'center'
        },
        propMapping: {
            'file': 'file',
            'multiple': 'multiple',
            'file_types': 'file_types',
            'placeholder': 'placeholder'
        },
        layoutSupported: true
    });

    // Interactive and Navigation Components
    componentRegistry.register('Link', {
        component: Link,
        defaultProps: {
            target: '_self',
            underline: 'hover',
            navigate: false
        },
        propMapping: {
            'text': 'text',
            'url': 'url',
            'target': 'target',
            'form_name': 'formName',
            'navigate': 'navigate',
            'underline': 'underline'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.target && !['_blank', '_self', '_parent', '_top'].includes(props.target)) {
                errors.push('target must be one of: _blank, _self, _parent, _top');
            }
            if (props.underline && !['none', 'hover', 'always'].includes(props.underline)) {
                errors.push('underline must be one of: none, hover, always');
            }
            return errors;
        }
    });

    componentRegistry.register('Timer', {
        component: Timer,
        defaultProps: {
            interval: 1000,
            enabled: true,
            autoStart: false
        },
        propMapping: {
            'interval': 'interval',
            'enabled': 'enabled',
            'auto_start': 'autoStart'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.interval && (typeof props.interval !== 'number' || props.interval <= 0)) {
                errors.push('interval must be a positive number');
            }
            return errors;
        }
    });

    componentRegistry.register('Notification', {
        component: Notification,
        defaultProps: {
            type: 'info',
            dismissible: true,
            autoHide: false,
            duration: 5000,
            position: 'top-right'
        },
        propMapping: {
            'type': 'type',
            'title': 'title',
            'message': 'message',
            'dismissible': 'dismissible',
            'auto_hide': 'autoHide',
            'duration': 'duration',
            'position': 'position'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.type && !['info', 'success', 'warning', 'error'].includes(props.type)) {
                errors.push('type must be one of: info, success, warning, error');
            }
            if (props.position && !['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'].includes(props.position)) {
                errors.push('position must be one of: top-left, top-center, top-right, bottom-left, bottom-center, bottom-right');
            }
            return errors;
        }
    });

    componentRegistry.register('DataGrid', {
        component: DataGrid,
        defaultProps: {
            columns: [],
            rows: [],
            selectedRows: [],
            sortOrder: 'asc',
            filterable: false,
            paginated: false,
            pageSize: 10,
            currentPage: 1
        },
        propMapping: {
            'columns': 'columns',
            'rows': 'rows',
            'selected_rows': 'selectedRows',
            'sort_by': 'sortBy',
            'sort_order': 'sortOrder',
            'filterable': 'filterable',
            'paginated': 'paginated',
            'page_size': 'pageSize',
            'current_page': 'currentPage'
        },
        layoutSupported: true,
        validation: (props) => {
            const errors: string[] = [];
            if (props.columns && !Array.isArray(props.columns)) {
                errors.push('columns must be an array');
            }
            if (props.rows && !Array.isArray(props.rows)) {
                errors.push('rows must be an array');
            }
            if (props.sortOrder && !['asc', 'desc'].includes(props.sortOrder)) {
                errors.push('sortOrder must be one of: asc, desc');
            }
            return errors;
        }
    });
}

/**
 * Get a list of all registered component types
 */
export function getRegisteredComponentTypes(): string[] {
    return componentRegistry.getRegisteredTypes();
}

/**
 * Check if a component type is supported
 */
export function isComponentSupported(type: string): boolean {
    return componentRegistry.hasComponent(type);
}

// Auto-register components when this module is imported
registerBasicComponents(); 