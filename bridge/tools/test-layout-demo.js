#!/usr/bin/env node

/**
 * Layout Components Visual Demo
 * 
 * Demonstrates the enhanced layout components with Material Design theming
 * in a NextJS app. Shows responsive grid behavior, theme roles, and all
 * layout containers.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Demo page component
const demoPageContent = `
import {
  HtmlPanel,
  GridPanel,
  ColumnPanel,
  LinearPanel,
  FlowPanel,
  XYPanel,
  Label,
  TextBox,
  Button,
  CheckBox,
  ThemeProvider
} from '@/lib/components';
import '@/lib/theme/anvil-layout.css';

export default function LayoutDemo() {
  return (
    <ThemeProvider>
      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <h1>Anvil Layout Components Demo</h1>
        
        {/* GridPanel with responsive columns */}
        <section style={{ marginBottom: '40px' }}>
          <h2>GridPanel - Responsive Grid System</h2>
          <GridPanel gap="16px" style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px' }}>
            <div 
              style={{ 
                backgroundColor: '#e3f2fd', 
                padding: '20px', 
                borderRadius: '4px',
                gridColumn: 'span 12'
              }}
            >
              Full Width (12 columns)
            </div>
            <div 
              style={{ 
                backgroundColor: '#c5e1a5', 
                padding: '20px', 
                borderRadius: '4px',
                gridColumn: 'span 6'
              }}
            >
              Half Width (6 columns)
            </div>
            <div 
              style={{ 
                backgroundColor: '#ffccbc', 
                padding: '20px', 
                borderRadius: '4px',
                gridColumn: 'span 6'
              }}
            >
              Half Width (6 columns)
            </div>
            <div 
              style={{ 
                backgroundColor: '#d1c4e9', 
                padding: '20px', 
                borderRadius: '4px',
                gridColumn: 'span 4'
              }}
            >
              Third (4 cols)
            </div>
            <div 
              style={{ 
                backgroundColor: '#ffecb3', 
                padding: '20px', 
                borderRadius: '4px',
                gridColumn: 'span 4'
              }}
            >
              Third (4 cols)
            </div>
            <div 
              style={{ 
                backgroundColor: '#b2dfdb', 
                padding: '20px', 
                borderRadius: '4px',
                gridColumn: 'span 4'
              }}
            >
              Third (4 cols)
            </div>
          </GridPanel>
        </section>

        {/* ColumnPanel and LinearPanel */}
        <section style={{ marginBottom: '40px' }}>
          <h2>Column & Linear Panels</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <ColumnPanel 
              spacing="medium" 
              role="card"
              style={{ backgroundColor: 'white' }}
            >
              <Label text="Column Panel (Vertical)" role="headline" />
              <TextBox placeholder="Enter text..." />
              <Button text="Submit" role="primary-color" />
              <CheckBox text="Agree to terms" />
            </ColumnPanel>
            
            <LinearPanel 
              orientation="horizontal" 
              spacing="medium"
              align="center"
              role="card"
              style={{ backgroundColor: 'white' }}
            >
              <Label text="Linear Panel (Horizontal):" />
              <TextBox placeholder="Search..." style={{ flex: 1 }} />
              <Button text="Search" role="secondary-color" />
            </LinearPanel>
          </div>
        </section>

        {/* FlowPanel */}
        <section style={{ marginBottom: '40px' }}>
          <h2>FlowPanel - Wrapping Layout</h2>
          <FlowPanel 
            spacing="medium" 
            role="card"
            style={{ backgroundColor: 'white' }}
          >
            {['React', 'NextJS', 'TypeScript', 'Material Design', 'Anvil', 'Layout', 'Components'].map(tag => (
              <div 
                key={tag}
                style={{
                  backgroundColor: '#e0e0e0',
                  padding: '8px 16px',
                  borderRadius: '16px',
                  fontSize: '14px'
                }}
              >
                {tag}
              </div>
            ))}
          </FlowPanel>
        </section>

        {/* XYPanel */}
        <section style={{ marginBottom: '40px' }}>
          <h2>XYPanel - Absolute Positioning</h2>
          <XYPanel 
            height="300px" 
            role="card"
            style={{ backgroundColor: 'white', position: 'relative' }}
          >
            <div 
              style={{
                position: 'absolute',
                left: '20px',
                top: '20px',
                backgroundColor: '#ffcdd2',
                padding: '10px',
                borderRadius: '4px'
              }}
            >
              Top Left (20, 20)
            </div>
            <div 
              style={{
                position: 'absolute',
                right: '20px',
                top: '20px',
                backgroundColor: '#c8e6c9',
                padding: '10px',
                borderRadius: '4px'
              }}
            >
              Top Right
            </div>
            <div 
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: '#bbdefb',
                padding: '20px',
                borderRadius: '4px'
              }}
            >
              Centered
            </div>
            <div 
              style={{
                position: 'absolute',
                left: '20px',
                bottom: '20px',
                backgroundColor: '#f8bbd0',
                padding: '10px',
                borderRadius: '4px'
              }}
            >
              Bottom Left
            </div>
          </XYPanel>
        </section>

        {/* Theme Roles Demo */}
        <section style={{ marginBottom: '40px' }}>
          <h2>Material Design Theme Roles</h2>
          <GridPanel columns={3} gap="20px">
            <HtmlPanel role="card">
              <h3>Card Role</h3>
              <p>Elevated surface with shadow</p>
            </HtmlPanel>
            <HtmlPanel style={{ padding: '16px' }}>
              <Label text="Headline Role" role="headline" />
              <Label text="Body text role for content" role="body" />
            </HtmlPanel>
            <ColumnPanel spacing="small" style={{ padding: '16px' }}>
              <Button text="Primary" role="primary-color" />
              <Button text="Secondary" role="secondary-color" />
            </ColumnPanel>
          </GridPanel>
        </section>

        {/* Spacing Demo */}
        <section style={{ marginBottom: '40px' }}>
          <h2>Spacing System</h2>
          <ColumnPanel role="card">
            <HtmlPanel spacingBelow="small" style={{ backgroundColor: '#e8f5e9', padding: '10px' }}>
              Small spacing below (8px)
            </HtmlPanel>
            <HtmlPanel spacingBelow="medium" style={{ backgroundColor: '#c8e6c9', padding: '10px' }}>
              Medium spacing below (16px)
            </HtmlPanel>
            <HtmlPanel spacingBelow="large" style={{ backgroundColor: '#a5d6a7', padding: '10px' }}>
              Large spacing below (24px)
            </HtmlPanel>
            <HtmlPanel style={{ backgroundColor: '#81c784', padding: '10px' }}>
              No additional spacing
            </HtmlPanel>
          </ColumnPanel>
        </section>
      </div>
    </ThemeProvider>
  );
}
`;

async function createDemoPage() {
    const demoPath = path.join(__dirname, '..', 'src', 'app', 'layout-demo', 'page.tsx');
    const demoDir = path.dirname(demoPath);

    // Create directory if it doesn't exist
    await fs.mkdir(demoDir, { recursive: true });

    // Write demo page
    await fs.writeFile(demoPath, demoPageContent);

    console.log('✅ Created demo page at:', demoPath);
    console.log('🌐 Visit http://localhost:3000/layout-demo to see the components');
}

async function startDevServer() {
    return new Promise((resolve, reject) => {
        const devServer = spawn('npm', ['run', 'dev'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit',
            shell: true
        });

        devServer.on('error', reject);

        // Give the server time to start
        setTimeout(() => resolve(devServer), 3000);
    });
}

async function main() {
    try {
        console.log('🎨 Anvil Layout Components Visual Demo');
        console.log('=====================================\n');

        // Create the demo page
        await createDemoPage();

        console.log('\n📦 Starting development server...');
        console.log('This will open the NextJS dev server with hot reloading.\n');

        // Start the dev server
        const server = await startDevServer();

        console.log('\n✨ Demo is running!');
        console.log('👉 Open http://localhost:3000/layout-demo in your browser');
        console.log('🔄 Edit the demo page to see live updates');
        console.log('⌨️  Press Ctrl+C to stop the server\n');

        // Handle cleanup
        process.on('SIGINT', () => {
            console.log('\n🛑 Stopping dev server...');
            server.kill();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = { createDemoPage }; 