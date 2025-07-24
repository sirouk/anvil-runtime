#!/usr/bin/env node

/**
 * Test with Anvil Server
 * 
 * Automatically starts Anvil server, runs tests, and cleans up.
 * Useful for CI/CD environments where full automation is needed.
 */

const { spawn } = require('child_process');
const http = require('http');

class AnvilServerTestManager {
    constructor() {
        this.anvilServer = null;
        this.config = {
            port: 3030,
            app: 'TestTodoApp',
            startupTimeout: 60000, // 60 seconds for Anvil server startup
            healthCheckInterval: 1000,
            maxHealthChecks: 60
        };
    }

    async run() {
        console.log('🚀 Starting Anvil Server Test Manager...\n');

        try {
            // Check if server is already running
            const isRunning = await this.checkServerHealth();
            if (isRunning) {
                console.log('✅ Anvil server already running at localhost:3030');
                await this.runTests();
                return;
            }

            // Start Anvil server
            await this.startAnvilServer();

            // Wait for server to be ready
            await this.waitForServer();

            // Run tests
            await this.runTests();

        } catch (error) {
            console.error('❌ Error:', error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }

    async startAnvilServer() {
        console.log('🔧 Starting Anvil server...');

        return new Promise((resolve, reject) => {
            // Check if anvil-app-server is available
            const checkCommand = spawn('which', ['anvil-app-server'], { stdio: 'pipe' });

            checkCommand.on('close', (code) => {
                if (code !== 0) {
                    reject(new Error('anvil-app-server not found. Please install: pip install anvil-app-server'));
                    return;
                }

                // Start the server
                console.log(`  Command: anvil-app-server --app ${this.config.app} --port ${this.config.port}`);

                this.anvilServer = spawn('anvil-app-server', [
                    '--app', this.config.app,
                    '--port', this.config.port.toString()
                ], {
                    stdio: ['inherit', 'pipe', 'pipe'],
                    detached: false
                });

                this.anvilServer.stdout.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('Server started')) {
                        console.log('✅ Anvil server startup detected');
                    }
                    // Optionally log server output (uncomment next line for debugging)
                    // console.log('  Server:', output.trim());
                });

                this.anvilServer.stderr.on('data', (data) => {
                    const error = data.toString();
                    if (error.includes('ERROR') || error.includes('Exception')) {
                        console.error('  Server error:', error.trim());
                    }
                });

                this.anvilServer.on('error', (error) => {
                    reject(new Error(`Failed to start Anvil server: ${error.message}`));
                });

                this.anvilServer.on('close', (code) => {
                    if (code !== 0) {
                        console.log(`  Anvil server exited with code ${code}`);
                    }
                });

                resolve();
            });
        });
    }

    async waitForServer() {
        console.log('⏳ Waiting for Anvil server to be ready...');

        let attempts = 0;
        const maxAttempts = this.config.maxHealthChecks;

        while (attempts < maxAttempts) {
            const isHealthy = await this.checkServerHealth();
            if (isHealthy) {
                console.log('✅ Anvil server is ready!\n');
                return;
            }

            attempts++;
            const elapsed = attempts * (this.config.healthCheckInterval / 1000);
            process.stdout.write(`  Checking... ${elapsed}s elapsed\r`);

            await new Promise(resolve => setTimeout(resolve, this.config.healthCheckInterval));
        }

        throw new Error(`Anvil server failed to start within ${this.config.startupTimeout / 1000} seconds`);
    }

    async checkServerHealth() {
        return new Promise((resolve) => {
            const req = http.get(`http://localhost:${this.config.port}/`, { timeout: 3000 }, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    async runTests() {
        console.log('🧪 Running tests with Anvil server...\n');

        const testCommands = [
            { name: 'Unit Tests', command: 'npm run test' },
            { name: 'E2E Tests', command: 'npm run test:e2e' }
        ];

        for (const test of testCommands) {
            console.log(`📋 Running ${test.name}...`);

            try {
                await this.executeCommand(test.command);
                console.log(`✅ ${test.name} passed\n`);
            } catch (error) {
                console.error(`❌ ${test.name} failed:`, error.message);
                throw error;
            }
        }

        console.log('🎉 All tests completed successfully!');
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    async cleanup() {
        if (this.anvilServer) {
            console.log('\n🧹 Stopping Anvil server...');

            try {
                // Send SIGTERM for graceful shutdown
                this.anvilServer.kill('SIGTERM');

                // Wait a bit for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Force kill if still running
                if (!this.anvilServer.killed) {
                    console.log('  Force stopping server...');
                    this.anvilServer.kill('SIGKILL');
                }

                console.log('✅ Anvil server stopped');
            } catch (error) {
                console.log('  Warning: Could not stop Anvil server:', error.message);
            }
        }
    }
}

// Handle process signals for cleanup
process.on('SIGINT', async () => {
    console.log('\n⚠️  Received SIGINT, cleaning up...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n⚠️  Received SIGTERM, cleaning up...');
    process.exit(0);
});

// Run if called directly
if (require.main === module) {
    const manager = new AnvilServerTestManager();
    manager.run().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = AnvilServerTestManager; 