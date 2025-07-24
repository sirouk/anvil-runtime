/**
 * Comprehensive E2E Test Runner
 * 
 * Runs complete end-to-end testing of the Anvil bridge proxy:
 * - Complete user workflows through proxy
 * - Server-side detection verification
 * - Performance benchmarking
 * - Protocol compliance validation
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class E2ETestRunner {
    constructor() {
        this.testResults = {
            timestamp: new Date().toISOString(),
            testSuite: 'Anvil Bridge E2E Tests',
            environment: {
                anvilServer: process.env.E2E_ANVIL_URL || 'http://localhost:3030',
                bridgeServer: process.env.E2E_BRIDGE_URL || 'http://localhost:3000',
                websocketUrl: process.env.E2E_WS_URL || 'ws://localhost:3001'
            },
            results: []
        };
    }

    async runTests() {
        console.log('🚀 Starting Comprehensive E2E Tests');
        console.log('='.repeat(60));
        console.log(`📊 Test Environment:`);
        console.log(`   Anvil Server: ${this.testResults.environment.anvilServer}`);
        console.log(`   Bridge Server: ${this.testResults.environment.bridgeServer}`);
        console.log(`   WebSocket: ${this.testResults.environment.websocketUrl}`);
        console.log('='.repeat(60));

        try {
            // Step 1: Verify server availability
            await this.verifyServerAvailability();

            // Step 2: Run Playwright E2E tests
            await this.runPlaywrightTests();

            // Step 3: Generate final report
            await this.generateReport();

            console.log('\n✅ E2E Testing Complete!');

        } catch (error) {
            console.error('\n❌ E2E Testing Failed:', error);
            this.testResults.results.push({
                test: 'Overall E2E Testing',
                status: 'FAILED',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await this.saveResults();
        }
    }

    async verifyServerAvailability() {
        console.log('\n🔍 Step 1: Verifying Server Availability...');

        const servers = [
            { name: 'Anvil Server', url: this.testResults.environment.anvilServer },
            { name: 'Bridge Server', url: this.testResults.environment.bridgeServer }
        ];

        for (const server of servers) {
            try {
                const response = await fetch(server.url, {
                    method: 'GET',
                    signal: AbortSignal.timeout(10000)
                });

                if (response.ok) {
                    console.log(`  ✅ ${server.name}: Available`);
                    this.testResults.results.push({
                        test: `${server.name} Availability`,
                        status: 'PASSED',
                        timestamp: new Date().toISOString()
                    });
                } else {
                    throw new Error(`HTTP ${response.status}`);
                }
            } catch (error) {
                console.log(`  ❌ ${server.name}: ${error.message}`);
                this.testResults.results.push({
                    test: `${server.name} Availability`,
                    status: 'FAILED',
                    error: error.message,
                    timestamp: new Date().toISOString()
                });

                if (server.name === 'Anvil Server') {
                    console.log('\n💡 To start the Anvil server:');
                    console.log(`   cd /Users/$USER/anvil-runtime/anvil-testing`);
                    console.log('   source anvil-env/bin/activate');
                    console.log('   export PATH="/opt/homebrew/opt/openjdk@11/bin:$PATH"');
                    console.log(`   anvil-app-server --app TestTodoApp --port 3030 --database "jdbc:postgresql://localhost/testtodoapp?username=$USER" --auto-migrate`);
                }

                if (server.name === 'Bridge Server') {
                    console.log('\n💡 To start the Bridge server:');
                    console.log(`   cd /Users/$USER/anvil-runtime/bridge`);
                    console.log('   npm run dev');
                }
            }
        }
    }

    async runPlaywrightTests() {
        console.log('\n🎭 Step 2: Running Playwright E2E Tests...');

        return new Promise((resolve) => {
            const playwrightProcess = spawn('npx', ['playwright', 'test', '--reporter=json'], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd()
            });

            let stdout = '';
            let stderr = '';

            playwrightProcess.stdout.on('data', (data) => {
                stdout += data.toString();
                process.stdout.write(data);
            });

            playwrightProcess.stderr.on('data', (data) => {
                stderr += data.toString();
                process.stderr.write(data);
            });

            playwrightProcess.on('close', (code) => {
                console.log(`\n🎭 Playwright tests completed with code: ${code}`);

                // Try to parse Playwright results
                try {
                    const playwrightResults = JSON.parse(stdout);
                    this.testResults.results.push({
                        test: 'Playwright E2E Suite',
                        status: code === 0 ? 'PASSED' : 'FAILED',
                        details: playwrightResults,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    this.testResults.results.push({
                        test: 'Playwright E2E Suite',
                        status: code === 0 ? 'PASSED' : 'FAILED',
                        error: stderr || 'Unknown error',
                        timestamp: new Date().toISOString()
                    });
                }

                resolve();
            });
        });
    }

    async generateReport() {
        console.log('\n📊 Step 3: Generating Test Report...');

        const totalTests = this.testResults.results.length;
        const passedTests = this.testResults.results.filter(r => r.status === 'PASSED').length;
        const failedTests = this.testResults.results.filter(r => r.status === 'FAILED').length;

        console.log('\n📈 Test Summary:');
        console.log(`   Total Tests: ${totalTests}`);
        console.log(`   Passed: ${passedTests}`);
        console.log(`   Failed: ${failedTests}`);
        console.log(`   Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

        this.testResults.summary = {
            total: totalTests,
            passed: passedTests,
            failed: failedTests,
            successRate: `${((passedTests / totalTests) * 100).toFixed(1)}%`
        };
    }

    async saveResults() {
        console.log('\n💾 Saving Test Results...');

        try {
            // Ensure results directory exists
            const resultsDir = 'test-results';
            if (!fs.existsSync(resultsDir)) {
                fs.mkdirSync(resultsDir, { recursive: true });
            }

            // Save detailed results
            const resultsFile = path.join(resultsDir, 'e2e-test-results.json');
            fs.writeFileSync(resultsFile, JSON.stringify(this.testResults, null, 2));
            console.log(`📄 Results saved: ${resultsFile}`);

            // Save summary report
            const summaryFile = path.join(resultsDir, 'e2e-summary.txt');
            const summaryContent = `
Anvil Bridge E2E Test Summary
Generated: ${this.testResults.timestamp}

Environment:
- Anvil Server: ${this.testResults.environment.anvilServer}
- Bridge Server: ${this.testResults.environment.bridgeServer}
- WebSocket URL: ${this.testResults.environment.websocketUrl}

Results:
- Total Tests: ${this.testResults.summary?.total || 'N/A'}
- Passed: ${this.testResults.summary?.passed || 'N/A'}
- Failed: ${this.testResults.summary?.failed || 'N/A'}
- Success Rate: ${this.testResults.summary?.successRate || 'N/A'}

Test Details:
${this.testResults.results.map(r =>
                `- ${r.test}: ${r.status}${r.error ? ` (${r.error})` : ''}`
            ).join('\n')}

Next Steps:
1. Review detailed test results in e2e-test-results.json
2. Check Playwright HTML report if available
3. Address any failed tests before deployment
4. Verify no server-side detection occurred
5. Confirm performance benchmarks were met
      `.trim();

            fs.writeFileSync(summaryFile, summaryContent);
            console.log(`📄 Summary saved: ${summaryFile}`);

        } catch (error) {
            console.error('❌ Failed to save results:', error);
        }
    }
}

// Usage instructions
function printUsage() {
    console.log(`
🧪 Anvil Bridge E2E Test Runner

Usage:
  node tools/run-e2e-tests.js

Prerequisites:
1. Anvil server running on localhost:3030
2. Bridge server running on localhost:3000 
3. PostgreSQL running (for Anvil server)

Environment Variables:
- E2E_ANVIL_URL: Anvil server URL (default: http://localhost:3030)
- E2E_BRIDGE_URL: Bridge server URL (default: http://localhost:3000)
- E2E_WS_URL: WebSocket URL (default: ws://localhost:3001)

Example:
  E2E_ANVIL_URL=http://localhost:3030 E2E_BRIDGE_URL=http://localhost:3000 node tools/run-e2e-tests.js
  `);
}

// Run if called directly
if (require.main === module) {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
        printUsage();
    } else {
        const runner = new E2ETestRunner();
        runner.runTests().catch(console.error);
    }
}

module.exports = E2ETestRunner; 