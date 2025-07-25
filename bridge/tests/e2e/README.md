# End-to-End Tests

## Todo Demo Workflow Test

### Overview
The **Todo Demo Workflow Test** (`todo-demo-workflow.test.ts`) is a comprehensive end-to-end test that validates the complete Anvil-NextJS Bridge functionality using a real Todo application.

### What It Tests
This test creates a complete Todo demo environment from scratch and validates:

1. **Environment Setup**
   - Creates a fresh Todo demo app using `anvil-app-server create-app todo-list`
   - Starts Anvil server (port 3030)
   - Starts WebSocket bridge server (port 3001) 
   - Starts NextJS bridge (port 3000)

2. **User Workflow**
   - ✅ **Add Items**: Adds two todo items via the UI
   - ✅ **Mark Complete**: Marks the second item as complete
   - ✅ **Delete Items**: Removes the first item
   - ✅ **Persistence**: Refreshes page and verifies data persists

3. **Technical Validation**
   - WebSocket communication between NextJS and Anvil
   - Data persistence via Anvil's data tables
   - Component rendering and interaction
   - Form submission and updates

4. **Cleanup**
   - Stops all services gracefully
   - Removes the demo app directory
   - Cleans up processes and ports

### Running the Test

#### Quick Start
```bash
# Run the complete Todo workflow test (local environment)
npm run test:e2e:todo

# OR run in Docker (recommended - zero dependencies!)
npm run test:docker
```

#### With Options
```bash
# Run with visible browser (helpful for debugging)
npm run test:e2e:todo --headed

# Run in debug mode (step through interactions)
npm run test:e2e:todo --debug

# Show help
npm run test:e2e:todo --help
```

## Docker Testing (Recommended) 🐳

For the easiest testing experience, use Docker:

```bash
# Complete containerized test (zero local dependencies!)
npm run test:docker

# Clean up afterward
npm run test:docker:clean
```

**Benefits of Docker testing:**
- ✅ **Zero Dependencies**: Only requires Docker
- ✅ **Consistent Results**: Same environment everywhere
- ✅ **No Conflicts**: Isolated from your local setup
- ✅ **CI Ready**: Perfect for automated pipelines

See [README-DOCKER.md](../../README-DOCKER.md) for complete Docker documentation.

### Prerequisites
Before running the test, ensure:

- ✅ **PostgreSQL** is running (required for Anvil data tables)
- ✅ **Ports Available**: 3000, 3001, and 3030 are not in use
- ✅ **Python Environment**: `anvil-app-server` is installed and available
- ✅ **Node.js**: npm and Node.js are available

### Test Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Playwright    │◄──►│   Todo Demo      │◄──►│  Anvil Server   │
│   (Browser)     │    │   NextJS App     │    │   (Backend)     │
│                 │    │                  │    │                 │
│ • User Actions  │    │ • AnvilForm      │    │ • Data Tables   │
│ • Assertions    │    │ • WebSocket      │    │ • Server Calls  │
│ • Screenshots   │    │ • State Mgmt     │    │ • Persistence   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Test Flow

1. **Setup Phase** (30-60 seconds)
   ```
   📋 Create Todo demo app
   🚀 Start Anvil server  
   🌉 Start WebSocket bridge
   ⚡ Start NextJS server
   ⏳ Wait for services ready
   ```

2. **Test Phase** (30-60 seconds)
   ```
   🌐 Load Todo app in browser
   ➕ Add first todo item
   ➕ Add second todo item  
   ✅ Mark second item complete
   🗑️ Delete first item
   🔄 Refresh page
   ✅ Verify persistence
   ```

3. **Cleanup Phase** (5-10 seconds)
   ```
   🛑 Stop all services
   🧹 Remove demo app
   📊 Generate test report
   ```

### Test Artifacts

After running, the test generates:
- **Videos**: `test-results/videos/todo-demo/` - Screen recordings of test execution
- **HAR Files**: `test-results/har/todo-demo.har` - Network traffic logs
- **Screenshots**: `test-results/screenshots/` - Failure screenshots (if any)
- **Traces**: Available for debugging failed tests

### Troubleshooting

#### Common Issues

**PostgreSQL Not Running**
```bash
# Start PostgreSQL (macOS with Homebrew)
brew services start postgresql

# Check if running
pg_isready -h localhost
```

**Ports In Use**
```bash
# Check what's using ports
lsof -i :3000
lsof -i :3001  
lsof -i :3030

# Kill processes if needed
pkill -f "anvil-app-server"
pkill -f "npm.*dev"
pkill -f "websocket-server"
```

**Python Environment Issues**
```bash
# Verify anvil-app-server is available
which anvil-app-server
anvil-app-server --version

# Install if missing
pip install anvil-app-server
```

#### Test Debugging

**Run with Browser Visible**
```bash
npm run test:e2e:todo --headed
```

**Step Through Test**
```bash
npm run test:e2e:todo --debug
```

**Check Service Logs**
The test outputs detailed logs showing:
- Service startup progress
- UI element discovery
- User interaction attempts
- Data persistence verification

### Integration with CI/CD

This test is designed to be robust for CI environments:
- ✅ **Self-contained**: Manages its own services
- ✅ **Cleanup**: Always cleans up resources
- ✅ **Timeout Handling**: Proper timeouts for all operations
- ✅ **Error Recovery**: Graceful failure handling

To include in CI pipelines:
```yaml
- name: Run Todo Demo Test
  run: npm run test:e2e:todo
  env:
    CI: true
```

### Performance Expectations

| Phase | Expected Duration |
|-------|------------------|
| Setup | 30-60 seconds |
| Test Execution | 30-60 seconds |
| Cleanup | 5-10 seconds |
| **Total** | **65-130 seconds** |

The test is optimized for reliability over speed, with generous timeouts to handle system variations.

### Contributing

When modifying this test:

1. **Maintain Robustness**: Use multiple selector strategies for UI elements
2. **Add Logging**: Include console.log statements for debugging
3. **Handle Failures**: Ensure cleanup happens even on test failure
4. **Update Timeouts**: Adjust timeouts if adding complex operations
5. **Test Across Browsers**: Validate on Chrome, Firefox, and Safari

This test serves as both validation and documentation of the complete Anvil-NextJS Bridge functionality. 