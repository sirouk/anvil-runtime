# 👋 Welcome to the Anvil-NextJS Bridge Project!

## Dear Next Developer,

Welcome aboard! You're joining an exciting project that bridges Anvil's cloud development platform with NextJS's modern web capabilities. This document will get you up to speed quickly.

## 🎯 Project Overview

We're building a universal bridge that allows developers to:
- **Build** applications in Anvil's intuitive drag-and-drop cloud IDE
- **Deploy** via NextJS for enhanced performance, SEO, and customization
- **Maintain** full Anvil functionality (server calls, data tables, authentication)

Think of it as giving Anvil apps superpowers - all the ease of Anvil development with the flexibility of NextJS deployment.

## 📊 Current Project Status

### ✅ What's Been Completed
1. **Milestone 1: Research & Foundation** (100%)
   - Complete protocol documentation
   - Local Anvil server setup (TestTodoApp, TestHelloWorld, TestBlank)
   - NextJS project structure with TypeScript

2. **Milestone 2: Communication Proxy** (100%)
   - WebSocket proxy with zero server detection
   - HTTP proxy with file upload/download
   - Session management and authentication
   - Error handling with circuit breakers
   - 100+ tests passing

3. **Milestone 3: Component System** (Partially Complete)
   - ✅ YAML parser for Anvil app definitions
   - ✅ Component factory system
   - ✅ Layout engine (all 6 Anvil containers)
   - ✅ Material Design theming
   - ✅ Basic input components (TextBox, DropDown, etc.)
   - ✅ Display/Media components (Label, Image, Plot, RichText, FileLoader)
   - 🔲 Interactive/Navigation components (YOUR STARTING POINT)
   - 🔲 State management system

4. **Comprehensive Testing Automation** (Recently Completed)
   - ✅ Pre-commit hooks with Husky + lint-staged
   - ✅ GitHub Actions CI/CD pipeline
   - ✅ Automated test runners with server management
   - ✅ Visual regression testing with Playwright
   - ✅ Performance benchmarking and monitoring
   - ✅ Multi-browser E2E testing (7/7 platforms passing)

### 🎯 Your First Task: Interactive and Navigation Components (3.2.3)

You'll be implementing:
1. **Enhanced Button** with loading states and variants (basic version exists)
2. **Link** component with routing integration
3. **DataGrid** with sorting, filtering, pagination
4. **Timer** component with intervals and events
5. **Notification/Alert** components with Material Design styling

## 🚀 Getting Started

### 1. Environment Setup
```bash
# Clone the repo
git clone https://github.com/[your-fork]/anvil-runtime.git
cd anvil-runtime

# Install bridge dependencies
cd bridge
npm install

# Start the development server
npm run dev
```

### 2. Start Local Anvil Server
```bash
# In a separate terminal
cd /Users/$USER/anvil-runtime/anvil-testing
source anvil-env/bin/activate
anvil-app-server --app TestTodoApp --port 3030 --database "jdbc:postgresql://localhost/testtodoapp?username=$USER" --auto-migrate
```

### 3. Run Tests
```bash
# Unit tests
npm test

# Unit tests with coverage
npm run test:coverage

# E2E tests (requires Anvil server running)
npm run test:e2e

# Automated full test suite with server management
npm run test:auto

# Quality checks (TypeScript, linting, formatting)
npm run quality-check

# Security audit
npm run security:audit

# Visual component demos
node tools/test-layout-demo.js
node tools/test-forms-demo.js
node tools/test-display-media-demo.js
```

## 📁 Key Files to Understand

1. **Component System**
   - `/src/lib/components/enhanced-forms.tsx` - Example of enhanced input components
   - `/src/lib/components/enhanced-display-media.tsx` - Recently completed display components
   - `/src/lib/components/component-factory.ts` - How components are created
   - `/src/lib/components/component-registration.ts` - Component registry

2. **Testing Automation**
   - `/tools/automated-test-runner.js` - Comprehensive test automation
   - `/tools/visual-regression-tester.js` - Visual testing framework
   - `/tools/performance-benchmarker.js` - Performance testing

## 🏗️ Architecture Decisions

1. **Enhanced Components Pattern**: We create "enhanced" versions of Anvil components that include:
   - Full TypeScript typing
   - Material Design theming integration
   - Validation and error handling
   - Responsive behavior

2. **Theme Context**: All components use the ThemeProvider for consistent styling

3. **Testing Strategy**: 
   - Unit tests for logic
   - React Testing Library for components
   - Playwright for E2E
   - Visual demos for manual testing

## 💡 Implementation Tips

### For the Enhanced Button Component:
```typescript
// Build on the existing basic Button
export interface EnhancedButtonProps extends AnvilLayoutProps {
  text?: string;
  icon?: string;
  iconAlign?: 'left' | 'right';
  role?: 'primary-color' | 'secondary-color' | 'raised' | 'filled' | 'outlined';
  loading?: boolean;
  disabled?: boolean;
  onClick?: (event: MouseEvent) => void;
  // Add loading states and variants
  variant?: 'contained' | 'outlined' | 'text';
  size?: 'small' | 'medium' | 'large';
  loadingText?: string;
}
```

### For the Link Component:
- Integrate with Next.js routing system
- Support both internal and external links
- Handle onClick events and navigation state
- Consider anvil.open_form() compatibility

### For the DataGrid Component:
- Study the existing DataGrid from TestTodoApp for reference
- Implement virtualization for large datasets
- Add sorting, filtering, and pagination
- Support RepeatingPanel-style item templates

## ⚠️ Important Notes

1. **Material Design, NOT Material 3**: Anvil uses the older Material Design system
2. **Component Names**: Use exact Anvil names (e.g., "Label" not "Text")
3. **Property Mapping**: Check component-registration.ts for examples
4. **Theme Roles**: Components should support role prop for styling

## 🧪 Testing Your Components

1. Add unit tests in `/tests/components/enhanced-interactive.test.tsx`
2. Update the component registry in `component-registration.ts` 
3. Export from `/src/lib/components/index.ts`
4. Create a visual demo in `/tools/test-interactive-demo.js`
5. Use the automated test runner: `npm run test:auto`

## 📞 Questions or Stuck?

1. Check existing implementations in enhanced-forms.tsx and enhanced-display-media.tsx
2. Review the component mapping document: `/docs/component-mapping.md`
3. Look at Anvil's actual implementation in the template apps (especially TestTodoApp for DataGrid)
4. The test files often have good examples of expected behavior
5. Use the automation tools for comprehensive testing

## 🎉 Final Words

You're joining a project with excellent momentum! The hardest parts (protocol reverse engineering, proxy implementation, automation system) are complete. The component foundation is solid, and you have comprehensive testing automation to support your development.

**Recently Completed**: Display and Media components (Label, Image, Plot, RichText, FileLoader) are fully implemented with 17/21 tests passing.

**Your Mission**: Implement the Interactive and Navigation components to complete the core component library.

Remember our north star: An Anvil developer should be able to take their app and run it through our bridge with zero code changes. Every component should behave identically to its Anvil counterpart.

Good luck, and happy coding! 🚀

---

*P.S. - When you complete the interactive/navigation components, the next developer will tackle state management (useAnvilState hook, two-way data binding, form lifecycle), followed by event system integration. The automation system will help ensure everything works seamlessly!* 