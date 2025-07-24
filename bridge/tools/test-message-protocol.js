/**
 * Test script for enhanced message protocol handling
 * Tests message parsing, validation, authentication, and Anvil server calls
 */

const WebSocket = require('ws');

class ProtocolTester {
    constructor(bridgeUrl = 'ws://localhost:3001') {
        this.bridgeUrl = bridgeUrl;
        this.ws = null;
        this.messageId = 0;
        this.testResults = [];
    }

    generateMessageId() {
        this.messageId++;
        const timestamp = Date.now().toString(36);
        const counter = this.messageId.toString(36).padStart(3, '0');
        return `test_${timestamp}_${counter}`;
    }

    async runTests() {
        console.log('🧪 Starting Message Protocol Tests...');
        console.log(`📡 Connecting to bridge: ${this.bridgeUrl}`);

        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.bridgeUrl);

            this.ws.on('open', () => {
                console.log('✅ Connected to WebSocket bridge');
                this.runTestSequence().then(resolve).catch(reject);
            });

            this.ws.on('message', (data) => {
                this.handleMessage(data);
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                reject(error);
            });

            this.ws.on('close', (code, reason) => {
                console.log(`🔌 Connection closed: ${code} ${reason}`);
                this.printTestResults();
                resolve(this.testResults);
            });
        });
    }

    async runTestSequence() {
        console.log('\n📋 Running test sequence...\n');

        // Test 1: Session Initialization
        await this.testSessionInit();
        await this.delay(1000);

        // Test 2: Server Function Call
        await this.testServerCall();
        await this.delay(1000);

        // Test 3: Heartbeat
        await this.testHeartbeat();
        await this.delay(1000);

        // Test 4: Invalid Message
        await this.testInvalidMessage();
        await this.delay(1000);

        // Test 5: Binary Data
        await this.testBinaryData();
        await this.delay(2000);

        console.log('\n✅ All tests completed');
        this.ws.close();
    }

    async testSessionInit() {
        console.log('🔐 Test 1: Session Initialization');

        const message = {
            type: 'SESSION_INIT',
            id: this.generateMessageId(),
            payload: {
                appId: 'TestTodoApp',
                clientCapabilities: ['skulpt', 'material_design'],
                runtimeVersion: 'client-core',
                userAgent: 'Protocol-Tester/1.0'
            },
            timestamp: Date.now()
        };

        this.sendMessage(message, 'SESSION_INIT');
    }

    async testServerCall() {
        console.log('📞 Test 2: Server Function Call');

        const message = {
            type: 'CALL',
            id: this.generateMessageId(),
            payload: {
                function: 'get_tasks',
                args: [],
                kwargs: {}
            },
            timestamp: Date.now()
        };

        this.sendMessage(message, 'SERVER_CALL');
    }

    async testHeartbeat() {
        console.log('💓 Test 3: Heartbeat');

        const message = {
            type: 'PING',
            id: this.generateMessageId(),
            timestamp: Date.now()
        };

        this.sendMessage(message, 'HEARTBEAT');
    }

    async testInvalidMessage() {
        console.log('🚫 Test 4: Invalid Message');

        // Send invalid JSON
        const invalidMessage = '{"type": "INVALID", "malformed": json}';

        try {
            this.ws.send(invalidMessage);
            this.addTestResult('INVALID_MESSAGE', 'sent', 'Sent malformed JSON');
        } catch (error) {
            this.addTestResult('INVALID_MESSAGE', 'error', error.message);
        }
    }

    async testBinaryData() {
        console.log('🔢 Test 5: Binary Data');

        // Send binary data
        const binaryData = Buffer.from('This is binary test data', 'utf8');

        try {
            this.ws.send(binaryData);
            this.addTestResult('BINARY_DATA', 'sent', `Sent ${binaryData.length} bytes`);
        } catch (error) {
            this.addTestResult('BINARY_DATA', 'error', error.message);
        }
    }

    sendMessage(message, testType) {
        try {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            this.addTestResult(testType, 'sent', message);
            console.log(`  → Sent ${testType}: ${message.id}`);
        } catch (error) {
            this.addTestResult(testType, 'error', error.message);
            console.error(`  ❌ Failed to send ${testType}:`, error.message);
        }
    }

    handleMessage(data) {
        try {
            const message = JSON.parse(data.toString());
            console.log(`  ← Received: ${message.type || 'unknown'} (${message.id || 'no-id'})`);

            if (message.type === 'ERROR') {
                console.error(`    🚨 Error response:`, message.payload?.error);
            }

            this.addTestResult('RESPONSE', 'received', message);
        } catch (error) {
            console.log(`  ← Received binary/invalid data: ${data.length} bytes`);
            this.addTestResult('RESPONSE', 'binary', { size: data.length });
        }
    }

    addTestResult(test, status, data) {
        this.testResults.push({
            timestamp: new Date().toISOString(),
            test,
            status,
            data
        });
    }

    printTestResults() {
        console.log('\n📊 Test Results Summary:');
        console.log('=' * 50);

        const testCounts = {};
        this.testResults.forEach(result => {
            testCounts[result.test] = (testCounts[result.test] || 0) + 1;
        });

        Object.entries(testCounts).forEach(([test, count]) => {
            console.log(`  ${test}: ${count} events`);
        });

        const errors = this.testResults.filter(r => r.status === 'error');
        if (errors.length > 0) {
            console.log('\n❌ Errors encountered:');
            errors.forEach(error => {
                console.log(`  ${error.test}: ${error.data}`);
            });
        }

        console.log('\n✅ Message protocol testing completed');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new ProtocolTester();

    tester.runTests()
        .then(() => {
            console.log('\n🎉 Protocol testing finished successfully');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Protocol testing failed:', error);
            process.exit(1);
        });
}

module.exports = ProtocolTester; 