/**
 * Anvil Component Factory System
 * 
 * This module provides the complete component factory system for converting
 * Anvil YAML component definitions into React components.
 */

// Core component factory system
export {
    ComponentFactory,
    createAnvilComponent,
    createAnvilComponents,
    createAnvilForm
} from './component-factory';

export type {
    ComponentFactoryOptions,
    ComponentContext
} from './component-factory';

// Component registry system
export {
    componentRegistry,
    ComponentValidator,
    PropertyMapper
} from './component-registry';

export type {
    ComponentDefinition
} from './component-registry';

// Basic React components matching Anvil components
export {
    Label,
    // TextBox, // Now exported from enhanced-forms
    Button,
    CheckBox,
    RepeatingPanel,
    DataRowPanel
} from './basic-components';

// Enhanced form components with full Anvil functionality
export {
    TextBox,
    TextArea,
    RadioButton,
    DropDown,
    NumberBox,
    DatePicker,
    type TextBoxProps,
    type TextAreaProps,
    type RadioButtonProps,
    type DropDownProps,
    type DropDownOption,
    type NumberBoxProps,
    type DatePickerProps
} from './enhanced-forms';

// Enhanced layout components with full Anvil behavior
export {
    HtmlPanel,
    GridPanel,
    ColumnPanel,
    LinearPanel,
    FlowPanel,
    XYPanel,
    withGridPosition,
    withXYPosition,
    type AnvilLayoutProps,
    type AnvilGridPosition,
    type XYPosition
} from './enhanced-layouts';

// Theme context and utilities
export {
    ThemeProvider,
    useTheme,
    useThemeConfig,
    generateThemeCSS,
    type Theme,
    type ThemeConfig,
    type ColorScheme
} from '../theme/theme-context';

// Component registration functions
export {
    registerBasicComponents,
    getRegisteredComponentTypes,
    isComponentSupported
} from './component-registration';

// Auto-register basic components when this module is imported
import './component-registration';

/**
 * Default component factory instance for convenience
 */
export { defaultComponentFactory } from './component-factory'; 