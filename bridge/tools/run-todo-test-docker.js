#!/usr/bin/env node

/**
 * Docker Todo Demo Test Runner
 * 
 * Runs the comprehensive Todo demo workflow test in a containerized environment.
 * This version is optimized for Docker and uses the PostgreSQL container.
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🐳 Anvil-NextJS Todo Demo Workflow Test (Docker)');
console.log('='.repeat(50));

console.log(`
📋 This containerized test will:
1. ✅ Use PostgreSQL container for data persistence
2. ✅ Create a fresh Todo demo app
3. 🚀 Start Anvil server, WebSocket bridge, and NextJS
4. 🧪 Test complete user workflow:
   - Add two todo items
   - Mark one as complete
   - Delete the first item
   - Verify persistence after page refresh
5. 🧹 Clean up all services and demo app

🐳 Running in Docker container with:
- PostgreSQL: postgres:5432
- Anvil Server: localhost:3030
- WebSocket Bridge: localhost:3001
- NextJS Bridge: localhost:3000
`);

// Check if user wants to proceed
if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
Usage: npm run test:e2e:todo:docker [options]

Options:
  --headed        Run in headed mode (show browser)
  --debug         Run in debug mode
  --help, -h      Show this help message

Examples:
  npm run test:e2e:todo:docker                 # Run headless in container
  npm run test:e2e:todo:docker --headed        # Show browser in container
  npm run test:e2e:todo:docker --debug         # Debug mode in container

Note: To run the full containerized environment:
  npm run test:docker                          # Complete Docker setup
`);
    process.exit(0);
}

// Build playwright command for Docker environment
const playwrightArgs = [
    'test',
    'tests/e2e/todo-demo-workflow.test.ts',
    '--reporter=line',
    '--project=chromium-docker',  // Use Docker-specific project
    '--config=playwright-docker.config.ts'  // Use Docker-specific config
];

// Add user options
if (process.argv.includes('--headed')) {
    playwrightArgs.push('--headed');
}
if (process.argv.includes('--debug')) {
    playwrightArgs.push('--debug');
}

console.log('🎬 Starting Docker Todo Demo Test...\n');

// Set up environment for Docker
const dockerEnv = {
    ...process.env,
    // Database configuration for Docker
    DATABASE_URL: 'postgresql://anvil_user:anvil_password@postgres:5432/anvil_test',
    PGHOST: 'postgres',
    PGPORT: '5432',
    PGDATABASE: 'anvil_test',
    PGUSER: 'anvil_user',
    PGPASSWORD: 'anvil_password',

    // Anvil configuration
    ANVIL_SERVER_URL: 'localhost',
    ANVIL_SERVER_PORT: '3030',
    NEXT_PUBLIC_WEBSOCKET_URL: 'ws://localhost:3001',
    NEXT_PUBLIC_ANVIL_SERVER_URL: 'http://localhost:3030',

    // Test configuration
    NODE_ENV: 'test',
    CI: 'true',
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD: '0',
    FORCE_COLOR: '1',

    // Docker-specific settings
    DOCKER_ENV: 'true',
    DISPLAY: process.env.DISPLAY || ':99'
};

// Run the test with Docker-optimized settings
const testProcess = spawn('npx', ['playwright', ...playwrightArgs], {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..'),
    env: dockerEnv
});

testProcess.on('close', (code) => {
    if (code === 0) {
        console.log('\n🎉 Docker Todo Demo Test completed successfully!');
        console.log(`
✅ Test Results (Docker):
- PostgreSQL container: CONNECTED
- Todo app creation: PASSED
- Service startup: PASSED  
- User workflow: PASSED
- Data persistence: PASSED
- Cleanup: PASSED

🔍 Test artifacts saved to:
- Videos: test-results/videos/todo-demo/
- HAR files: test-results/har/todo-demo.har
- Screenshots: test-results/screenshots/

🐳 Container Environment:
- Database: PostgreSQL container (postgres:5432)
- Services: All running in isolated container
- Browser: Chromium (containerized)
`);
    } else {
        console.error('\n❌ Docker Todo Demo Test failed');
        console.log(`
🔍 Docker Troubleshooting:
- Check PostgreSQL container health: docker ps
- View container logs: docker-compose logs anvil-test
- Check database connection: docker exec -it anvil-test-postgres psql -U anvil_user -d anvil_test
- Verify port exposure: docker port anvil-test-runner

💡 Debug commands:
- docker-compose -f docker-compose.test.yml logs
- docker exec -it anvil-test-runner /bin/bash
- npm run test:docker:clean  # Clean up everything
`);
    }
    process.exit(code);
});

testProcess.on('error', (error) => {
    console.error('❌ Failed to start Docker test:', error.message);
    console.log('\n🔧 Ensure Docker is running and try:');
    console.log('   docker --version');
    console.log('   docker-compose --version');
    process.exit(1);
}); 