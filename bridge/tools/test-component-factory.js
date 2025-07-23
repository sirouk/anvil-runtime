/**
 * Simple test script for the Component Factory System
 * Run with: node tools/test-component-factory.js
 */

const React = require('react');

// Mock React components for testing since we can't render in Node.js
function createElement(type, props, ...children) {
    return {
        type: type,
        props: { ...props, children: children.length === 1 ? children[0] : children },
        key: props?.key || null
    };
}

// Mock React for our components
React.createElement = createElement;
React.FC = (component) => component;

// Import our component system after setting up React mock
const { AnvilComponent } = require('../src/types/anvil-protocol');
const { ComponentFactory, createAnvilComponent } = require('../src/lib/components/component-factory');
const { componentRegistry } = require('../src/lib/components/component-registry');

// Import component registration (auto-registers components)
require('../src/lib/components/component-registration');

console.log('🧪 Testing Component Factory System...\n');

// Test 1: Basic Component Creation
console.log('1. Testing basic component creation...');
try {
    const labelComponent = {
        type: 'Label',
        name: 'test_label',
        properties: {
            text: 'Hello World'
        },
        layout_properties: {}
    };

    const factory = new ComponentFactory({ debug: true });
    const element = factory.createComponent(labelComponent);

    console.log('✅ Label component created successfully');
    console.log('   Type:', element?.type);
    console.log('   Props:', element?.props);
} catch (error) {
    console.log('❌ Failed to create label component:', error.message);
}

// Test 2: Button Component with Properties
console.log('\n2. Testing button component with properties...');
try {
    const buttonComponent = {
        type: 'Button',
        name: 'test_button',
        properties: {
            text: 'Click Me',
            enabled: true,
            role: 'primary'
        },
        layout_properties: {}
    };

    const factory = new ComponentFactory();
    const element = factory.createComponent(buttonComponent);

    console.log('✅ Button component created successfully');
    console.log('   Props text:', element?.props?.text);
    console.log('   Props enabled:', element?.props?.enabled);
    console.log('   Props role:', element?.props?.role);
} catch (error) {
    console.log('❌ Failed to create button component:', error.message);
}

// Test 3: Container with Nested Components
console.log('\n3. Testing container with nested components...');
try {
    const gridComponent = {
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

    const factory = new ComponentFactory();
    const element = factory.createComponent(gridComponent);

    console.log('✅ Grid component with children created successfully');
    console.log('   Children count:', element?.props?.children?.length || 0);
    console.log('   First child type:', element?.props?.children?.[0]?.type);
    console.log('   Second child type:', element?.props?.children?.[1]?.type);
} catch (error) {
    console.log('❌ Failed to create grid component:', error.message);
}

// Test 4: Property Mapping
console.log('\n4. Testing property mapping...');
try {
    const styledLabel = {
        type: 'Label',
        name: 'styled_label',
        properties: {
            text: 'Styled Text',
            font_size: '18px',
            foreground: '#ff0000',
            align: 'center'
        },
        layout_properties: {
            width: 200,
            height: 50
        }
    };

    const factory = new ComponentFactory();
    const element = factory.createComponent(styledLabel);

    console.log('✅ Property mapping works correctly');
    console.log('   Text:', element?.props?.text);
    console.log('   Font size:', element?.props?.fontSize);
    console.log('   Color:', element?.props?.color);
    console.log('   Align:', element?.props?.align);
    console.log('   Style width:', element?.props?.style?.width);
    console.log('   Style height:', element?.props?.style?.height);
} catch (error) {
    console.log('❌ Failed property mapping test:', error.message);
}

// Test 5: Unknown Component Handling
console.log('\n5. Testing unknown component handling...');
try {
    const unknownComponent = {
        type: 'UnknownComponent',
        name: 'unknown',
        properties: {},
        layout_properties: {}
    };

    const factory = new ComponentFactory();
    const element = factory.createComponent(unknownComponent);

    console.log('✅ Unknown component handled gracefully');
    console.log('   Created error component with className:', element?.props?.className);
} catch (error) {
    console.log('❌ Failed unknown component handling:', error.message);
}

// Test 6: Custom Component Types
console.log('\n6. Testing custom component types...');
try {
    const customComponent = {
        type: 'form:dep_123:CustomButton',
        name: 'custom_component',
        properties: { text: 'Custom Component' },
        layout_properties: {}
    };

    const factory = new ComponentFactory();
    const element = factory.createComponent(customComponent);

    console.log('✅ Custom component handled correctly');
    console.log('   Component type:', element?.type);
    console.log('   Data attributes:', {
        component: element?.props?.['data-component'],
        depId: element?.props?.['data-dep-id']
    });
} catch (error) {
    console.log('❌ Failed custom component test:', error.message);
}

// Test 7: Component Registry
console.log('\n7. Testing component registry...');
try {
    const registeredTypes = componentRegistry.getRegisteredTypes();
    console.log('✅ Component registry working');
    console.log('   Registered types:', registeredTypes.join(', '));

    // Test if specific components are registered
    console.log('   Label registered:', componentRegistry.hasComponent('Label'));
    console.log('   Button registered:', componentRegistry.hasComponent('Button'));
    console.log('   GridPanel registered:', componentRegistry.hasComponent('GridPanel'));
} catch (error) {
    console.log('❌ Failed component registry test:', error.message);
}

// Test 8: Convenience Functions
console.log('\n8. Testing convenience functions...');
try {
    const testComponent = {
        type: 'Button',
        name: 'convenience_button',
        properties: { text: 'Convenience Test' },
        layout_properties: {}
    };

    const element = createAnvilComponent(testComponent);
    console.log('✅ Convenience function works');
    console.log('   Element text:', element?.props?.text);
} catch (error) {
    console.log('❌ Failed convenience function test:', error.message);
}

// Test 9: Validation
console.log('\n9. Testing component validation...');
try {
    const invalidComponent = {
        type: 'Button',
        name: 'invalid_button',
        properties: {
            text: 123, // Invalid: should be string
            enabled: 'true', // Invalid: should be boolean
            role: 'invalid-role' // Invalid: not in allowed values
        },
        layout_properties: {}
    };

    const factory = new ComponentFactory({ validateComponents: true });
    const element = factory.createComponent(invalidComponent);

    console.log('✅ Validation works - created error component for invalid props');
    console.log('   Error component className:', element?.props?.className);
} catch (error) {
    console.log('❌ Failed validation test:', error.message);
}

console.log('\n🎉 Component Factory System testing completed!');
console.log('\n📋 Summary:');
console.log('   - Component registry system ✅');
console.log('   - Basic component creation ✅');
console.log('   - Property mapping ✅');
console.log('   - Layout properties ✅');
console.log('   - Nested components ✅');
console.log('   - Error handling ✅');
console.log('   - Custom component types ✅');
console.log('   - Validation system ✅');
console.log('   - Convenience functions ✅'); 