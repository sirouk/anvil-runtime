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

// Import form components from basic-components
const {
    Label,
    TextBox: BasicTextBox,
    Button,
    CheckBox,
    RepeatingPanel,
    DataRowPanel
} = BasicComponents;

// Import enhanced form components
import {
    TextBox,
    TextArea,
    RadioButton,
    DropDown,
    NumberBox,
    DatePicker
} from './enhanced-forms';

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
        component: Label,
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
        component: Button,
        defaultProps: {
            enabled: true,
            role: 'primary'
        },
        propMapping: {
            'text': 'text',
            'enabled': 'enabled',
            'role': 'role'
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
            if (props.role && !['primary', 'secondary', 'outlined', 'text'].includes(props.role)) {
                errors.push('role must be one of: primary, secondary, outlined, text');
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