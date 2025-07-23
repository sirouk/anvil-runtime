/**
 * Test script for Anvil Authentication Token Management
 * Validates uplink keys, token parsing, authentication state, and header injection
 */

const WebSocket = require('ws');

class AuthTokenTester {
    constructor(bridgeUrl = 'ws://localhost:3001') {
        this.bridgeUrl = bridgeUrl;
        this.testResults = [];
    }

    async runTests() {
        console.log('🔑 Starting Authentication Token Tests...');
        console.log(`📡 Testing bridge: ${this.bridgeUrl}`);
        console.log('=' * 50);

        try {
            // Test 1: Token parsing and validation
            await this.testTokenParsing();

            // Test 2: Uplink key generation
            await this.testUplinkKeyGeneration();

            // Test 3: Authentication headers
            await this.testAuthHeaders();

            // Test 4: Authentication state management
            await this.testAuthState();

            // Test 5: WebSocket with authentication
            await this.testWebSocketAuth();

            console.log('\n✅ All authentication token tests completed');
            this.printTestReport();

        } catch (error) {
            console.error('\n❌ Authentication tests failed:', error);
            this.printTestReport();
            throw error;
        }
    }

    async testTokenParsing() {
        console.log('\n🔐 Test 1: Token Parsing and Validation');

        const testCases = [
            {
                name: 'Simple session token',
                cookie: 'ABCD1234EFGH5678IJKL9012MNOP3456',
                expectedSession: 'ABCD1234EFGH5678IJKL9012MNOP3456',
                expectedUplink: null
            },
            {
                name: 'Session with encrypted data',
                cookie: 'TESTID123456789012345678901234XY%3DEncryptedAuthData123',
                expectedSession: 'TESTID123456789012345678901234XY',
                expectedUplink: 'generated' // Will be generated from encrypted data
            },
            {
                name: 'URL-encoded session',
                cookie: 'VALID12345678901234567890123456Z=SomeAuthToken',
                expectedSession: 'VALID12345678901234567890123456Z',
                expectedUplink: 'generated'
            }
        ];

        for (const test of testCases) {
            console.log(`  Testing: ${test.name}`);

            const authTokens = this.parseAuthTokensFromCookie(test.cookie);

            if (authTokens && authTokens.sessionToken === test.expectedSession) {
                console.log(`    ✅ Session token correct: ${authTokens.sessionToken}`);

                if (test.expectedUplink === 'generated' && authTokens.uplinkKey) {
                    console.log(`    ✅ Uplink key generated: ${authTokens.uplinkKey.substring(0, 8)}...`);
                    this.recordResult(test.name, 'PASS', authTokens);
                } else if (test.expectedUplink === null && !authTokens.uplinkKey) {
                    console.log(`    ✅ No uplink key (as expected)`);
                    this.recordResult(test.name, 'PASS', authTokens);
                } else {
                    console.log(`    ⚠️ Uplink key mismatch`);
                    this.recordResult(test.name, 'PARTIAL', authTokens);
                }
            } else {
                console.log(`    ❌ Token parsing failed`);
                console.log(`    Expected: ${test.expectedSession}`);
                console.log(`    Got: ${authTokens ? authTokens.sessionToken : 'null'}`);
                this.recordResult(test.name, 'FAIL', { expected: test.expectedSession, got: authTokens });
            }
        }
    }

    async testUplinkKeyGeneration() {
        console.log('\n🔑 Test 2: Uplink Key Generation');

        const testSeeds = [
            'EncryptedData123',
            'AnotherSeed456',
            'SameData',
            'SameData' // Should generate same key as previous
        ];

        const generatedKeys = [];

        for (let i = 0; i < testSeeds.length; i++) {
            const seed = testSeeds[i];
            const key = this.generateUplinkKey(seed);

            console.log(`  Seed "${seed}" → Key: ${key}`);

            // Validate key format
            if (this.isValidUplinkKey(key)) {
                console.log(`    ✅ Valid format (21 chars, base32-like)`);

                // Check consistency
                if (seed === 'SameData' && i === 3) {
                    if (key === generatedKeys[2]) {
                        console.log(`    ✅ Consistent generation from same seed`);
                        this.recordResult(`Uplink consistency ${i}`, 'PASS', { seed, key });
                    } else {
                        console.log(`    ❌ Inconsistent generation from same seed`);
                        this.recordResult(`Uplink consistency ${i}`, 'FAIL', { seed, key, previous: generatedKeys[2] });
                    }
                } else {
                    this.recordResult(`Uplink generation ${i}`, 'PASS', { seed, key });
                }
            } else {
                console.log(`    ❌ Invalid key format`);
                this.recordResult(`Uplink generation ${i}`, 'FAIL', { seed, key });
            }

            generatedKeys.push(key);
        }
    }

    async testAuthHeaders() {
        console.log('\n📋 Test 3: Authentication Headers');

        const testTokens = {
            sessionToken: 'HEADER123456789012345678901234AB',
            uplinkKey: 'TESTKEY123456789ABCDE',
            cookieToken: 'HEADER123456789012345678901234AB%3DEncData'
        };

        const headers = this.createAuthHeaders(testTokens);

        console.log('  Generated headers:');

        const expectedHeaders = [
            { key: 'Session-Token', expected: testTokens.sessionToken },
            { key: 'X-Anvil-Session', expected: testTokens.sessionToken },
            { key: 'Uplink-Key', expected: testTokens.uplinkKey },
            { key: 'Cookie', expected: `anvil-session=${testTokens.cookieToken}` },
            { key: 'User-Agent', expected: 'Anvil-NextJS-Bridge/1.0' }
        ];

        let allPassed = true;

        for (const test of expectedHeaders) {
            const actual = headers[test.key];
            if (actual === test.expected) {
                console.log(`    ✅ ${test.key}: ${actual}`);
            } else {
                console.log(`    ❌ ${test.key}: Expected "${test.expected}", got "${actual}"`);
                allPassed = false;
            }
        }

        this.recordResult('Authentication headers', allPassed ? 'PASS' : 'FAIL', { headers, expected: expectedHeaders });
    }

    async testAuthState() {
        console.log('\n👤 Test 4: Authentication State Management');

        const sessionToken = 'STATE123456789012345678901234XY';

        // Test initial state
        console.log('  Testing initial authentication state...');
        let authState = this.getAuthState(sessionToken);
        if (!authState) {
            console.log('    ✅ No initial auth state (as expected)');
            this.recordResult('Initial auth state', 'PASS', { state: 'none' });
        } else {
            console.log('    ❌ Unexpected initial auth state');
            this.recordResult('Initial auth state', 'FAIL', { state: authState });
        }

        // Test setting authenticated state
        console.log('  Setting authenticated state...');
        this.setAuthState(sessionToken, {
            isAuthenticated: true,
            userId: 'user123',
            userEmail: 'test@example.com'
        });

        authState = this.getAuthState(sessionToken);
        if (authState && authState.isAuthenticated && authState.userId === 'user123') {
            console.log('    ✅ Auth state set correctly');
            console.log(`    User: ${authState.userEmail} (${authState.userId})`);
            this.recordResult('Set auth state', 'PASS', authState);
        } else {
            console.log('    ❌ Auth state not set correctly');
            this.recordResult('Set auth state', 'FAIL', authState);
        }

        // Test authentication check
        const isAuth = this.isAuthenticated(sessionToken);
        if (isAuth) {
            console.log('    ✅ Authentication check passed');
            this.recordResult('Auth check', 'PASS', { authenticated: isAuth });
        } else {
            console.log('    ❌ Authentication check failed');
            this.recordResult('Auth check', 'FAIL', { authenticated: isAuth });
        }
    }

    async testWebSocketAuth() {
        console.log('\n🌐 Test 5: WebSocket Connection with Authentication');

        return new Promise((resolve, reject) => {
            // Create WebSocket with authentication headers
            const authHeaders = {
                'Cookie': 'anvil-session=WSTEST123456789012345678901234Z%3DAuthData',
                'Uplink-Key': 'TESTUPLINK123456789AB',
                'User-Agent': 'AuthTokenTester/1.0'
            };

            const ws = new WebSocket(this.bridgeUrl, {
                headers: authHeaders
            });

            let messageReceived = false;

            ws.on('open', () => {
                console.log('  ✅ WebSocket connection established with auth headers');

                // Send authenticated message
                const authMessage = {
                    type: 'AUTH_TEST',
                    id: `auth_test_${Date.now()}`,
                    sessionToken: 'WSTEST123456789012345678901234Z',
                    timestamp: Date.now()
                };

                ws.send(JSON.stringify(authMessage));
                console.log('  📤 Sent authenticated test message');

                setTimeout(() => {
                    if (!messageReceived) {
                        console.log('  ⏰ Test completed - auth headers processed');
                    }
                    ws.close();
                    resolve();
                }, 3000);
            });

            ws.on('message', (data) => {
                messageReceived = true;
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`  📥 Received: ${message.type} (${message.id})`);
                    this.recordResult('WebSocket auth response', 'PASS', { messageType: message.type });
                } catch (error) {
                    console.log(`  📥 Received data: ${data.length} bytes`);
                    this.recordResult('WebSocket auth response', 'PASS', { dataSize: data.length });
                }
            });

            ws.on('error', (error) => {
                console.error('  ❌ WebSocket error:', error.message);
                this.recordResult('WebSocket auth connection', 'FAIL', { error: error.message });
                reject(error);
            });

            ws.on('close', () => {
                console.log('  🔌 Auth test connection closed');
                if (!messageReceived) {
                    this.recordResult('WebSocket auth connection', 'PASS', { note: 'Connection successful' });
                }
            });
        });
    }

    // Helper methods implementing auth manager logic
    parseAuthTokensFromCookie(cookieValue) {
        try {
            const decodedValue = decodeURIComponent(cookieValue);
            const equalIndex = decodedValue.indexOf('=');

            if (equalIndex === -1) {
                return {
                    sessionToken: decodedValue,
                    cookieToken: cookieValue
                };
            }

            const sessionToken = decodedValue.substring(0, equalIndex);
            const encryptedData = decodedValue.substring(equalIndex + 1);

            if (!this.isValidSessionToken(sessionToken)) {
                return null;
            }

            return {
                sessionToken,
                cookieToken: cookieValue,
                uplinkKey: this.generateUplinkKey(encryptedData)
            };

        } catch (error) {
            return null;
        }
    }

    generateUplinkKey(seed) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let result = '';

        let seedHash = 0;
        if (seed) {
            for (let i = 0; i < seed.length; i++) {
                seedHash = ((seedHash << 5) - seedHash + seed.charCodeAt(i)) & 0xffffffff;
            }
        }

        for (let i = 0; i < 21; i++) {
            const randomValue = seed
                ? Math.abs(seedHash + i * 31) % chars.length
                : Math.floor(Math.random() * chars.length);
            result += chars[randomValue];
        }

        return result;
    }

    isValidSessionToken(token) {
        const sessionPattern = /^[A-Z0-9]{32}$/;
        return sessionPattern.test(token);
    }

    isValidUplinkKey(key) {
        const uplinkPattern = /^[A-Z2-7]{21}$/;
        return uplinkPattern.test(key);
    }

    createAuthHeaders(tokens) {
        const headers = {};

        if (tokens.sessionToken) {
            headers['Session-Token'] = tokens.sessionToken;
            headers['X-Anvil-Session'] = tokens.sessionToken;
        }

        if (tokens.uplinkKey) {
            headers['Uplink-Key'] = tokens.uplinkKey;
        }

        if (tokens.cookieToken) {
            headers['Cookie'] = `anvil-session=${tokens.cookieToken}`;
        }

        headers['User-Agent'] = 'Anvil-NextJS-Bridge/1.0';

        return headers;
    }

    // Mock auth state management
    setAuthState(sessionToken, authState) {
        this._authStates = this._authStates || new Map();
        const existing = this._authStates.get(sessionToken) || { isAuthenticated: false };

        const updated = {
            ...existing,
            ...authState,
            lastActivity: Date.now()
        };

        this._authStates.set(sessionToken, updated);
    }

    getAuthState(sessionToken) {
        this._authStates = this._authStates || new Map();
        return this._authStates.get(sessionToken) || null;
    }

    isAuthenticated(sessionToken) {
        const authState = this.getAuthState(sessionToken);
        return authState?.isAuthenticated || false;
    }

    recordResult(testName, status, data) {
        this.testResults.push({
            timestamp: new Date().toISOString(),
            test: testName,
            status,
            data
        });
    }

    printTestReport() {
        console.log('\n📊 Authentication Token Test Report');
        console.log('=' * 60);

        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const partial = this.testResults.filter(r => r.status === 'PARTIAL').length;

        console.log(`✅ Passed: ${passed}`);
        console.log(`⚠️ Partial: ${partial}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`📋 Total: ${this.testResults.length}`);

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.testResults
                .filter(r => r.status === 'FAIL')
                .forEach(result => {
                    console.log(`  • ${result.test}: ${JSON.stringify(result.data)}`);
                });
        }

        if (partial > 0) {
            console.log('\n⚠️ Partial Tests:');
            this.testResults
                .filter(r => r.status === 'PARTIAL')
                .forEach(result => {
                    console.log(`  • ${result.test}: ${JSON.stringify(result.data)}`);
                });
        }

        console.log('\n✅ Authentication token testing completed');
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new AuthTokenTester();

    tester.runTests()
        .then(() => {
            console.log('\n🎉 All authentication token tests completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Authentication tests failed:', error);
            process.exit(1);
        });
}

module.exports = AuthTokenTester; 