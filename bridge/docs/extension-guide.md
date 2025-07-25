# Extension Guide: Custom Component Development

A comprehensive guide for extending the Anvil-to-NextJS Bridge with custom components, advanced patterns, and third-party integrations.

## 🎯 Overview

The Universal Bridge is designed to be highly extensible, allowing developers to:
- **Create custom React components** that integrate seamlessly with Anvil's system
- **Extend existing components** with additional functionality
- **Build reusable component libraries** for teams and organizations
- **Integrate third-party libraries** while maintaining Anvil compatibility

## 🏗️ Architecture Overview

### Component System Structure

```
Bridge Component System
├── Core Components (built-in)
│   ├── Enhanced Forms (TextBox, Button, etc.)
│   ├── Enhanced Layouts (GridPanel, ColumnPanel, etc.)
│   ├── Enhanced Display (Label, Image, Plot)
│   └── Enhanced Interactive (DataGrid, Timer, etc.)
├── Custom Components (your extensions)
│   ├── Business Logic Components
│   ├── Third-party Integrations
│   └── Specialized UI Elements
└── Registration System
    ├── Component Registry
    ├── Property Mapping
    └── Event System Integration
```

### Component Lifecycle

```typescript
// 1. Component Creation
const MyComponent = ({ prop1, prop2, ...anvilProps }) => { ... };

// 2. Registration
registerAnvilComponent('MyComponent', MyComponent, {
  props: ['prop1', 'prop2'],
  events: ['click', 'change'],
  validation: { ... }
});

// 3. YAML Integration
// In form_template.yaml:
// - type: MyComponent
//   properties: { prop1: 'value', prop2: 'data' }

// 4. Runtime Instantiation
// Bridge automatically creates React components from YAML
```

## 🚀 Quick Start: Your First Custom Component

### Step 1: Create Component File

Create `src/components/custom/HelloWorldComponent.tsx`:

```typescript
import React from 'react';
import { AnvilComponentProps } from '@/lib/components/types';

interface HelloWorldProps extends AnvilComponentProps {
  message: string;
  color: string;
  onClick?: () => void;
}

export const HelloWorldComponent: React.FC<HelloWorldProps> = ({ 
  message, 
  color = '#000000',
  onClick,
  ...anvilProps 
}) => {
  return (
    <div 
      className="anvil-hello-world"
      style={{ 
        color,
        padding: '16px',
        border: '1px solid #ddd',
        borderRadius: '4px',
        cursor: onClick ? 'pointer' : 'default'
      }}
      onClick={onClick}
      {...anvilProps}
    >
      {message || 'Hello, World!'}
    </div>
  );
};

export default HelloWorldComponent;
```

### Step 2: Register Component

Add to `src/lib/components/component-registration.ts`:

```typescript
import { HelloWorldComponent } from '@/components/custom/HelloWorldComponent';
import { registerAnvilComponent } from './component-registry';

// Register the custom component
registerAnvilComponent('HelloWorldComponent', HelloWorldComponent, {
  props: ['message', 'color'],
  events: ['click'],
  category: 'custom',
  description: 'A simple hello world component'
});
```

### Step 3: Use in Anvil YAML

In your `form_template.yaml`:

```yaml
- type: HelloWorldComponent
  properties:
    name: my_hello_component
    message: "Welcome to my custom component!"
    color: "#007bff"
  event_bindings:
    click: "self.hello_click"
```

### Step 4: Handle Events in Python

In your form's Python code:

```python
def hello_click(self, **event_args):
    alert("Custom component clicked!")
```

## 📋 Component Development Patterns

### 1. Form Input Components

Create components that integrate with Anvil's form system:

```typescript
// src/components/custom/ColorPicker.tsx
import React, { useState, useEffect } from 'react';
import { AnvilComponentProps } from '@/lib/components/types';

interface ColorPickerProps extends AnvilComponentProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({
  value = '#000000',
  onChange,
  disabled = false,
  label,
  ...anvilProps
}) => {
  const [color, setColor] = useState(value);

  useEffect(() => {
    setColor(value);
  }, [value]);

  const handleChange = (newColor: string) => {
    setColor(newColor);
    onChange?.(newColor);
  };

  return (
    <div className="anvil-color-picker" {...anvilProps}>
      {label && <label className="anvil-label">{label}</label>}
      <input
        type="color"
        value={color}
        onChange={(e) => handleChange(e.target.value)}
        disabled={disabled}
        className="anvil-color-input"
      />
      <span className="anvil-color-value">{color}</span>
    </div>
  );
};

// Registration
registerAnvilComponent('ColorPicker', ColorPicker, {
  props: ['value', 'disabled', 'label'],
  events: ['change'],
  category: 'inputs',
  defaultValue: '#000000'
});
```

### 2. Data Display Components

Components that present data in specialized formats:

```typescript
// src/components/custom/ProgressBar.tsx
import React from 'react';
import { AnvilComponentProps } from '@/lib/components/types';

interface ProgressBarProps extends AnvilComponentProps {
  value: number; // 0-100
  max?: number;
  color?: string;
  showText?: boolean;
  animated?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value = 0,
  max = 100,
  color = '#007bff',
  showText = true,
  animated = false,
  ...anvilProps
}) => {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className="anvil-progress-container" {...anvilProps}>
      <div 
        className="anvil-progress-bar"
        style={{
          width: '100%',
          height: '24px',
          backgroundColor: '#e9ecef',
          borderRadius: '4px',
          overflow: 'hidden'
        }}
      >
        <div
          className={`anvil-progress-fill ${animated ? 'animated' : ''}`}
          style={{
            width: `${percentage}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.3s ease'
          }}
        />
      </div>
      {showText && (
        <div className="anvil-progress-text">
          {Math.round(percentage)}%
        </div>
      )}
    </div>
  );
};

// Registration
registerAnvilComponent('ProgressBar', ProgressBar, {
  props: ['value', 'max', 'color', 'showText', 'animated'],
  events: [],
  category: 'display'
});
```

### 3. Layout Components

Advanced layout and container components:

```typescript
// src/components/custom/CardLayout.tsx
import React from 'react';
import { AnvilComponentProps } from '@/lib/components/types';

interface CardLayoutProps extends AnvilComponentProps {
  title?: string;
  subtitle?: string;
  elevation?: number; // 0-5
  clickable?: boolean;
  children?: React.ReactNode;
  onClick?: () => void;
}

export const CardLayout: React.FC<CardLayoutProps> = ({
  title,
  subtitle,
  elevation = 1,
  clickable = false,
  children,
  onClick,
  ...anvilProps
}) => {
  const boxShadows = [
    'none',
    '0 1px 3px rgba(0,0,0,0.12)',
    '0 3px 6px rgba(0,0,0,0.16)',
    '0 6px 12px rgba(0,0,0,0.19)',
    '0 10px 20px rgba(0,0,0,0.25)',
    '0 15px 30px rgba(0,0,0,0.35)'
  ];

  return (
    <div 
      className={`anvil-card ${clickable ? 'clickable' : ''}`}
      style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: boxShadows[elevation] || boxShadows[1],
        cursor: clickable ? 'pointer' : 'default',
        overflow: 'hidden',
        transition: 'box-shadow 0.2s ease'
      }}
      onClick={clickable ? onClick : undefined}
      {...anvilProps}
    >
      {(title || subtitle) && (
        <div className="anvil-card-header" style={{ padding: '16px' }}>
          {title && <h3 className="anvil-card-title">{title}</h3>}
          {subtitle && <p className="anvil-card-subtitle">{subtitle}</p>}
        </div>
      )}
      <div className="anvil-card-content" style={{ padding: '16px' }}>
        {children}
      </div>
    </div>
  );
};

// Registration
registerAnvilComponent('CardLayout', CardLayout, {
  props: ['title', 'subtitle', 'elevation', 'clickable'],
  events: ['click'],
  category: 'layout',
  container: true // Indicates this component can contain others
});
```

## 🔧 Advanced Component Features

### 1. State Management Integration

Components that integrate with Anvil's state system:

```typescript
// src/components/custom/StatefulCounter.tsx
import React from 'react';
import { useAnvilState } from '@/lib/state';
import { AnvilComponentProps } from '@/lib/components/types';

interface StatefulCounterProps extends AnvilComponentProps {
  initialValue?: number;
  step?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
}

export const StatefulCounter: React.FC<StatefulCounterProps> = ({
  initialValue = 0,
  step = 1,
  min = Number.MIN_SAFE_INTEGER,
  max = Number.MAX_SAFE_INTEGER,
  onChange,
  name,
  ...anvilProps
}) => {
  // Integrate with Anvil's state system
  const [count, setCount] = useAnvilState(name || 'counter', initialValue);

  const increment = () => {
    const newValue = Math.min(count + step, max);
    setCount(newValue);
    onChange?.(newValue);
  };

  const decrement = () => {
    const newValue = Math.max(count - step, min);
    setCount(newValue);
    onChange?.(newValue);
  };

  return (
    <div className="anvil-counter" {...anvilProps}>
      <button onClick={decrement} disabled={count <= min}>
        -
      </button>
      <span className="anvil-counter-value">{count}</span>
      <button onClick={increment} disabled={count >= max}>
        +
      </button>
    </div>
  );
};

// Registration with state binding
registerAnvilComponent('StatefulCounter', StatefulCounter, {
  props: ['initialValue', 'step', 'min', 'max'],
  events: ['change'],
  stateful: true, // Indicates component uses state
  category: 'interactive'
});
```

### 2. Data-Bound Components

Components that automatically sync with data tables:

```typescript
// src/components/custom/UserAvatar.tsx
import React from 'react';
import { useAnvilTable } from '@/lib/tables';
import { AnvilComponentProps } from '@/lib/components/types';

interface UserAvatarProps extends AnvilComponentProps {
  userId: string;
  size?: 'small' | 'medium' | 'large';
  showName?: boolean;
}

export const UserAvatar: React.FC<UserAvatarProps> = ({
  userId,
  size = 'medium',
  showName = false,
  ...anvilProps
}) => {
  const usersTable = useAnvilTable('users');
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    if (userId) {
      usersTable.get(userId).then(setUser);
    }
  }, [userId, usersTable]);

  const sizes = {
    small: '32px',
    medium: '48px',
    large: '64px'
  };

  if (!user) {
    return <div className="anvil-user-avatar loading">Loading...</div>;
  }

  return (
    <div className="anvil-user-avatar" {...anvilProps}>
      <img
        src={user.avatar_url || '/default-avatar.png'}
        alt={user.name}
        style={{
          width: sizes[size],
          height: sizes[size],
          borderRadius: '50%',
          objectFit: 'cover'
        }}
      />
      {showName && (
        <span className="anvil-user-name">{user.name}</span>
      )}
    </div>
  );
};

// Registration with data binding
registerAnvilComponent('UserAvatar', UserAvatar, {
  props: ['userId', 'size', 'showName'],
  events: [],
  dataBound: true, // Indicates component uses data tables
  category: 'display'
});
```

### 3. Third-Party Library Integration

Wrapping external libraries for Anvil use:

```typescript
// src/components/custom/ChartComponent.tsx
import React from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { AnvilComponentProps } from '@/lib/components/types';

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ChartComponentProps extends AnvilComponentProps {
  data: {
    labels: string[];
    datasets: Array<{
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
    }>;
  };
  title?: string;
  height?: number;
}

export const ChartComponent: React.FC<ChartComponentProps> = ({
  data,
  title,
  height = 300,
  ...anvilProps
}) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: !!title,
        text: title,
      },
    },
  };

  return (
    <div 
      className="anvil-chart"
      style={{ height: `${height}px` }}
      {...anvilProps}
    >
      <Bar data={data} options={options} />
    </div>
  );
};

// Registration for external library
registerAnvilComponent('ChartComponent', ChartComponent, {
  props: ['data', 'title', 'height'],
  events: [],
  category: 'visualization',
  external: ['chart.js', 'react-chartjs-2'] // Track external dependencies
});
```

## 📚 Component Library Development

### Creating Reusable Libraries

Structure for building component libraries:

```
my-anvil-components/
├── src/
│   ├── components/
│   │   ├── index.ts          # Export all components
│   │   ├── forms/            # Form components
│   │   ├── display/          # Display components
│   │   └── layout/           # Layout components
│   ├── styles/
│   │   ├── components.css    # Component styles
│   │   └── themes/           # Theme variations
│   └── utils/
│       ├── registration.ts   # Auto-registration utilities
│       └── helpers.ts        # Component helpers
├── package.json
├── README.md
└── docs/                     # Component documentation
```

### Auto-Registration Pattern

```typescript
// src/utils/registration.ts
import { registerAnvilComponent } from '@anvil-bridge/components';

export interface ComponentMetadata {
  component: React.ComponentType<any>;
  props: string[];
  events: string[];
  category: string;
  description?: string;
  examples?: Array<{
    name: string;
    yaml: string;
    description: string;
  }>;
}

export const createComponentLibrary = (components: Record<string, ComponentMetadata>) => {
  const registerAll = () => {
    Object.entries(components).forEach(([name, metadata]) => {
      registerAnvilComponent(name, metadata.component, metadata);
    });
  };

  const getComponentList = () => {
    return Object.keys(components);
  };

  const getComponentDocs = (componentName: string) => {
    return components[componentName];
  };

  return {
    registerAll,
    getComponentList,
    getComponentDocs
  };
};

// Usage in library
export const MyComponentLibrary = createComponentLibrary({
  'AdvancedDataGrid': {
    component: AdvancedDataGrid,
    props: ['data', 'columns', 'sortable', 'filterable'],
    events: ['rowClick', 'sort', 'filter'],
    category: 'data',
    description: 'Advanced data grid with sorting and filtering',
    examples: [
      {
        name: 'Basic Usage',
        yaml: `
- type: AdvancedDataGrid
  properties:
    data: self.my_data
    sortable: true
        `,
        description: 'Basic data grid with sorting enabled'
      }
    ]
  },
  // ... more components
});
```

## 🎨 Styling and Theming

### Component Styling Best Practices

```typescript
// Use CSS modules for component-specific styles
import styles from './MyComponent.module.css';

export const MyComponent = ({ theme, ...props }) => {
  return (
    <div className={`${styles.container} anvil-component`}>
      <style jsx>{`
        .container {
          --primary-color: ${theme?.primaryColor || '#007bff'};
          --text-color: ${theme?.textColor || '#333'};
        }
      `}</style>
      {/* Component content */}
    </div>
  );
};
```

### Theme Integration

```typescript
// src/hooks/useAnvilTheme.ts
import { useContext } from 'react';
import { ThemeContext } from '@/lib/theme/theme-context';

export const useAnvilTheme = () => {
  const theme = useContext(ThemeContext);
  
  return {
    colors: theme.colors,
    spacing: theme.spacing,
    typography: theme.typography,
    breakpoints: theme.breakpoints,
    // Helper functions
    getPrimaryColor: () => theme.colors.primary,
    getSpacing: (unit: number) => `${theme.spacing.base * unit}px`,
    getBreakpoint: (size: string) => theme.breakpoints[size]
  };
};

// Use in components
export const ThemedButton = ({ variant, children, ...props }) => {
  const theme = useAnvilTheme();
  
  return (
    <button
      style={{
        backgroundColor: theme.getPrimaryColor(),
        padding: theme.getSpacing(2),
        // ... more themed styles
      }}
      {...props}
    >
      {children}
    </button>
  );
};
```

## 🧪 Testing Custom Components

### Unit Testing

```typescript
// tests/components/MyComponent.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from '@/components/custom/MyComponent';
import { AnvilProvider } from '@/lib/providers/AnvilProvider';

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <AnvilProvider>
      {component}
    </AnvilProvider>
  );
};

describe('MyComponent', () => {
  it('renders with default props', () => {
    renderWithProvider(<MyComponent />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    renderWithProvider(<MyComponent onClick={handleClick} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('integrates with Anvil state', () => {
    // Test state integration
  });
});
```

### Integration Testing

```typescript
// tests/integration/CustomComponentIntegration.test.tsx
import { createAnvilApp } from '@/lib/testing/anvil-test-utils';

describe('Custom Component Integration', () => {
  it('renders from YAML configuration', async () => {
    const yaml = `
      - type: MyComponent
        properties:
          message: "Test message"
          color: "#ff0000"
    `;
    
    const app = await createAnvilApp(yaml);
    expect(app.getByText('Test message')).toBeInTheDocument();
  });

  it('communicates with server functions', async () => {
    // Test server integration
  });
});
```

## 📦 Publishing and Distribution

### NPM Package Setup

```json
// package.json for component library
{
  "name": "@yourorg/anvil-components",
  "version": "1.0.0",
  "description": "Custom components for Anvil-NextJS Bridge",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "dist",
    "README.md"
  ],
  "scripts": {
    "build": "tsc && npm run build:styles",
    "build:styles": "postcss src/styles/*.css -d dist/styles",
    "prepublishOnly": "npm run build"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "@anvil-bridge/core": ">=1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Documentation Generation

```typescript
// scripts/generate-docs.ts
import { ComponentMetadata } from '../src/utils/registration';

const generateComponentDocs = (components: Record<string, ComponentMetadata>) => {
  let markdown = '# Component Library Documentation\n\n';
  
  Object.entries(components).forEach(([name, metadata]) => {
    markdown += `## ${name}\n\n`;
    markdown += `${metadata.description}\n\n`;
    markdown += `### Props\n`;
    metadata.props.forEach(prop => {
      markdown += `- \`${prop}\`\n`;
    });
    markdown += `\n### Events\n`;
    metadata.events.forEach(event => {
      markdown += `- \`${event}\`\n`;
    });
    
    if (metadata.examples) {
      markdown += `\n### Examples\n`;
      metadata.examples.forEach(example => {
        markdown += `#### ${example.name}\n`;
        markdown += `${example.description}\n\n`;
        markdown += `\`\`\`yaml\n${example.yaml}\`\`\`\n\n`;
      });
    }
    
    markdown += '\n---\n\n';
  });
  
  return markdown;
};
```

## 🔍 Debugging and Troubleshooting

### Component Development Tools

```typescript
// src/utils/component-debugger.ts
export const ComponentDebugger = {
  logRegistration: (name: string, metadata: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Registered component: ${name}`, metadata);
    }
  },
  
  validateProps: (component: any, props: any) => {
    // Validate component props against schema
  },
  
  traceRender: (componentName: string, props: any) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`Rendering ${componentName}`, props);
    }
  }
};
```

### Common Issues and Solutions

#### 1. Component Not Rendering
```typescript
// Debug registration
console.log('Registered components:', window.__ANVIL_COMPONENTS__);

// Check if component is properly imported
import { MyComponent } from './MyComponent';
console.log('Component:', MyComponent);

// Verify registration syntax
registerAnvilComponent('MyComponent', MyComponent, {
  // Ensure all required fields are present
});
```

#### 2. Props Not Passing Through
```typescript
// Debug props in component
export const MyComponent = (props) => {
  console.log('Received props:', props);
  return <div>...</div>;
};
```

#### 3. Events Not Firing
```typescript
// Check event binding in YAML
// Make sure event names match registration
registerAnvilComponent('MyComponent', MyComponent, {
  events: ['click', 'change'] // Must match YAML event_bindings
});
```

## 🌟 Best Practices

### 1. Performance Optimization
```typescript
// Use React.memo for expensive components
export const ExpensiveComponent = React.memo(({ data, ...props }) => {
  // Expensive rendering logic
}, (prevProps, nextProps) => {
  // Custom comparison function
  return prevProps.data === nextProps.data;
});

// Use useMemo for expensive calculations
const processedData = useMemo(() => {
  return expensiveDataProcessing(rawData);
}, [rawData]);
```

### 2. Accessibility
```typescript
export const AccessibleComponent = ({ label, ...props }) => {
  return (
    <div role="button" aria-label={label} tabIndex={0} {...props}>
      {/* Component content */}
    </div>
  );
};
```

### 3. TypeScript Best Practices
```typescript
// Define strict interfaces
interface StrictComponentProps extends AnvilComponentProps {
  required: string;
  optional?: number;
  callback: (value: string) => void;
}

// Use generic types for reusable components
interface GenericListProps<T> extends AnvilComponentProps {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
}
```

---

## 📞 Community and Support

### Contributing to the Bridge
- **GitHub Repository**: Submit PRs for core improvements
- **Component Gallery**: Share your components with the community
- **Documentation**: Help improve guides and examples

### Getting Help
- **Discord/Slack**: Real-time community support
- **Stack Overflow**: Use tag `anvil-nextjs-bridge`
- **GitHub Issues**: Report bugs and request features

**The extension system makes the Anvil-NextJS Bridge infinitely customizable while maintaining the simplicity that makes Anvil powerful. Build once, use everywhere!** 