# 🚀 Testing Automation Documentation

This document describes the comprehensive testing automation system implemented for the Anvil NextJS Bridge project.

## 📋 Overview

The automation system provides:
- ✅ **Pre-commit hooks** for quality assurance
- 🔄 **CI/CD pipeline** with GitHub Actions
- 🧪 **Automated test runners** with server management
- 📸 **Visual regression testing** with Playwright
- ⚡ **Performance benchmarking** and monitoring
- 🛡️ **Security scanning** and dependency management

## 🛠️ Available Commands

### Core Testing Commands
```bash
# Unit tests
npm test                    # Run Jest unit tests
npm run test:watch         # Run Jest in watch mode
npm run test:coverage      # Run Jest with coverage report

# End-to-End tests
npm run test:e2e           # Run Playwright E2E tests
npm run test:e2e:ui        # Run E2E tests with UI
npm run test:e2e:headed    # Run E2E tests in headed mode
npm run test:e2e:debug     # Run E2E tests in debug mode

# Comprehensive testing
npm run test:all           # Run unit + E2E tests
npm run test:ci            # Full CI pipeline (lint + type + coverage + E2E)
```

### Automation Commands
```bash
# Automated test runners
npm run test:auto          # Full automated test suite with reporting
npm run test:with-server   # Auto-start Anvil server and run tests

# Visual regression testing
npm run test:visual        # Run visual regression tests
npm run test:visual:baseline # Update visual baselines

# Performance testing
npm run test:performance   # Run performance benchmarks

# Quality assurance
npm run quality-check      # TypeScript + ESLint + Prettier checks
npm run quality-fix        # Auto-fix TypeScript + ESLint + Prettier issues

# Security
npm run security:audit     # Run npm security audit
npm run security:fix       # Auto-fix security vulnerabilities
```

## 🔧 Automation Tools

### 1. Pre-Commit Hooks (Husky + lint-staged)

**Location**: `.husky/pre-commit`

**Features**:
- Runs quality checks before every commit
- Prevents commits with failing tests or linting issues
- Automatically formats code with Prettier
- Type checks with TypeScript

**Configuration**:
```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml,yml}": ["prettier --write"]
  }
}
```

**Setup**: Automatically initialized with `npm install`

### 2. Automated Test Runner

**Location**: `tools/automated-test-runner.js`

**Features**:
- Sequential test execution (quality → unit → E2E)
- Automatic server lifecycle management
- Comprehensive reporting with JSON and console output
- Error handling and cleanup
- Coverage collection and analysis

**Usage**:
```bash
npm run test:auto
```

**Configuration**: Edit `config` object in the script for:
- Server ports and startup timeouts
- Test commands and thresholds
- Output directory customization

### 3. Anvil Server Test Manager

**Location**: `tools/test-with-anvil-server.js`

**Features**:
- Automatic Anvil server startup/shutdown
- Health checking and readiness detection
- Graceful error handling
- Signal handling for cleanup

**Usage**:
```bash
npm run test:with-server
```

**Requirements**:
- `anvil-app-server` installed: `pip install anvil-app-server`
- `TestTodoApp` created in project directory

### 4. Visual Regression Testing

**Location**: `tools/visual-regression-tester.js`

**Features**:
- Multi-browser testing (Chromium, Firefox, Safari)
- Multi-viewport testing (desktop, tablet, mobile)
- Baseline comparison with tolerance
- HTML and JSON reports
- Dynamic element hiding to prevent false positives

**Usage**:
```bash
# Run visual tests
npm run test:visual

# Update baselines
npm run test:visual:baseline

# Direct usage with commands
node tools/visual-regression-tester.js test
node tools/visual-regression-tester.js baseline
```

**Output**: Results saved to `test-results/visual-tests/`

### 5. Performance Benchmarking

**Location**: `tools/performance-benchmarker.js`

**Features**:
- Web Vitals measurement (FCP, LCP, TTI, CLS)
- Bundle size analysis
- Component rendering performance
- Threshold-based pass/fail criteria
- HTML dashboard with metrics visualization

**Usage**:
```bash
npm run test:performance
```

**Thresholds** (configurable):
- First Contentful Paint: 1500ms
- Largest Contentful Paint: 2500ms
- Time to Interactive: 3000ms
- Cumulative Layout Shift: 0.1
- Bundle Size: 2MB
- Component Render Time: 100ms

**Output**: Results saved to `test-results/performance/`

## 🤖 CI/CD Pipeline (GitHub Actions)

**Location**: `.github/workflows/ci.yml`

**Pipeline Stages**:
1. **Code Quality & Type Safety**
   - ESLint checking
   - TypeScript type checking
   - Prettier formatting verification

2. **Unit Tests & Coverage**
   - Jest test execution
   - Coverage report generation
   - Codecov integration

3. **End-to-End Tests**
   - PostgreSQL service setup
   - Java and Python environment setup
   - Anvil app server installation
   - Playwright test execution

4. **Build Verification**
   - NextJS application build
   - TypeScript library build

5. **Security Scanning**
   - NPM security audit
   - CodeQL static analysis

6. **Deployment Readiness**
   - Comprehensive status check
   - Artifact generation

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

## 📊 Test Reports and Artifacts

### Report Locations
```
test-results/
├── automated-test-report.json     # Comprehensive test execution report
├── visual-tests/                  # Visual regression test results
│   ├── current/                   # Current screenshots
│   ├── baseline/                  # Baseline screenshots  
│   ├── diff/                      # Difference analysis
│   ├── visual-test-report.html    # Visual test dashboard
│   └── visual-test-report.json    # Visual test data
├── performance/                   # Performance benchmark results
│   ├── performance-report.html    # Performance dashboard
│   └── performance-report.json    # Performance metrics data
└── coverage/                      # Jest coverage reports
    ├── lcov.info                  # Coverage data for CI
    └── html/                      # HTML coverage report
```

### GitHub Actions Artifacts
- `playwright-report`: E2E test results and traces
- `deployment-ready`: Deployment readiness indicator

## ⚙️ Configuration

### Jest Configuration
**Location**: `jest.config.js`
- React Testing Library integration
- Coverage thresholds and reporting
- Module path mapping
- Test environment setup

### Playwright Configuration  
**Location**: `playwright.config.ts`
- Multi-browser configuration
- Base URL configuration
- Test timeout and retry settings
- Artifact collection

### ESLint Configuration
**Location**: `eslint.config.mjs`
- NextJS and React rules
- TypeScript integration
- Custom rule configurations

### Prettier Configuration
**Location**: `package.json` (prettier section)
- Code formatting standards
- File type handling

## 🔧 Local Development Setup

### Initial Setup
```bash
# Install dependencies
npm install

# Initialize Git hooks
npm run prepare

# Create test Anvil app (if testing with server)
create-anvil-app todo-list TestTodoApp
```

### Daily Development Workflow
```bash
# Start development with full automation
npm run dev:full  # Starts both NextJS and WebSocket server

# Run tests during development
npm run test:watch  # Watch mode for unit tests

# Before committing (automatic with pre-commit hook)
npm run quality-fix  # Fix linting and formatting issues
npm run test         # Run unit tests

# Weekly or before major releases
npm run test:auto    # Full test suite
npm run test:visual  # Visual regression check
npm run test:performance  # Performance benchmark
```

### Troubleshooting

#### Pre-commit Hook Issues
```bash
# If pre-commit hook fails
npm run quality-fix  # Fix issues automatically
git add .            # Stage fixed files
git commit           # Retry commit
```

#### Anvil Server Issues
```bash
# Check if server is running
curl http://localhost:3030/

# Manual server start
anvil-app-server --app TestTodoApp --port 3030

# Check Java/Python dependencies
java -version
python3 --version
pip list | grep anvil
```

#### Visual Test Failures
```bash
# Update baselines if UI changes are intentional
npm run test:visual:baseline

# View visual diff reports
open test-results/visual-tests/visual-test-report.html
```

#### Performance Test Failures
```bash
# Check if dev server is running
npm run dev

# View performance report
open test-results/performance/performance-report.html

# Analyze bundle size
npm run build
ls -la .next/static/
```

## 🚀 Advanced Usage

### Custom Test Scenarios

#### Adding Visual Test Scenarios
Edit `tools/visual-regression-tester.js`:
```javascript
testScenarios: [
  {
    name: 'custom-component',
    path: '/my-custom-page',
    description: 'My custom component test'
  }
]
```

#### Adding Performance Test Scenarios
Edit `tools/performance-benchmarker.js`:
```javascript
testScenarios: [
  {
    name: 'custom-performance',
    path: '/my-performance-test',
    description: 'Custom performance scenario'
  }
]
```

### CI/CD Customization

#### Environment Variables
```yaml
# In GitHub Actions workflow
env:
  ANVIL_TEST_APP_PATH: "/tmp/TestTodoApp"
  NODE_ENV: "test"
  CI: "true"
```

#### Custom Test Commands
Add to `package.json`:
```json
{
  "scripts": {
    "test:custom": "jest --testPathPattern=custom",
    "test:integration": "playwright test --grep integration"
  }
}
```

## 📈 Metrics and Monitoring

### Coverage Targets
- **Line Coverage**: 80%+
- **Branch Coverage**: 75%+
- **Function Coverage**: 85%+

### Performance Targets
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Bundle Size**: < 2MB
- **Component Render**: < 100ms

### Quality Gates
- **ESLint**: Zero errors, warnings allowed
- **TypeScript**: Zero type errors
- **Tests**: 100% passing required
- **Security**: No high/critical vulnerabilities

## 🎯 Best Practices

### Test Development
1. **Write tests alongside implementation**
2. **Use descriptive test names**
3. **Test user interactions, not implementation details**
4. **Keep tests isolated and independent**
5. **Use proper test data and mocking**

### Automation Maintenance
1. **Update baselines after intentional UI changes**
2. **Review performance trends regularly**
3. **Keep dependencies updated**
4. **Monitor CI/CD pipeline health**
5. **Document test failures and resolutions**

### Git Workflow
1. **Commit frequently with meaningful messages**
2. **Let pre-commit hooks fix formatting**
3. **Run full test suite before major merges**
4. **Use feature branches for experimental work**
5. **Keep commits atomic and focused**

## 📞 Support

For issues with the automation system:

1. **Check this documentation first**
2. **Review test reports in `test-results/`**
3. **Check GitHub Actions logs for CI issues**
4. **Verify local environment setup**
5. **Update dependencies if needed**

**Common Commands for Debugging**:
```bash
npm run quality-check  # Check what's wrong
npm run test -- --verbose  # Detailed test output
npm audit               # Check for security issues
npx playwright --version  # Verify Playwright installation
``` 