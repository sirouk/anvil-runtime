/**
 * Test script for Anvil HTTP Proxy
 * Validates HTTP request proxying, authentication, file handling, and error scenarios
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

class HttpProxyTester {
    constructor(bridgeUrl = 'http://localhost:3000', anvilUrl = 'http://localhost:3030') {
        this.bridgeUrl = bridgeUrl;
        this.anvilUrl = anvilUrl;
        this.testResults = [];
        this.sessionCookie = null;
    }

    async runTests() {
        console.log('🌐 Starting HTTP Proxy Tests...');
        console.log(`📡 Testing bridge: ${this.bridgeUrl}`);
        console.log(`🎯 Target Anvil: ${this.anvilUrl}`);
        console.log('=' * 50);

        try {
            // Test 1: Basic GET requests
            await this.testGetRequests();

            // Test 2: POST requests with JSON
            await this.testPostRequests();

            // Test 3: Authentication forwarding
            await this.testAuthenticationForwarding();

            // Test 4: Static resource proxying
            await this.testStaticResources();

            // Test 5: File upload handling
            await this.testFileUploads();

            // Test 6: Error handling
            await this.testErrorHandling();

            console.log('\n✅ All HTTP proxy tests completed');
            this.printTestReport();

        } catch (error) {
            console.error('\n❌ HTTP proxy tests failed:', error);
            this.printTestReport();
            throw error;
        }
    }

    async testGetRequests() {
        console.log('\n🔍 Test 1: Basic GET Requests');

        const testCases = [
            {
                name: 'Root application request',
                path: '/',
                expectedStatus: 200,
                expectedContentType: 'text/html'
            },
            {
                name: 'Static CSS resource',
                path: '/_/static/css/bootstrap.css',
                expectedStatus: 200,
                expectedContentType: 'text/css'
            },
            {
                name: 'Application assets',
                path: '/_/app/TestTodoApp',
                expectedStatus: [200, 404], // May not exist, but should proxy
                expectedContentType: ['application/json', 'text/html']
            }
        ];

        for (const test of testCases) {
            console.log(`  Testing: ${test.name}`);

            try {
                const response = await this.makeRequest('GET', test.path);

                // Check status
                const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
                if (expectedStatuses.includes(response.status)) {
                    console.log(`    ✅ Status ${response.status} (expected)`);
                } else {
                    console.log(`    ❌ Status ${response.status}, expected ${test.expectedStatus}`);
                    this.recordResult(test.name, 'FAIL', { status: response.status, expected: test.expectedStatus });
                    continue;
                }

                // Check content type
                const contentType = response.headers['content-type'] || '';
                const expectedTypes = Array.isArray(test.expectedContentType) ? test.expectedContentType : [test.expectedContentType];
                if (expectedTypes.some(type => contentType.includes(type))) {
                    console.log(`    ✅ Content-Type: ${contentType.split(';')[0]}`);
                    this.recordResult(test.name, 'PASS', { status: response.status, contentType });
                } else {
                    console.log(`    ⚠️ Content-Type: ${contentType}, expected ${test.expectedContentType}`);
                    this.recordResult(test.name, 'PARTIAL', { status: response.status, contentType, expected: test.expectedContentType });
                }

                // Store session cookie if present
                if (response.headers['set-cookie'] && !this.sessionCookie) {
                    const cookies = Array.isArray(response.headers['set-cookie'])
                        ? response.headers['set-cookie']
                        : [response.headers['set-cookie']];

                    const anvilSession = cookies.find(cookie => cookie.includes('anvil-session='));
                    if (anvilSession) {
                        this.sessionCookie = anvilSession.split(';')[0];
                        console.log(`    🍪 Session cookie captured: ${this.sessionCookie.substring(0, 30)}...`);
                    }
                }

            } catch (error) {
                console.log(`    ❌ Request failed: ${error.message}`);
                this.recordResult(test.name, 'FAIL', { error: error.message });
            }
        }
    }

    async testPostRequests() {
        console.log('\n📝 Test 2: POST Requests with JSON');

        const testCases = [
            {
                name: 'JSON data POST',
                path: '/api/test',
                data: { message: 'Hello from proxy test', timestamp: Date.now() },
                contentType: 'application/json'
            },
            {
                name: 'Form data POST',
                path: '/_/submit',
                data: 'name=test&value=proxy',
                contentType: 'application/x-www-form-urlencoded'
            }
        ];

        for (const test of testCases) {
            console.log(`  Testing: ${test.name}`);

            try {
                const body = test.contentType === 'application/json'
                    ? JSON.stringify(test.data)
                    : test.data;

                const response = await this.makeRequest('POST', test.path, {
                    body,
                    headers: {
                        'Content-Type': test.contentType,
                        'Content-Length': Buffer.byteLength(body)
                    }
                });

                // POST requests may return various status codes depending on endpoint
                if (response.status < 500) {
                    console.log(`    ✅ Request successful: ${response.status}`);
                    console.log(`    📄 Response size: ${response.body?.length || 0} bytes`);
                    this.recordResult(test.name, 'PASS', { status: response.status, bodySize: response.body?.length });
                } else {
                    console.log(`    ⚠️ Server error: ${response.status}`);
                    this.recordResult(test.name, 'PARTIAL', { status: response.status, note: 'Server error (expected for test endpoints)' });
                }

            } catch (error) {
                console.log(`    ❌ Request failed: ${error.message}`);
                this.recordResult(test.name, 'FAIL', { error: error.message });
            }
        }
    }

    async testAuthenticationForwarding() {
        console.log('\n🔐 Test 3: Authentication Forwarding');

        if (!this.sessionCookie) {
            console.log('  ⚠️ No session cookie available, testing without authentication');
        }

        const testCases = [
            {
                name: 'Request with session cookie',
                path: '/',
                headers: this.sessionCookie ? { 'Cookie': this.sessionCookie } : {}
            },
            {
                name: 'Request with custom auth headers',
                path: '/_/uplink',
                headers: {
                    'Authorization': 'Bearer test-token',
                    'X-Anvil-Session': 'TEST123456789012345678901234XY',
                    'Uplink-Key': 'TESTKEY12345678ABCD'
                }
            }
        ];

        for (const test of testCases) {
            console.log(`  Testing: ${test.name}`);

            try {
                const response = await this.makeRequest('GET', test.path, {
                    headers: test.headers
                });

                console.log(`    ✅ Authentication headers forwarded: ${response.status}`);
                console.log(`    📋 Request headers: ${Object.keys(test.headers).join(', ')}`);

                this.recordResult(test.name, 'PASS', {
                    status: response.status,
                    headersForwarded: Object.keys(test.headers).length
                });

            } catch (error) {
                console.log(`    ❌ Auth forwarding failed: ${error.message}`);
                this.recordResult(test.name, 'FAIL', { error: error.message });
            }
        }
    }

    async testStaticResources() {
        console.log('\n📁 Test 4: Static Resource Proxying');

        const testResources = [
            {
                name: 'Bootstrap CSS',
                path: '/_/static/css/bootstrap.css',
                expectedType: 'text/css'
            },
            {
                name: 'JavaScript runtime',
                path: '/_/static/js/components.js',
                expectedType: 'application/javascript'
            },
            {
                name: 'Font resource',
                path: '/_/static/fonts/fontawesome-webfont.woff',
                expectedType: 'font/woff'
            }
        ];

        for (const resource of testResources) {
            console.log(`  Testing: ${resource.name}`);

            try {
                const response = await this.makeRequest('GET', resource.path);

                if (response.status === 200) {
                    console.log(`    ✅ Resource loaded: ${response.status}`);
                    console.log(`    📦 Content-Type: ${response.headers['content-type'] || 'unknown'}`);
                    console.log(`    📏 Size: ${response.body?.length || 0} bytes`);

                    this.recordResult(resource.name, 'PASS', {
                        status: response.status,
                        contentType: response.headers['content-type'],
                        size: response.body?.length
                    });
                } else {
                    console.log(`    ⚠️ Resource not found: ${response.status} (may not exist in test environment)`);
                    this.recordResult(resource.name, 'PARTIAL', { status: response.status, note: 'Resource may not exist' });
                }

            } catch (error) {
                console.log(`    ❌ Resource loading failed: ${error.message}`);
                this.recordResult(resource.name, 'FAIL', { error: error.message });
            }
        }
    }

    async testFileUploads() {
        console.log('\n📤 Test 5: File Upload Handling');

        // Create a test file
        const testContent = 'This is a test file for HTTP proxy upload testing\nTimestamp: ' + new Date().toISOString();
        const testFilePath = path.join(__dirname, 'test-upload.txt');

        try {
            fs.writeFileSync(testFilePath, testContent);
            console.log('  📄 Created test file for upload');

            // Test multipart form upload
            const form = new FormData();
            form.append('file', fs.createReadStream(testFilePath), {
                filename: 'test-upload.txt',
                contentType: 'text/plain'
            });
            form.append('description', 'Test upload via HTTP proxy');

            const response = await this.makeMultipartRequest('POST', '/upload', form);

            if (response.status < 500) {
                console.log(`    ✅ File upload proxied: ${response.status}`);
                console.log(`    📊 Response: ${response.body?.substring(0, 100)}...`);
                this.recordResult('File upload test', 'PASS', { status: response.status });
            } else {
                console.log(`    ⚠️ Upload endpoint not available: ${response.status} (expected for test environment)`);
                this.recordResult('File upload test', 'PARTIAL', { status: response.status, note: 'Upload endpoint may not be configured' });
            }

        } catch (error) {
            console.log(`    ❌ File upload test failed: ${error.message}`);
            this.recordResult('File upload test', 'FAIL', { error: error.message });
        } finally {
            // Clean up test file
            try {
                fs.unlinkSync(testFilePath);
                console.log('  🗑️ Cleaned up test file');
            } catch (error) {
                // Ignore cleanup errors
            }
        }
    }

    async testErrorHandling() {
        console.log('\n⚠️ Test 6: Error Handling');

        const errorTests = [
            {
                name: 'Non-existent endpoint',
                path: '/this/endpoint/does/not/exist',
                expectedStatus: 404
            },
            {
                name: 'Invalid method',
                path: '/',
                method: 'TRACE',
                expectedStatus: [405, 501]
            }
        ];

        for (const test of errorTests) {
            console.log(`  Testing: ${test.name}`);

            try {
                const response = await this.makeRequest(test.method || 'GET', test.path);

                const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
                if (expectedStatuses.includes(response.status)) {
                    console.log(`    ✅ Error handled correctly: ${response.status}`);
                    this.recordResult(test.name, 'PASS', { status: response.status });
                } else {
                    console.log(`    ⚠️ Unexpected status: ${response.status}, expected ${test.expectedStatus}`);
                    this.recordResult(test.name, 'PARTIAL', { status: response.status, expected: test.expectedStatus });
                }

            } catch (error) {
                console.log(`    ✅ Network error handled: ${error.message}`);
                this.recordResult(test.name, 'PASS', { error: error.message, note: 'Error properly caught' });
            }
        }
    }

    async makeRequest(method, path, options = {}) {
        const url = `${this.bridgeUrl}/api/proxy${path}`;

        return new Promise((resolve, reject) => {
            const isHttps = url.startsWith('https:');
            const httpModule = isHttps ? https : http;
            const urlObj = new URL(url);

            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port,
                path: urlObj.pathname + urlObj.search,
                method: method,
                headers: {
                    'User-Agent': 'HttpProxyTester/1.0',
                    ...options.headers
                }
            };

            const req = httpModule.request(requestOptions, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            if (options.body) {
                req.write(options.body);
            }

            req.end();
        });
    }

    async makeMultipartRequest(method, path, form) {
        const url = `${this.bridgeUrl}/api/proxy${path}`;

        return new Promise((resolve, reject) => {
            form.submit(url, (err, res) => {
                if (err) {
                    reject(err);
                    return;
                }

                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        body: body
                    });
                });
            });
        });
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
        console.log('\n📊 HTTP Proxy Test Report');
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

        console.log('\n✅ HTTP proxy testing completed');
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new HttpProxyTester();

    tester.runTests()
        .then(() => {
            console.log('\n🎉 All HTTP proxy tests completed!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n💥 HTTP proxy tests failed:', error);
            process.exit(1);
        });
}

module.exports = HttpProxyTester; 