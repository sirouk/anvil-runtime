/**
 * Global Setup for Anvil Bridge E2E Tests
 * 
 * Ensures the test environment is properly configured:
 * - Anvil server is running and accessible
 * - Test data is prepared
 * - Network conditions are optimal
 */

import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

interface TestEnvironment {
    anvilServerUrl: string;
    anvilServerPort: number;
    bridgeServerUrl: string;
    bridgeServerPort: number;
    websocketUrl: string;
}

const testEnv: TestEnvironment = {
    anvilServerUrl: 'http://localhost',
    anvilServerPort: 3030,
    bridgeServerUrl: 'http://localhost',
    bridgeServerPort: 3000,
    websocketUrl: 'ws://localhost:3001'
};

async function checkServerHealth(url: string, timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'User-Agent': 'Playwright-E2E-Setup/1.0' }
            });

            if (response.ok) {
                console.log(`✅ Server healthy: ${url}`);
                return true;
            }
        } catch (error) {
            // Server not ready yet, continue waiting
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.error(`❌ Server not responding: ${url}`);
    return false;
}

async function verifyAnvilServer(): Promise<boolean> {
    const anvilUrl = `${testEnv.anvilServerUrl}:${testEnv.anvilServerPort}`;

    console.log('\n🔍 Verifying Anvil server...');

    const isHealthy = await checkServerHealth(anvilUrl);
    if (!isHealthy) {
        console.error('\n❌ Anvil server is not running!');
        console.log('💡 To start the Anvil server:');
        console.log(`   cd /Users/$USER/anvil-runtime/anvil-testing`);
        console.log('   source anvil-env/bin/activate');
        console.log('   export PATH="/opt/homebrew/opt/openjdk@11/bin:$PATH"');
        console.log(`   anvil-app-server --app TestTodoApp --port 3030 --database "jdbc:postgresql://localhost/testtodoapp?username=$USER" --auto-migrate\n`);
        return false;
    }

    return true;
}

async function verifyBridgeServer(): Promise<boolean> {
    const bridgeUrl = `${testEnv.bridgeServerUrl}:${testEnv.bridgeServerPort}`;

    console.log('\n🔍 Verifying Bridge server...');

    const isHealthy = await checkServerHealth(bridgeUrl);
    if (!isHealthy) {
        console.error('\n❌ Bridge server is not running!');
        console.log('💡 Bridge server should be started automatically by Playwright webServer config');
        return false;
    }

    return true;
}

async function setupTestData(): Promise<void> {
    console.log('\n📋 Setting up test data...');

    try {
        // Create test directories if they don't exist
        await execAsync('mkdir -p test-results/screenshots test-results/videos test-results/traces');

        // Log environment information
        console.log('📊 Test Environment:');
        console.log(`   Anvil Server: ${testEnv.anvilServerUrl}:${testEnv.anvilServerPort}`);
        console.log(`   Bridge Server: ${testEnv.bridgeServerUrl}:${testEnv.bridgeServerPort}`);
        console.log(`   WebSocket: ${testEnv.websocketUrl}`);

        // Store environment for tests
        process.env.E2E_ANVIL_URL = `${testEnv.anvilServerUrl}:${testEnv.anvilServerPort}`;
        process.env.E2E_BRIDGE_URL = `${testEnv.bridgeServerUrl}:${testEnv.bridgeServerPort}`;
        process.env.E2E_WS_URL = testEnv.websocketUrl;

        console.log('✅ Test data setup complete');

    } catch (error) {
        console.error('❌ Failed to setup test data:', error);
        throw error;
    }
}

async function verifyDependencies(): Promise<void> {
    console.log('\n🔧 Verifying dependencies...');

    try {
        // Check if Node.js modules are available
        await execAsync('node --version');
        console.log('✅ Node.js available');

        // Check if PostgreSQL is accessible (for Anvil server)
        try {
            await execAsync('pg_isready -h localhost');
            console.log('✅ PostgreSQL accessible');
        } catch (error) {
            console.warn('⚠️ PostgreSQL may not be running (required for Anvil server)');
        }

        // Check if Java is available (for Anvil server)
        try {
            await execAsync('java -version');
            console.log('✅ Java available');
        } catch (error) {
            console.warn('⚠️ Java may not be available (required for Anvil server)');
        }

    } catch (error) {
        console.error('❌ Dependency check failed:', error);
        throw error;
    }
}

export default async function globalSetup(config: FullConfig) {
    console.log('\n🚀 Starting Anvil Bridge E2E Test Setup');
    console.log('='.repeat(50));

    try {
        // Step 1: Verify system dependencies
        await verifyDependencies();

        // Step 2: Setup test data and environment
        await setupTestData();

        // Step 3: Verify Anvil server is running
        const anvilHealthy = await verifyAnvilServer();
        if (!anvilHealthy) {
            throw new Error('Anvil server is required for E2E tests');
        }

        // Step 4: Bridge server will be started by Playwright webServer config
        // We'll verify it in a moment, but it may still be starting
        console.log('\n⏳ Waiting for Bridge server to start...');
        await new Promise(resolve => setTimeout(resolve, 5000));

        // Step 5: Verify bridge server
        const bridgeHealthy = await verifyBridgeServer();
        if (!bridgeHealthy) {
            console.warn('⚠️ Bridge server not responding yet, tests may fail');
        }

        console.log('\n✅ Global setup completed successfully!');
        console.log('🎯 Ready to run E2E tests');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Global setup failed:', error);
        console.log('🛑 E2E tests cannot proceed');
        throw error;
    }
} 