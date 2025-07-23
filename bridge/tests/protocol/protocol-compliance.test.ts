import { trafficRecorder, TrafficRecorder } from '../../src/lib/protocol/traffic-recorder';
import { protocolAnalyzer } from '../../src/lib/protocol/protocol-analyzer';
import { WebSocketProxy } from '../../src/lib/protocol/websocket-proxy';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock WebSocket
jest.mock('ws');

describe('Protocol Compliance Verification', () => {
    let recorder: TrafficRecorder;

    beforeEach(() => {
        recorder = new TrafficRecorder('./test-recordings');
    });

    afterEach(async () => {
        // Clean up test recordings
        try {
            await fs.rm('./test-recordings', { recursive: true });
        } catch (error) {
            // Ignore if doesn't exist
        }
    });

    describe('Traffic Recording', () => {
        it('should record WebSocket messages', async () => {
            await recorder.startRecording('test-ws', 'bridge');

            // Record some messages
            recorder.recordWebSocketMessage('test-ws', 'client->server', {
                type: 'SESSION_INIT',
                data: { sessionId: 'test123' }
            });

            recorder.recordWebSocketMessage('test-ws', 'server->client', {
                type: 'SESSION_READY',
                data: { authenticated: true }
            });

            recorder.recordWebSocketMessage('test-ws', 'client->server', {
                type: 'HEARTBEAT',
                data: { timestamp: Date.now() }
            });

            await recorder.stopRecording('test-ws');

            // Verify recording was saved
            const recordings = await recorder.listRecordings();
            expect(recordings.length).toBe(1);
            expect(recordings[0]).toContain('bridge-test-ws');
        });

        it('should record HTTP requests and responses', async () => {
            await recorder.startRecording('test-http', 'native');

            // Record HTTP traffic
            recorder.recordHttpRequest('test-http', '/api/test', 'GET', {
                'user-agent': 'Mozilla/5.0',
                'accept': 'application/json'
            });

            recorder.recordHttpResponse('test-http', 200, {
                'content-type': 'application/json'
            }, { success: true }, 125);

            await recorder.stopRecording('test-http');

            const recordings = await recorder.listRecordings();
            expect(recordings.length).toBe(1);
        });

        it('should sanitize sensitive data', async () => {
            await recorder.startRecording('test-sanitize', 'bridge');

            recorder.recordHttpRequest('test-sanitize', '/api/auth', 'POST', {
                'authorization': 'Bearer secret-token',
                'cookie': 'session=secret-session'
            }, {
                username: 'test',
                password: 'secret-password',
                api_key: 'secret-key'
            });

            const session = recorder.getActiveSession('test-sanitize');
            expect(session).toBeDefined();

            const message = session!.messages[0];
            expect(message.metadata?.headers?.authorization).toBe('[REDACTED]');
            expect(message.metadata?.headers?.cookie).toBe('[REDACTED]');
            expect(message.data.password).toBe('[REDACTED]');
            expect(message.data.api_key).toBe('[REDACTED]');
        });
    });

    describe('Protocol Analysis', () => {
        it('should detect forbidden headers', async () => {
            // Create native session
            await recorder.startRecording('native-1', 'native');
            recorder.recordHttpRequest('native-1', '/api/test', 'GET', {
                'user-agent': 'Mozilla/5.0',
                'accept': 'application/json'
            });
            await recorder.stopRecording('native-1');

            // Create bridge session with forbidden headers
            await recorder.startRecording('bridge-1', 'bridge');
            recorder.recordHttpRequest('bridge-1', '/api/test', 'GET', {
                'user-agent': 'Mozilla/5.0',
                'accept': 'application/json',
                'x-forwarded-for': '192.168.1.1',
                'via': '1.1 proxy'
            });
            await recorder.stopRecording('bridge-1');

            // Load and analyze
            const recordings = await recorder.listRecordings();
            const nativeFile = recordings.find(f => f.includes('native-1'));
            const bridgeFile = recordings.find(f => f.includes('bridge-1'));

            const nativeSession = await recorder.loadSession('./test-recordings/' + nativeFile!);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + bridgeFile!);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);

            expect(result.score).toBeLessThan(100);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    severity: 'critical',
                    category: 'headers',
                    message: expect.stringContaining('Proxy-revealing headers detected')
                })
            );
            expect(result.details.headers.forbidden).toContain('x-forwarded-for');
            expect(result.details.headers.forbidden).toContain('via');
        });

        it('should detect missing critical headers', async () => {
            // Native with all headers
            await recorder.startRecording('native-2', 'native');
            recorder.recordHttpRequest('native-2', '/api/test', 'GET', {
                'user-agent': 'Mozilla/5.0',
                'accept': 'application/json',
                'accept-language': 'en-US',
                'cookie': 'session=abc123'
            });
            await recorder.stopRecording('native-2');

            // Bridge missing critical headers
            await recorder.startRecording('bridge-2', 'bridge');
            recorder.recordHttpRequest('bridge-2', '/api/test', 'GET', {
                'accept': 'application/json'
            });
            await recorder.stopRecording('bridge-2');

            const recordings = await recorder.listRecordings();
            const nativeFile = recordings.find(f => f.includes('native-2'));
            const bridgeFile = recordings.find(f => f.includes('bridge-2'));

            const nativeSession = await recorder.loadSession('./test-recordings/' + nativeFile!);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + bridgeFile!);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);

            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    severity: 'critical',
                    category: 'headers',
                    message: expect.stringContaining('Missing critical headers')
                })
            );
        });

        it('should analyze timing differences', async () => {
            // Native with fast responses
            await recorder.startRecording('native-3', 'native');
            recorder.recordHttpRequest('native-3', '/api/test', 'GET', {});
            recorder.recordHttpResponse('native-3', 200, {}, null, 50);
            recorder.recordHttpRequest('native-3', '/api/test2', 'GET', {});
            recorder.recordHttpResponse('native-3', 200, {}, null, 60);
            await recorder.stopRecording('native-3');

            // Bridge with slower responses
            await recorder.startRecording('bridge-3', 'bridge');
            recorder.recordHttpRequest('bridge-3', '/api/test', 'GET', {});
            recorder.recordHttpResponse('bridge-3', 200, {}, null, 150);
            recorder.recordHttpRequest('bridge-3', '/api/test2', 'GET', {});
            recorder.recordHttpResponse('bridge-3', 200, {}, null, 180);
            await recorder.stopRecording('bridge-3');

            const nativeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[0]);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[1]);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);

            expect(result.details.timing.timingDelta).toBeGreaterThan(0.2);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    severity: 'warning',
                    category: 'timing'
                })
            );
        });

        it('should analyze message sequences', async () => {
            // Native sequence
            await recorder.startRecording('native-4', 'native');
            recorder.recordWebSocketMessage('native-4', 'client->server', { type: 'SESSION_INIT' });
            recorder.recordWebSocketMessage('native-4', 'server->client', { type: 'SESSION_READY' });
            recorder.recordWebSocketMessage('native-4', 'client->server', { type: 'COMPONENT_LOAD' });
            recorder.recordWebSocketMessage('native-4', 'server->client', { type: 'COMPONENT_DATA' });
            await recorder.stopRecording('native-4');

            // Bridge with different sequence
            await recorder.startRecording('bridge-4', 'bridge');
            recorder.recordWebSocketMessage('bridge-4', 'client->server', { type: 'SESSION_INIT' });
            recorder.recordWebSocketMessage('bridge-4', 'client->server', { type: 'COMPONENT_LOAD' });
            recorder.recordWebSocketMessage('bridge-4', 'server->client', { type: 'SESSION_READY' });
            recorder.recordWebSocketMessage('bridge-4', 'server->client', { type: 'COMPONENT_DATA' });
            await recorder.stopRecording('bridge-4');

            const nativeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[0]);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[1]);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);

            expect(result.details.messages.sequenceMatch).toBeLessThan(100);
            expect(result.details.messages.outOfOrder).toBeGreaterThan(0);
        });

        it('should analyze authentication flows', async () => {
            // Native auth flow
            await recorder.startRecording('native-5', 'native');
            recorder.recordHttpRequest('native-5', '/auth/login', 'POST', {
                'cookie': 'anvil-session=native123'
            });
            recorder.recordWebSocketMessage('native-5', 'client->server', {
                type: 'SESSION_INIT',
                data: { sessionId: 'native123' }
            });
            await recorder.stopRecording('native-5');

            // Bridge without proper auth
            await recorder.startRecording('bridge-5', 'bridge');
            recorder.recordHttpRequest('bridge-5', '/api/test', 'GET', {});
            recorder.recordWebSocketMessage('bridge-5', 'client->server', {
                type: 'COMPONENT_LOAD'
            });
            await recorder.stopRecording('bridge-5');

            const nativeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[0]);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[1]);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);

            expect(result.details.authentication.authFlowMatch).toBe(false);
            expect(result.issues).toContainEqual(
                expect.objectContaining({
                    severity: 'critical',
                    category: 'authentication'
                })
            );
        });

        it('should generate compliance report', async () => {
            // Create sessions with various issues
            await recorder.startRecording('native-report', 'native');
            recorder.recordHttpRequest('native-report', '/api/test', 'GET', {
                'user-agent': 'Mozilla/5.0'
            });
            await recorder.stopRecording('native-report');

            await recorder.startRecording('bridge-report', 'bridge');
            recorder.recordHttpRequest('bridge-report', '/api/test', 'GET', {
                'user-agent': 'Mozilla/5.0',
                'x-forwarded-for': '192.168.1.1'
            });
            await recorder.stopRecording('bridge-report');

            const nativeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[0]);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[1]);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);
            const report = protocolAnalyzer.generateReport(result);

            expect(report).toContain('Protocol Compliance Report');
            expect(report).toContain('Overall Score:');
            expect(report).toContain('Issues Found:');
            expect(report).toContain('Recommendations:');
        });
    });

    describe('Edge Case Testing', () => {
        it('should handle network failures gracefully', async () => {
            await recorder.startRecording('edge-network', 'bridge');

            // Simulate connection failure
            recorder.recordWebSocketMessage('edge-network', 'client->server', {
                type: 'CONNECTION_ERROR',
                error: 'Network timeout'
            });

            // Simulate reconnection
            recorder.recordWebSocketMessage('edge-network', 'client->server', {
                type: 'SESSION_INIT',
                data: { reconnect: true }
            });

            const session = recorder.getActiveSession('edge-network');
            expect(session?.messages).toHaveLength(2);
        });

        it('should handle large binary data', async () => {
            await recorder.startRecording('edge-binary', 'bridge');

            const largeData = Buffer.alloc(1024 * 1024); // 1MB
            recorder.recordWebSocketMessage('edge-binary', 'client->server', {
                type: 'BINARY_DATA',
                data: largeData.toString('base64')
            });

            const session = recorder.getActiveSession('edge-binary');
            expect(session?.messages[0].metadata?.size).toBeGreaterThan(1000000);
        });

        it('should handle concurrent sessions', async () => {
            // Start multiple recording sessions
            await Promise.all([
                recorder.startRecording('concurrent-1', 'native'),
                recorder.startRecording('concurrent-2', 'bridge'),
                recorder.startRecording('concurrent-3', 'bridge')
            ]);

            // Record to different sessions
            recorder.recordHttpRequest('concurrent-1', '/api/1', 'GET', {});
            recorder.recordHttpRequest('concurrent-2', '/api/2', 'GET', {});
            recorder.recordHttpRequest('concurrent-3', '/api/3', 'GET', {});

            // Stop all sessions
            await Promise.all([
                recorder.stopRecording('concurrent-1'),
                recorder.stopRecording('concurrent-2'),
                recorder.stopRecording('concurrent-3')
            ]);

            const recordings = await recorder.listRecordings();
            expect(recordings).toHaveLength(3);
        });
    });

    describe('Performance Compliance', () => {
        it('should verify heartbeat timing matches', async () => {
            // Native with 30s heartbeats
            await recorder.startRecording('perf-heartbeat-native', 'native');
            const baseTime = Date.now();

            // Simulate heartbeats at 30s intervals
            for (let i = 0; i < 3; i++) {
                recorder.recordWebSocketMessage('perf-heartbeat-native', 'client->server', {
                    type: 'HEARTBEAT',
                    timestamp: baseTime + (i * 30000)
                });
            }
            await recorder.stopRecording('perf-heartbeat-native');

            // Bridge with similar timing
            await recorder.startRecording('perf-heartbeat-bridge', 'bridge');
            for (let i = 0; i < 3; i++) {
                recorder.recordWebSocketMessage('perf-heartbeat-bridge', 'client->server', {
                    type: 'HEARTBEAT',
                    timestamp: baseTime + (i * 30000) + 100 // Small variance
                });
            }
            await recorder.stopRecording('perf-heartbeat-bridge');

            const nativeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[0]);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[1]);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);

            // Should have minimal timing difference
            expect(result.details.timing.heartbeatInterval.native).toBeCloseTo(30000, -2);
            expect(result.details.timing.heartbeatInterval.bridge).toBeCloseTo(30000, -2);
        });

        it('should detect performance degradation', async () => {
            // Native with consistent fast responses
            await recorder.startRecording('perf-degrade-native', 'native');
            for (let i = 0; i < 5; i++) {
                recorder.recordHttpRequest('perf-degrade-native', `/api/test${i}`, 'GET', {});
                recorder.recordHttpResponse('perf-degrade-native', 200, {}, null, 50 + i * 5);
            }
            await recorder.stopRecording('perf-degrade-native');

            // Bridge with degrading performance
            await recorder.startRecording('perf-degrade-bridge', 'bridge');
            for (let i = 0; i < 5; i++) {
                recorder.recordHttpRequest('perf-degrade-bridge', `/api/test${i}`, 'GET', {});
                recorder.recordHttpResponse('perf-degrade-bridge', 200, {}, null, 100 + i * 50);
            }
            await recorder.stopRecording('perf-degrade-bridge');

            const nativeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[0]);
            const bridgeSession = await recorder.loadSession('./test-recordings/' + (await recorder.listRecordings())[1]);

            const result = protocolAnalyzer.analyze(nativeSession, bridgeSession);

            expect(result.details.timing.timingDelta).toBeGreaterThan(0.5);
            expect(result.recommendations).toContain('Optimize proxy performance to match native client timing');
        });
    });
}); 