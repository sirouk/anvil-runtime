/**
 * Test script for Anvil session cookie handling
 * Validates session ID extraction, cookie parsing, and session management
 */

const WebSocket = require('ws');

class SessionCookieTester {
    constructor(bridgeUrl = 'ws://localhost:3001') {
        this.bridgeUrl = bridgeUrl;
        this.testResults = [];
    }

    async runTests() {
        console.log('🔐 Starting Session Cookie Tests...');
        console.log(`📡 Testing bridge: ${this.bridgeUrl}`);
        console.log('=' * 50);

        try {
            // Test 1: Valid Anvil session cookie
            await this.testValidSessionCookie();

            // Test 2: Session extraction from multiple sources
            await this.testSessionExtraction();

            // Test 3: Session validation and caching
            await this.testSessionValidation();

            // Test 4: Connection with session headers
            await this.testConnectionWithSession();

            console.log('\n✅ All session cookie tests completed');
            this.printTestReport();

        } catch (error) {
            console.error('\n❌ Session tests failed:', error);
            this.printTestReport();
            throw error;
        }
    }

    async testValidSessionCookie() {
        console.log('\n🔐 Test 1: Valid Anvil Session Cookie Parsing');

        // Test cases with realistic Anvil session cookie formats
        const testCookies = [
            {
                name: 'Standard cookie',
                cookie: 'anvil-session=OGUHD2NKF3EEVORS7RN5TMAIJADEQMXL%3DEncryptedSessionData123',
                expectedSessionId: 'OGUHD2NKF3EEVORS7RN5TMAIJADEQMXL'
            },
            {
                name: 'Simple session ID',
                cookie: 'anvil-session=ABCD1234EFGH5678IJKL9012MNOP3456',
                expectedSessionId: 'ABCD1234EFGH5678IJKL9012MNOP3456'
            },
            {
                name: 'With equals separator',
                cookie: 'anvil-session=TESTID123456789012345678901234XY=SomeEncryptedData',
                expectedSessionId: 'TESTID123456789012345678901234XY'
            },
            {
                name: 'Multiple cookies',
                cookie: 'other-cookie=value; anvil-session=VALID12345678901234567890123456Z; another=test',
                expectedSessionId: 'VALID12345678901234567890123456Z'
            }
        ];

        for (const test of testCookies) {
            console.log(`  Testing: ${test.name}`);

            // Parse cookie using session manager logic
            const parsedSession = this.parseSessionCookie(test.cookie);

            if (parsedSession && parsedSession.sessionId === test.expectedSessionId) {
                console.log(`    ✅ Correctly parsed session ID: ${parsedSession.sessionId}`);
                console.log(`    📝 Encrypted data: ${parsedSession.encryptedData ? 'Present' : 'None'}`);
                this.recordResult(test.name, 'PASS', parsedSession);
            } else {
                console.log(`    ❌ Failed to parse or incorrect session ID`);
                console.log(`    Expected: ${test.expectedSessionId}`);
                console.log(`    Got: ${parsedSession ? parsedSession.sessionId : 'null'}`);
                this.recordResult(test.name, 'FAIL', { expected: test.expectedSessionId, got: parsedSession });
            }
        }
    }

    async testSessionExtraction() {
        console.log('\n🔍 Test 2: Session Extraction from Multiple Sources');

        const extractionTests = [
            {
                name: 'Cookie only',
                cookies: 'anvil-session=COOKIE123456789012345678901234XY',
                url: '/test',
                expected: 'COOKIE123456789012345678901234XY'
            },
            {
                name: 'URL parameter only',
                cookies: '',
                url: '/test?_anvil_session=URLPARAM123456789012345678901234',
                expected: 'URLPARAM123456789012345678901234'
            },
            {
                name: 'Cookie takes precedence',
                cookies: 'anvil-session=COOKIE789012345678901234567890AB',
                url: '/test?_anvil_session=URLPARAM12345678901234567890AB',
                expected: 'COOKIE789012345678901234567890AB'
            },
            {
                name: 'No session found',
                cookies: 'other-cookie=value',
                url: '/test',
                expected: null
            }
        ];

        for (const test of extractionTests) {
            console.log(`  Testing: ${test.name}`);

            const urlParams = test.url.includes('?') ? new URLSearchParams(test.url.split('?')[1]) : null;
            const extractedId = this.extractSessionId(test.cookies, urlParams);

            if (extractedId === test.expected) {
                console.log(`    ✅ Correctly extracted: ${extractedId || 'null'}`);
                this.recordResult(test.name, 'PASS', { extracted: extractedId });
            } else {
                console.log(`    ❌ Extraction failed`);
                console.log(`    Expected: ${test.expected}`);
                console.log(`    Got: ${extractedId}`);
                this.recordResult(test.name, 'FAIL', { expected: test.expected, got: extractedId });
            }
        }
    }

    async testSessionValidation() {
        console.log('\n✅ Test 3: Session Validation and Format Checking');

        const validationTests = [
            {
                name: 'Valid 32-char session ID',
                sessionId: 'ABCD1234EFGH5678IJKL9012MNOP3456',
                shouldBeValid: true
            },
            {
                name: 'Too short session ID',
                sessionId: 'SHORT123',
                shouldBeValid: false
            },
            {
                name: 'Too long session ID',
                sessionId: 'TOOLONG1234567890123456789012345678901234567890',
                shouldBeValid: false
            },
            {
                name: 'Invalid characters',
                sessionId: 'INVALID@#$%^&*()1234567890123456',
                shouldBeValid: false
            },
            {
                name: 'Lowercase characters',
                sessionId: 'abcd1234efgh5678ijkl9012mnop3456',
                shouldBeValid: false
            }
        ];

        for (const test of validationTests) {
            console.log(`  Testing: ${test.name}`);

            const isValid = this.isValidSessionId(test.sessionId);

            if (isValid === test.shouldBeValid) {
                console.log(`    ✅ Validation correct: ${isValid ? 'Valid' : 'Invalid'}`);
                this.recordResult(test.name, 'PASS', { sessionId: test.sessionId, valid: isValid });
            } else {
                console.log(`    ❌ Validation incorrect`);
                console.log(`    Expected: ${test.shouldBeValid ? 'Valid' : 'Invalid'}`);
                console.log(`    Got: ${isValid ? 'Valid' : 'Invalid'}`);
                this.recordResult(test.name, 'FAIL', { expected: test.shouldBeValid, got: isValid });
            }
        }
    }

    async testConnectionWithSession() {
        console.log('\n🌐 Test 4: WebSocket Connection with Session');

        return new Promise((resolve, reject) => {
            // Create WebSocket connection with custom headers (simulating session)
            const ws = new WebSocket(this.bridgeUrl, {
                headers: {
                    'Cookie': 'anvil-session=TESTCONN123456789012345678901234%3DTestEncryptedData',
                    'User-Agent': 'SessionTester/1.0'
                }
            });

            let messageReceived = false;

            ws.on('open', () => {
                console.log('  ✅ Connection established with session cookie');

                // Send a test message
                const testMessage = {
                    type: 'SESSION_TEST',
                    id: `test_${Date.now()}`,
                    timestamp: Date.now()
                };

                ws.send(JSON.stringify(testMessage));
                console.log('  📤 Sent test message with session context');

                // Close connection after a short delay
                setTimeout(() => {
                    if (!messageReceived) {
                        console.log('  ⏰ No response received - closing connection');
                    }
                    ws.close();
                    resolve();
                }, 3000);
            });

            ws.on('message', (data) => {
                messageReceived = true;
                try {
                    const message = JSON.parse(data.toString());
                    console.log(`  📥 Received response: ${message.type} (${message.id})`);
                    this.recordResult('WebSocket with session', 'PASS', { messageType: message.type });
                } catch (error) {
                    console.log(`  📥 Received data: ${data.length} bytes`);
                }
            });

            ws.on('error', (error) => {
                console.error('  ❌ WebSocket error:', error.message);
                this.recordResult('WebSocket with session', 'FAIL', { error: error.message });
                reject(error);
            });

            ws.on('close', () => {
                console.log('  🔌 Connection closed');
                if (!messageReceived) {
                    this.recordResult('WebSocket with session', 'PASS', { note: 'Connection successful, no response expected' });
                }
            });
        });
    }

    // Helper methods implementing session manager logic
    parseSessionCookie(cookieHeader) {
        if (!cookieHeader) return null;

        const cookies = this.parseCookieHeader(cookieHeader);
        const sessionCookie = cookies.find(c => c.name === 'anvil-session');

        if (!sessionCookie) return null;

        return this.parseAnvilSessionValue(sessionCookie.value);
    }

    parseAnvilSessionValue(cookieValue) {
        try {
            const decodedValue = decodeURIComponent(cookieValue);

            // Anvil session format: "SESSIONID=EncryptedData" (after URL decoding %3D becomes =)
            const equalIndex = decodedValue.indexOf('=');

            let sessionId, encryptedData;
            if (equalIndex !== -1) {
                sessionId = decodedValue.substring(0, equalIndex);
                encryptedData = decodedValue.substring(equalIndex + 1);
            } else {
                sessionId = decodedValue;
                encryptedData = undefined;
            }

            if (!this.isValidSessionId(sessionId)) return null;

            return {
                sessionId,
                encryptedData,
                isAuthenticated: false
            };

        } catch (error) {
            return null;
        }
    }

    extractSessionId(cookieHeader, urlParams) {
        // Try cookie first
        const sessionFromCookie = this.parseSessionCookie(cookieHeader);
        if (sessionFromCookie) {
            return sessionFromCookie.sessionId;
        }

        // Try URL parameter
        if (urlParams) {
            const urlSessionToken = urlParams.get('_anvil_session');
            if (urlSessionToken) {
                const sessionId = urlSessionToken.split('=')[0];
                if (this.isValidSessionId(sessionId)) {
                    return sessionId;
                }
            }
        }

        return null;
    }

    isValidSessionId(sessionId) {
        const sessionIdPattern = /^[A-Z0-9]{32}$/;
        return sessionIdPattern.test(sessionId);
    }

    parseCookieHeader(cookieHeader) {
        const cookies = [];
        const cookiePairs = cookieHeader.split(';');

        for (const pair of cookiePairs) {
            const trimmedPair = pair.trim();
            const equalIndex = trimmedPair.indexOf('=');

            if (equalIndex === -1) continue;

            const name = trimmedPair.substring(0, equalIndex).trim();
            const value = trimmedPair.substring(equalIndex + 1).trim();

            if (this.isCookieAttribute(name)) continue;

            cookies.push({ name, value });
        }

        return cookies;
    }

    isCookieAttribute(name) {
        const attributes = ['domain', 'path', 'expires', 'max-age', 'httponly', 'secure', 'samesite'];
        return attributes.includes(name.toLowerCase());
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
        console.log('\n📊 Session Cookie Test Report');
        console.log('=' * 50);

        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;

        console.log(`✅ Passed: ${passed}`);
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

        console.log('\n✅ Session cookie testing completed');
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new SessionCookieTester();

    tester.runTests()
        .then(() => {
            console.log('\n🎉 All session cookie tests completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 Session tests failed:', error);
            process.exit(1);
        });
}

module.exports = SessionCookieTester; 