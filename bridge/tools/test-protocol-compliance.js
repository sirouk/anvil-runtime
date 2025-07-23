#!/usr/bin/env node

/**
 * Protocol Compliance Testing Tool
 * 
 * Usage:
 *   node tools/test-protocol-compliance.js record native
 *   node tools/test-protocol-compliance.js record bridge
 *   node tools/test-protocol-compliance.js analyze <native-file> <bridge-file>
 *   node tools/test-protocol-compliance.js demo
 */

const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

// Import our recording and analysis modules
const { TrafficRecorder } = require('../dist/lib/protocol/traffic-recorder');
const { ProtocolAnalyzer } = require('../dist/lib/protocol/protocol-analyzer');

const ANVIL_URL = process.env.ANVIL_URL || 'http://localhost:3030';
const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:3000';
const RECORDINGS_DIR = './protocol-recordings';

// Ensure TypeScript is compiled
async function ensureCompiled() {
    console.log('🔨 Compiling TypeScript...');
    return new Promise((resolve, reject) => {
        const compile = spawn('npm', ['run', 'build'], {
            cwd: path.join(__dirname, '..'),
            stdio: 'inherit'
        });
        compile.on('close', (code) => {
            if (code !== 0) {
                reject(new Error('Compilation failed'));
            } else {
                resolve();
            }
        });
    });
}

// Record traffic using Puppeteer
async function recordTraffic(clientType, url, sessionId) {
    const recorder = new TrafficRecorder(RECORDINGS_DIR);
    const browser = await puppeteer.launch({
        headless: false,
        devtools: true
    });

    try {
        const page = await browser.newPage();

        // Start recording
        await recorder.startRecording(sessionId, clientType, {
            userAgent: await browser.userAgent(),
            appName: 'TestTodoApp',
            version: '1.0.0'
        });

        // Intercept and record all network traffic
        await page.setRequestInterception(true);

        page.on('request', request => {
            if (request.url().includes('/_/')) {
                recorder.recordHttpRequest(
                    sessionId,
                    request.url(),
                    request.method(),
                    request.headers(),
                    request.postData()
                );
            }
            request.continue();
        });

        page.on('response', response => {
            if (response.url().includes('/_/')) {
                response.buffer().then(body => {
                    recorder.recordHttpResponse(
                        sessionId,
                        response.status(),
                        response.headers(),
                        body.toString(),
                        response.timing()?.receiveHeadersEnd
                    );
                }).catch(() => {
                    // Ignore errors reading body
                });
            }
        });

        // Monitor WebSocket traffic
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');

        client.on('Network.webSocketFrameSent', ({ response }) => {
            recorder.recordWebSocketMessage(sessionId, 'client->server',
                JSON.parse(response.payloadData || '{}')
            );
        });

        client.on('Network.webSocketFrameReceived', ({ response }) => {
            recorder.recordWebSocketMessage(sessionId, 'server->client',
                JSON.parse(response.payloadData || '{}')
            );
        });

        console.log(`📹 Recording ${clientType} traffic at ${url}...`);
        console.log('🎯 Perform the following actions:');
        console.log('   1. Wait for app to load');
        console.log('   2. Add a new todo item');
        console.log('   3. Mark it as complete');
        console.log('   4. Delete the item');
        console.log('   5. Close the browser when done');

        await page.goto(url);

        // Wait for user to perform actions and close browser
        await browser.waitForTarget(t => t.url() === 'about:blank', { timeout: 0 });

    } finally {
        await browser.close();
        await recorder.stopRecording(sessionId);
        console.log(`✅ Recording saved for ${clientType} session: ${sessionId}`);
    }
}

// Analyze compliance between recordings
async function analyzeCompliance(nativeFile, bridgeFile) {
    const analyzer = new ProtocolAnalyzer();

    console.log('🔍 Loading recordings...');
    const nativeSession = JSON.parse(await fs.readFile(nativeFile, 'utf-8'));
    const bridgeSession = JSON.parse(await fs.readFile(bridgeFile, 'utf-8'));

    console.log('📊 Analyzing protocol compliance...');
    const result = analyzer.analyze(nativeSession, bridgeSession);

    // Generate and save report
    const report = analyzer.generateReport(result);
    const reportFile = path.join(RECORDINGS_DIR, 'compliance-report.md');
    await fs.writeFile(reportFile, report);

    console.log('\n' + report);
    console.log(`\n📄 Report saved to: ${reportFile}`);

    // Exit with error if compliance score is too low
    if (result.score < 70) {
        console.error('\n❌ Compliance score too low! Bridge may be detectable.');
        process.exit(1);
    }
}

// Demo mode - simulate recordings for testing
async function runDemo() {
    const recorder = new TrafficRecorder(RECORDINGS_DIR);
    const analyzer = new ProtocolAnalyzer();

    console.log('🎭 Running protocol compliance demo...');

    // Create native session
    await recorder.startRecording('demo-native', 'native');

    // Simulate native client traffic
    recorder.recordHttpRequest('demo-native', '/', 'GET', {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': 'anvil-session=1234567890abcdef'
    });

    recorder.recordHttpResponse('demo-native', 200, {
        'content-type': 'text/html',
        'x-anvil-cacheable': 'true'
    }, null, 85);

    recorder.recordWebSocketMessage('demo-native', 'client->server', {
        type: 'SESSION_INIT',
        data: { sessionId: '1234567890abcdef' }
    });

    recorder.recordWebSocketMessage('demo-native', 'server->client', {
        type: 'SESSION_READY',
        data: { authenticated: true }
    });

    // Add heartbeats
    for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        recorder.recordWebSocketMessage('demo-native', 'client->server', {
            type: 'HEARTBEAT'
        });
    }

    await recorder.stopRecording('demo-native');

    // Create bridge session with issues
    await recorder.startRecording('demo-bridge', 'bridge');

    // Bridge has proxy headers (bad!)
    recorder.recordHttpRequest('demo-bridge', '/', 'GET', {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'accept': 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
        'cookie': 'anvil-session=1234567890abcdef',
        'x-forwarded-for': '192.168.1.1',  // Proxy header!
        'via': '1.1 nextjs'  // Proxy header!
    });

    recorder.recordHttpResponse('demo-bridge', 200, {
        'content-type': 'text/html',
        'x-anvil-cacheable': 'true'
    }, null, 250);  // Slower response

    // Different message order
    recorder.recordWebSocketMessage('demo-bridge', 'client->server', {
        type: 'COMPONENT_LOAD'  // Wrong order!
    });

    recorder.recordWebSocketMessage('demo-bridge', 'client->server', {
        type: 'SESSION_INIT',
        data: { sessionId: '1234567890abcdef' }
    });

    recorder.recordWebSocketMessage('demo-bridge', 'server->client', {
        type: 'SESSION_READY',
        data: { authenticated: true }
    });

    // Irregular heartbeats
    for (let i = 0; i < 3; i++) {
        await new Promise(resolve => setTimeout(resolve, 200 + i * 50));
        recorder.recordWebSocketMessage('demo-bridge', 'client->server', {
            type: 'HEARTBEAT'
        });
    }

    await recorder.stopRecording('demo-bridge');

    // Load and analyze
    const recordings = await recorder.listRecordings();
    const nativeFile = recordings.find(f => f.includes('demo-native'));
    const bridgeFile = recordings.find(f => f.includes('demo-bridge'));

    const nativeSession = await recorder.loadSession(path.join(RECORDINGS_DIR, nativeFile));
    const bridgeSession = await recorder.loadSession(path.join(RECORDINGS_DIR, bridgeFile));

    const result = analyzer.analyze(nativeSession, bridgeSession);
    const report = analyzer.generateReport(result);

    console.log('\n' + report);
    console.log('\n✅ Demo completed! This shows how compliance issues are detected.');
}

// Main CLI
async function main() {
    const command = process.argv[2];

    try {
        // Ensure recordings directory exists
        await fs.mkdir(RECORDINGS_DIR, { recursive: true });

        // Compile TypeScript first
        await ensureCompiled();

        switch (command) {
            case 'record':
                const clientType = process.argv[3];
                if (!['native', 'bridge'].includes(clientType)) {
                    console.error('Please specify client type: native or bridge');
                    process.exit(1);
                }

                const url = clientType === 'native' ? ANVIL_URL : BRIDGE_URL;
                const sessionId = `${clientType}-${Date.now()}`;

                await recordTraffic(clientType, url, sessionId);
                break;

            case 'analyze':
                const nativeFile = process.argv[3];
                const bridgeFile = process.argv[4];

                if (!nativeFile || !bridgeFile) {
                    console.error('Please provide both native and bridge recording files');
                    process.exit(1);
                }

                await analyzeCompliance(nativeFile, bridgeFile);
                break;

            case 'demo':
                await runDemo();
                break;

            default:
                console.log('Protocol Compliance Testing Tool');
                console.log('\nUsage:');
                console.log('  node tools/test-protocol-compliance.js record native');
                console.log('  node tools/test-protocol-compliance.js record bridge');
                console.log('  node tools/test-protocol-compliance.js analyze <native-file> <bridge-file>');
                console.log('  node tools/test-protocol-compliance.js demo');
                console.log('\nEnvironment variables:');
                console.log('  ANVIL_URL - Native Anvil server URL (default: http://localhost:3030)');
                console.log('  BRIDGE_URL - Bridge server URL (default: http://localhost:3000)');
        }
    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main(); 