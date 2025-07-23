#!/usr/bin/env node
/**
 * Test tool for request logging functionality
 * 
 * Usage: node test-request-logger.js [action] [options]
 * 
 * Actions:
 *   test-proxy    - Make test requests through the proxy
 *   view-logs     - View request logs
 *   view-metrics  - View request metrics
 *   clear-logs    - Clear all logs
 */

const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const PROXY_URL = `${BASE_URL}/api/proxy`;
const LOGS_URL = `${BASE_URL}/api/request-logs`;

async function testProxy() {
    console.log('🧪 Testing HTTP proxy with request logging...\n');

    // Test 1: Simple GET request
    console.log('1️⃣ Testing GET request...');
    try {
        const response = await fetch(`${PROXY_URL}/test`, {
            headers: {
                'X-Test-Header': 'test-value'
            }
        });
        const correlationId = response.headers.get('x-correlation-id');
        console.log(`✅ GET request completed - Status: ${response.status}, Correlation ID: ${correlationId}`);
    } catch (error) {
        console.error(`❌ GET request failed:`, error.message);
    }

    // Test 2: POST request with body
    console.log('\n2️⃣ Testing POST request with body...');
    try {
        const response = await fetch(`${PROXY_URL}/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer test-token'
            },
            body: JSON.stringify({
                username: 'testuser',
                email: 'test@example.com',
                password: 'secret123' // Should be sanitized in logs
            })
        });
        const correlationId = response.headers.get('x-correlation-id');
        console.log(`✅ POST request completed - Status: ${response.status}, Correlation ID: ${correlationId}`);
    } catch (error) {
        console.error(`❌ POST request failed:`, error.message);
    }

    // Test 3: Error request
    console.log('\n3️⃣ Testing error request...');
    try {
        const response = await fetch(`${PROXY_URL}/error/404`, {
            method: 'DELETE'
        });
        const correlationId = response.headers.get('x-correlation-id');
        console.log(`✅ DELETE request completed - Status: ${response.status}, Correlation ID: ${correlationId}`);
    } catch (error) {
        console.error(`❌ DELETE request failed:`, error.message);
    }

    // Test 4: Large request
    console.log('\n4️⃣ Testing large request...');
    try {
        const largeData = Array(100).fill({ data: 'test'.repeat(100) });
        const response = await fetch(`${PROXY_URL}/bulk`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(largeData)
        });
        const correlationId = response.headers.get('x-correlation-id');
        console.log(`✅ PUT request completed - Status: ${response.status}, Correlation ID: ${correlationId}`);
    } catch (error) {
        console.error(`❌ PUT request failed:`, error.message);
    }

    console.log('\n✨ Proxy testing completed!');
}

async function viewLogs(options = {}) {
    console.log('📋 Fetching request logs...\n');

    try {
        const params = new URLSearchParams();
        if (options.correlationId) params.append('correlationId', options.correlationId);
        if (options.method) params.append('method', options.method);
        if (options.status) params.append('status', options.status);
        if (options.hasError) params.append('hasError', options.hasError);
        if (options.limit) params.append('limit', options.limit);

        const response = await fetch(`${LOGS_URL}?${params}`);
        const data = await response.json();

        if (options.correlationId && !data.logs) {
            // Single log entry
            console.log('📄 Log Entry:');
            console.log(JSON.stringify(data, null, 2));
        } else {
            // Multiple logs
            console.log(`📊 Found ${data.total} logs (showing ${data.logs.length}):\n`);

            data.logs.forEach(log => {
                const status = log.response?.status || 'pending';
                const duration = log.response?.duration || 'N/A';
                const size = log.response?.size || 0;

                console.log(`[${log.request.correlationId}]`);
                console.log(`  ${log.request.method} ${log.request.path}`);
                console.log(`  Status: ${status}, Duration: ${duration}ms, Size: ${size} bytes`);
                console.log(`  Time: ${log.request.timestamp}`);

                if (log.response?.error) {
                    console.log(`  ❌ Error: ${log.response.error.message}`);
                }

                console.log('');
            });
        }
    } catch (error) {
        console.error('❌ Failed to fetch logs:', error.message);
    }
}

async function viewMetrics() {
    console.log('📊 Fetching request metrics...\n');

    try {
        const response = await fetch(`${LOGS_URL}?metrics=true`);
        const data = await response.json();
        const metrics = data.metrics;

        console.log('📈 Request Metrics:');
        console.log(`  Total Requests: ${metrics.totalRequests}`);
        console.log(`  Average Response Time: ${metrics.averageResponseTime.toFixed(2)}ms`);
        console.log(`  Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%`);

        console.log('\n📊 Status Code Distribution:');
        Object.entries(metrics.statusCodeDistribution).forEach(([code, count]) => {
            console.log(`  ${code}: ${count}`);
        });

        console.log('\n📋 Method Distribution:');
        Object.entries(metrics.methodDistribution).forEach(([method, count]) => {
            console.log(`  ${method}: ${count}`);
        });

        if (metrics.slowestEndpoints.length > 0) {
            console.log('\n🐌 Slowest Endpoints:');
            metrics.slowestEndpoints.forEach((endpoint, index) => {
                console.log(`  ${index + 1}. ${endpoint.path}`);
                console.log(`     Average: ${endpoint.averageTime.toFixed(2)}ms (${endpoint.count} requests)`);
            });
        }
    } catch (error) {
        console.error('❌ Failed to fetch metrics:', error.message);
    }
}

async function clearLogs() {
    console.log('🗑️ Clearing all request logs...\n');

    try {
        const response = await fetch(LOGS_URL, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ all: true, confirm: true })
        });

        const data = await response.json();

        if (response.ok) {
            console.log('✅', data.message);
        } else {
            console.error('❌ Failed to clear logs:', data.error);
        }
    } catch (error) {
        console.error('❌ Failed to clear logs:', error.message);
    }
}

// CLI handling
async function main() {
    const action = process.argv[2];
    const args = process.argv.slice(3);

    console.log('🔍 Request Logger Test Tool\n');

    switch (action) {
        case 'test-proxy':
            await testProxy();
            break;

        case 'view-logs':
            const logOptions = {};
            for (let i = 0; i < args.length; i += 2) {
                const key = args[i].replace('--', '');
                const value = args[i + 1];
                logOptions[key] = value;
            }
            await viewLogs(logOptions);
            break;

        case 'view-metrics':
            await viewMetrics();
            break;

        case 'clear-logs':
            await clearLogs();
            break;

        default:
            console.log('Usage: node test-request-logger.js [action] [options]');
            console.log('\nActions:');
            console.log('  test-proxy    - Make test requests through the proxy');
            console.log('  view-logs     - View request logs');
            console.log('    Options:');
            console.log('      --correlationId <id>  - View specific log');
            console.log('      --method <METHOD>     - Filter by HTTP method');
            console.log('      --status <code>       - Filter by status code');
            console.log('      --hasError <true/false> - Filter by error presence');
            console.log('      --limit <number>      - Limit results');
            console.log('  view-metrics  - View request metrics');
            console.log('  clear-logs    - Clear all logs');
            break;
    }

    console.log('\n👋 Done!');
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
} 