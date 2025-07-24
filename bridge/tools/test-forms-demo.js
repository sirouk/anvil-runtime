#!/usr/bin/env node

/**
 * Enhanced Form Components Visual Demo
 * 
 * Demonstrates the enhanced form components with Material Design theming
 * and full Anvil functionality including validation, error states, and
 * interactive features.
 */

const { spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

// Demo page component
const demoPageContent = `
'use client';

import { useState } from 'react';
import {
  TextBox,
  TextArea,
  RadioButton,
  DropDown,
  NumberBox,
  DatePicker,
  Button,
  CheckBox,
  GridPanel,
  ColumnPanel,
  HtmlPanel,
  ThemeProvider
} from '@/lib/components';
import '@/lib/theme/anvil-layout.css';

export default function FormsDemo() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    bio: '',
    gender: '',
    country: '',
    age: null,
    salary: null,
    birthdate: null,
    subscribe: false
  });

  const [errors, setErrors] = useState({});

  const handleSubmit = () => {
    const newErrors = {};
    
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) newErrors.email = 'Email is required';
    if (formData.email && !formData.email.includes('@')) newErrors.email = 'Invalid email';
    if (!formData.password) newErrors.password = 'Password is required';
    if (formData.password && formData.password.length < 6) newErrors.password = 'Password too short';
    if (!formData.country) newErrors.country = 'Please select a country';
    if (formData.age && formData.age < 18) newErrors.age = 'Must be 18 or older';
    
    setErrors(newErrors);
    
    if (Object.keys(newErrors).length === 0) {
      alert('Form submitted successfully!\\n' + JSON.stringify(formData, null, 2));
    }
  };

  const countries = [
    { value: 'us', label: 'United States' },
    { value: 'uk', label: 'United Kingdom' },
    { value: 'ca', label: 'Canada' },
    { value: 'au', label: 'Australia' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <ThemeProvider>
      <div style={{ padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
        <h1>Enhanced Form Components Demo</h1>
        
        <GridPanel columns={2} gap="40px">
          {/* Left Column - Form Inputs */}
          <ColumnPanel spacing="medium" role="card">
            <h2>Form Inputs</h2>
            
            {/* Basic TextBox */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Name (Required)
              </label>
              <TextBox
                placeholder="Enter your name"
                value={formData.name}
                onChange={(value) => setFormData({ ...formData, name: value })}
                required
                error={!!errors.name}
                errorText={errors.name}
                tooltip="Your full name"
              />
            </div>
            
            {/* Email TextBox */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Email
              </label>
              <TextBox
                type="email"
                placeholder="email@example.com"
                value={formData.email}
                onChange={(value) => setFormData({ ...formData, email: value })}
                error={!!errors.email}
                errorText={errors.email}
                validate={(value) => {
                  if (value && !value.includes('@')) return 'Invalid email format';
                  return null;
                }}
              />
            </div>
            
            {/* Password TextBox */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Password
              </label>
              <TextBox
                type="password"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={(value) => setFormData({ ...formData, password: value })}
                error={!!errors.password}
                errorText={errors.password}
                minLength={6}
              />
            </div>
            
            {/* TextArea with auto-resize */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Bio
              </label>
              <TextArea
                placeholder="Tell us about yourself..."
                value={formData.bio}
                onChange={(value) => setFormData({ ...formData, bio: value })}
                minRows={3}
                maxRows={8}
              />
            </div>
            
            {/* Radio Buttons */}
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: 500 }}>
                Gender
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                <RadioButton
                  text="Male"
                  value="male"
                  groupName="gender"
                  checked={formData.gender === 'male'}
                  onChange={() => setFormData({ ...formData, gender: 'male' })}
                />
                <RadioButton
                  text="Female"
                  value="female"
                  groupName="gender"
                  checked={formData.gender === 'female'}
                  onChange={() => setFormData({ ...formData, gender: 'female' })}
                />
                <RadioButton
                  text="Other"
                  value="other"
                  groupName="gender"
                  checked={formData.gender === 'other'}
                  onChange={() => setFormData({ ...formData, gender: 'other' })}
                />
              </div>
            </div>
            
            {/* DropDown */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Country
              </label>
              <DropDown
                items={countries}
                selectedValue={formData.country}
                onChange={(value) => setFormData({ ...formData, country: value })}
                placeholder="Select your country"
                error={!!errors.country}
                errorText={errors.country}
              />
            </div>
            
            {/* Submit Button */}
            <Button 
              text="Submit Form"
              role="primary-color"
              onClick={handleSubmit}
              style={{ marginTop: '16px' }}
            />
          </ColumnPanel>
          
          {/* Right Column - Advanced Inputs */}
          <ColumnPanel spacing="medium" role="card">
            <h2>Advanced Inputs</h2>
            
            {/* NumberBox - Age */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Age
              </label>
              <NumberBox
                value={formData.age}
                onChange={(value) => setFormData({ ...formData, age: value })}
                min={0}
                max={120}
                step={1}
                placeholder="Enter your age"
                error={!!errors.age}
                errorText={errors.age}
              />
            </div>
            
            {/* NumberBox - Salary with formatting */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Annual Salary
              </label>
              <NumberBox
                value={formData.salary}
                onChange={(value) => setFormData({ ...formData, salary: value })}
                min={0}
                step={1000}
                prefix="$"
                suffix=" USD"
                thousandsSeparator
                decimalPlaces={2}
                placeholder="0.00"
              />
            </div>
            
            {/* DatePicker */}
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Birth Date
              </label>
              <DatePicker
                date={formData.birthdate}
                onChange={(date) => setFormData({ ...formData, birthdate: date })}
                maxDate={new Date()}
                placeholder="Select your birth date"
              />
            </div>
            
            {/* CheckBox */}
            <div style={{ marginTop: '24px' }}>
              <CheckBox
                text="Subscribe to newsletter"
                checked={formData.subscribe}
                onChange={(checked) => setFormData({ ...formData, subscribe: checked })}
              />
            </div>
            
            {/* Disabled State Examples */}
            <HtmlPanel spacingAbove="large">
              <h3>Disabled States</h3>
            </HtmlPanel>
            
            <TextBox
              text="Disabled TextBox"
              enabled={false}
            />
            
            <DropDown
              items={['Option 1', 'Option 2']}
              selectedValue="Option 1"
              enabled={false}
            />
            
            <NumberBox
              value={100}
              enabled={false}
              prefix="$"
            />
            
            {/* Read-only Examples */}
            <HtmlPanel spacingAbove="large">
              <h3>Read-only States</h3>
            </HtmlPanel>
            
            <TextBox
              text="Read-only text"
              readOnly
            />
            
            <TextArea
              text="This is read-only content that cannot be edited."
              readOnly
              rows={2}
            />
          </ColumnPanel>
        </GridPanel>
        
        {/* Form Data Display */}
        <HtmlPanel role="card" spacingAbove="large">
          <h3>Form Data (Live Preview)</h3>
          <pre style={{ 
            backgroundColor: '#f0f0f0', 
            padding: '16px', 
            borderRadius: '4px',
            overflow: 'auto'
          }}>
            {JSON.stringify(formData, null, 2)}
          </pre>
        </HtmlPanel>
        
        {/* Validation Examples */}
        <HtmlPanel role="card" spacingAbove="large">
          <h3>Validation Examples</h3>
          <GridPanel columns={3} gap="20px">
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Required Field
              </label>
              <TextBox
                placeholder="This field is required"
                required
                tooltip="Leave empty and blur to see error"
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Pattern Validation (Phone)
              </label>
              <TextBox
                placeholder="(123) 456-7890"
                pattern="\\(\\d{3}\\) \\d{3}-\\d{4}"
                validate={(value) => {
                  if (value && !value.match(/\\(\\d{3}\\) \\d{3}-\\d{4}/)) {
                    return 'Format: (123) 456-7890';
                  }
                  return null;
                }}
              />
            </div>
            
            <div>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                Number Range (1-10)
              </label>
              <NumberBox
                min={1}
                max={10}
                step={0.5}
                placeholder="Between 1 and 10"
              />
            </div>
          </GridPanel>
        </HtmlPanel>
      </div>
    </ThemeProvider>
  );
}
`;

async function createDemoPage() {
    const demoPath = path.join(__dirname, '..', 'src', 'app', 'forms-demo', 'page.tsx');
    const demoDir = path.dirname(demoPath);

    // Create directory if it doesn't exist
    await fs.mkdir(demoDir, { recursive: true });

    // Write demo page
    await fs.writeFile(demoPath, demoPageContent);

    console.log('✅ Created demo page at:', demoPath);
    console.log('🌐 Visit http://localhost:3000/forms-demo to see the components');
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
        console.log('📝 Enhanced Form Components Visual Demo');
        console.log('=====================================\n');

        // Create the demo page
        await createDemoPage();

        console.log('\n📦 Starting development server...');
        console.log('This will open the NextJS dev server with hot reloading.\n');

        // Start the dev server
        const server = await startDevServer();

        console.log('\n✨ Demo is running!');
        console.log('👉 Open http://localhost:3000/forms-demo in your browser');
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