#!/usr/bin/env node

/**
 * Todo Demo Test Runner
 * 
 * Runs the comprehensive Todo demo workflow test with proper setup and cleanup.
 * This test creates a fresh Todo app, starts all services, tests the complete
 * user workflow, and cleans up everything afterward.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Anvil-NextJS Todo Demo Workflow Test');
console.log('='.repeat(50));

console.log(`
📋 This test will:
1. ✅ Create a fresh Todo demo app
2. 🚀 Start Anvil server, WebSocket bridge, and NextJS
3. 🧪 Test complete user workflow:
   - Add two todo items
   - Mark one as complete
   - Delete the first item
   - Verify persistence after page refresh
4. 🧹 Clean up all services and demo app

⚠️  Requirements:
- PostgreSQL running (for Anvil data tables)
- Ports 3000, 3001, 3030 available
- Python environment with anvil-app-server installed
- Node.js and npm available

🎯 This test runs independently and manages its own services.
   You don't need to start anything manually.
`);

// Check if user wants to proceed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: npm run test:e2e:todo [options]

Options:
  --headed        Run in headed mode (show browser)
  --debug         Run in debug mode
  --help, -h      Show this help message

Examples:
  npm run test:e2e:todo                 # Run headless
  npm run test:e2e:todo --headed        # Show browser
  npm run test:e2e:todo --debug         # Debug mode
`);
    process.exit(0);
}

// Build playwright command
const playwrightArgs = [
    'test',
    'tests/e2e/todo-demo-workflow.test.ts',
    '--reporter=line'
];

// Add user options
if (process.argv.includes('--headed')) {
    playwrightArgs.push('--headed');
}
if (process.argv.includes('--debug')) {
    playwrightArgs.push('--debug');
}

console.log('🎬 Starting Todo Demo Test...\n');

// Run the test
const testProcess = spawn('npx', ['playwright', ...playwrightArgs], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: {
        ...process.env,
        // Disable the default webServer since our test manages its own services
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0',
        FORCE_COLOR: '1'
    }
});

testProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n🎉 Todo Demo Test completed successfully!');
        console.log(`
✅ Test Results:
- Todo app creation: PASSED
- Service startup: PASSED  
- User workflow: PASSED
- Data persistence: PASSED
- Cleanup: PASSED

🔍 Test artifacts saved to:
- Videos: test-results/videos/todo-demo/
- HAR files: test-results/har/todo-demo.har
`);
    } else {
        console.error('\n❌ Todo Demo Test failed');
        console.log(`
🔍 Troubleshooting:
- Check that PostgreSQL is running
- Ensure ports 3000, 3001, 3030 are available
- Verify anvil-app-server is installed in Python environment
- Check test artifacts in test-results/ for details

💡 Run with --headed to see browser interactions
💡 Run with --debug to step through test
`);
    }
    process.exit(code);
});

testProcess.on('error', (error) => {
    console.error('❌ Failed to start test:', error.message);
    process.exit(1);
}); 