#!/usr/bin/env node

/**
 * Automated Test Runner
 * 
 * Comprehensive test automation that handles:
 * - Server lifecycle management
 * - Sequential test execution
 * - Error handling and reporting
 * - Coverage collection
 * - Visual testing integration
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class AutomatedTestRunner {
    constructor() {
        this.config = {
            anvilServer: {
                port: 3030,
                startCommand: 'anvil-app-server --app TestTodoApp --port 3030',
                healthCheckUrl: 'http://localhost:3030/',
                startupTimeout: 30000
            },
            websocketServer: {
                port: 3001,
                startCommand: 'node server/websocket-server.js',
                startupTimeout: 5000
            },
            tests: {
                unit: 'npm run test:coverage',
                e2e: 'npm run test:e2e',
                quality: 'npm run quality-check'
            }
        };

        this.servers = new Map();
        this.results = {
            quality: null,
            unit: null,
            e2e: null,
            startTime: new Date(),
            endTime: null
        };
    }

    async run() {
        console.log('🚀 Starting Automated Test Runner...\n');

        try {
            // Step 1: Quality checks (no server needed)
            await this.runQualityChecks();

            // Step 2: Unit tests (no server needed)
            await this.runUnitTests();

            // Step 3: Start servers for E2E tests
            await this.startServers();

            // Step 4: Run E2E tests
            await this.runE2ETests();

            // Step 5: Generate report
            await this.generateReport();

        } catch (error) {
            console.error('❌ Test run failed:', error.message);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }

    async runQualityChecks() {
        console.log('📋 Running quality checks...');

        try {
            await this.executeCommand(this.config.tests.quality);
            this.results.quality = { status: 'PASSED', message: 'All quality checks passed' };
            console.log('✅ Quality checks passed\n');
        } catch (error) {
            this.results.quality = { status: 'FAILED', message: error.message };
            throw new Error(`Quality checks failed: ${error.message}`);
        }
    }

    async runUnitTests() {
        console.log('🧪 Running unit tests...');

        try {
            const result = await this.executeCommand(this.config.tests.unit);
            this.results.unit = {
                status: 'PASSED',
                message: 'All unit tests passed',
                coverage: this.extractCoverage(result.stdout)
            };
            console.log('✅ Unit tests passed\n');
        } catch (error) {
            this.results.unit = { status: 'FAILED', message: error.message };
            throw new Error(`Unit tests failed: ${error.message}`);
        }
    }

    async startServers() {
        console.log('🔧 Starting test servers...');

        // Start WebSocket server
        console.log('  Starting WebSocket server...');
        await this.startServer('websocket', this.config.websocketServer);

        // Check if Anvil server is already running
        const anvilRunning = await this.checkAnvilServer();
        if (!anvilRunning) {
            console.log('  ⚠️  Anvil server not detected at localhost:3030');
            console.log('  Please start manually: anvil-app-server --app TestTodoApp --port 3030');
            console.log('  E2E tests will be skipped if server is not available.');
        } else {
            console.log('  ✅ Anvil server detected at localhost:3030');
        }

        console.log('✅ Server setup completed\n');
    }

    async runE2ETests() {
        console.log('🌐 Running E2E tests...');

        // Check if Anvil server is available
        const anvilRunning = await this.checkAnvilServer();
        if (!anvilRunning) {
            console.log('⚠️  Skipping E2E tests - Anvil server not available');
            this.results.e2e = {
                status: 'SKIPPED',
                message: 'Anvil server not available at localhost:3030'
            };
            return;
        }

        try {
            await this.executeCommand(this.config.tests.e2e);
            this.results.e2e = { status: 'PASSED', message: 'All E2E tests passed' };
            console.log('✅ E2E tests passed\n');
        } catch (error) {
            this.results.e2e = { status: 'FAILED', message: error.message };
            throw new Error(`E2E tests failed: ${error.message}`);
        }
    }

    async startServer(name, config) {
        return new Promise((resolve, reject) => {
            const server = spawn('sh', ['-c', config.startCommand], {
                stdio: ['inherit', 'pipe', 'pipe'],
                detached: false
            });

            this.servers.set(name, server);

            const timeout = setTimeout(() => {
                reject(new Error(`${name} server failed to start within ${config.startupTimeout}ms`));
            }, config.startupTimeout);

            // Wait for server to be ready
            const checkReady = setInterval(async () => {
                try {
                    if (name === 'websocket') {
                        // For WebSocket server, just wait a bit for startup
                        clearTimeout(timeout);
                        clearInterval(checkReady);
                        resolve();
                    }
                } catch (error) {
                    // Continue checking
                }
            }, 1000);

            server.on('error', (error) => {
                clearTimeout(timeout);
                clearInterval(checkReady);
                reject(error);
            });

            // For WebSocket server, just wait 2 seconds
            if (name === 'websocket') {
                setTimeout(() => {
                    clearTimeout(timeout);
                    clearInterval(checkReady);
                    resolve();
                }, 2000);
            }
        });
    }

    async checkAnvilServer() {
        return new Promise((resolve) => {
            const http = require('http');
            const req = http.get(this.config.anvilServer.healthCheckUrl, { timeout: 5000 }, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => resolve(false));
            req.on('timeout', () => {
                req.destroy();
                resolve(false);
            });
        });
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }

    extractCoverage(stdout) {
        // Extract coverage information from Jest output
        const coverageMatch = stdout.match(/All files[^|]*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|/);
        return coverageMatch ? coverageMatch[0] : 'Coverage information not available';
    }

    async generateReport() {
        this.results.endTime = new Date();
        const duration = this.results.endTime - this.results.startTime;

        console.log('\n📊 TEST EXECUTION REPORT');
        console.log('═'.repeat(50));
        console.log(`🕒 Total Duration: ${Math.round(duration / 1000)}s`);
        console.log(`📅 Started: ${this.results.startTime.toLocaleTimeString()}`);
        console.log(`📅 Finished: ${this.results.endTime.toLocaleTimeString()}`);
        console.log('');

        // Quality Results
        console.log(`📋 Quality Checks: ${this.getStatusIcon(this.results.quality.status)} ${this.results.quality.status}`);
        if (this.results.quality.message) {
            console.log(`   ${this.results.quality.message}`);
        }

        // Unit Test Results
        console.log(`🧪 Unit Tests: ${this.getStatusIcon(this.results.unit.status)} ${this.results.unit.status}`);
        if (this.results.unit.message) {
            console.log(`   ${this.results.unit.message}`);
        }
        if (this.results.unit.coverage) {
            console.log(`   ${this.results.unit.coverage}`);
        }

        // E2E Test Results
        console.log(`🌐 E2E Tests: ${this.getStatusIcon(this.results.e2e.status)} ${this.results.e2e.status}`);
        if (this.results.e2e.message) {
            console.log(`   ${this.results.e2e.message}`);
        }

        console.log('');

        // Overall Status
        const overallStatus = this.getOverallStatus();
        console.log(`🎯 Overall Status: ${this.getStatusIcon(overallStatus)} ${overallStatus}`);

        // Save report to file
        await this.saveReport();

        console.log('\n📄 Detailed report saved to: test-results/automated-test-report.json');
    }

    getStatusIcon(status) {
        switch (status) {
            case 'PASSED': return '✅';
            case 'FAILED': return '❌';
            case 'SKIPPED': return '⚠️';
            default: return '❓';
        }
    }

    getOverallStatus() {
        if (this.results.quality.status === 'FAILED' || this.results.unit.status === 'FAILED') {
            return 'FAILED';
        }
        if (this.results.e2e.status === 'FAILED') {
            return 'FAILED';
        }
        if (this.results.e2e.status === 'SKIPPED') {
            return 'PARTIAL';
        }
        return 'PASSED';
    }

    async saveReport() {
        const reportDir = path.join(process.cwd(), 'test-results');
        if (!fs.existsSync(reportDir)) {
            fs.mkdirSync(reportDir, { recursive: true });
        }

        const reportPath = path.join(reportDir, 'automated-test-report.json');
        const report = {
            ...this.results,
            duration: this.results.endTime - this.results.startTime,
            overallStatus: this.getOverallStatus(),
            timestamp: new Date().toISOString()
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    }

    async cleanup() {
        console.log('\n🧹 Cleaning up...');

        for (const [name, server] of this.servers) {
            try {
                console.log(`  Stopping ${name} server...`);
                server.kill('SIGTERM');

                // Wait a bit for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 1000));

                if (!server.killed) {
                    server.kill('SIGKILL');
                }
            } catch (error) {
                console.log(`  Warning: Could not stop ${name} server:`, error.message);
            }
        }

        console.log('✅ Cleanup completed');
    }
}

// Run if called directly
if (require.main === module) {
    const runner = new AutomatedTestRunner();
    runner.run().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = AutomatedTestRunner; 