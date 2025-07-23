import { TrafficSession, RecordedMessage } from './traffic-recorder';

export interface ComplianceResult {
    score: number; // 0-100
    issues: ComplianceIssue[];
    details: {
        timing: TimingAnalysis;
        headers: HeaderAnalysis;
        messages: MessageAnalysis;
        authentication: AuthAnalysis;
    };
    recommendations: string[];
}

export interface ComplianceIssue {
    severity: 'critical' | 'warning' | 'info';
    category: string;
    message: string;
    details?: any;
}

export interface TimingAnalysis {
    avgRequestTime: { native: number; bridge: number };
    avgResponseTime: { native: number; bridge: number };
    timingDelta: number;
    requestFrequency: { native: number; bridge: number };
    heartbeatInterval: { native: number; bridge: number };
}

export interface HeaderAnalysis {
    identical: string[];
    different: Array<{ header: string; native: string; bridge: string }>;
    nativeOnly: string[];
    bridgeOnly: string[];
    forbidden: string[]; // Headers that reveal proxy usage
}

export interface MessageAnalysis {
    totalMessages: { native: number; bridge: number };
    messageTypes: { native: Record<string, number>; bridge: Record<string, number> };
    sequenceMatch: number; // Percentage
    outOfOrder: number;
    messageSizeDiff: number; // Average percentage difference
}

export interface AuthAnalysis {
    sessionHandling: boolean;
    cookieMatching: boolean;
    tokenConsistency: boolean;
    authFlowMatch: boolean;
}

export class ProtocolAnalyzer {
    private readonly forbiddenHeaders = [
        'x-forwarded-for', 'x-real-ip', 'x-proxy', 'x-bridge',
        'x-nextjs', 'via', 'forwarded', 'x-forwarded-proto',
        'x-forwarded-host', 'x-original-host'
    ];

    private readonly criticalHeaders = [
        'user-agent', 'accept', 'accept-language', 'accept-encoding',
        'cookie', 'origin', 'referer', 'host'
    ];

    analyze(nativeSession: TrafficSession, bridgeSession: TrafficSession): ComplianceResult {
        const timing = this.analyzeTiming(nativeSession, bridgeSession);
        const headers = this.analyzeHeaders(nativeSession, bridgeSession);
        const messages = this.analyzeMessages(nativeSession, bridgeSession);
        const authentication = this.analyzeAuthentication(nativeSession, bridgeSession);

        const issues: ComplianceIssue[] = [];
        let score = 100;

        // Check timing compliance
        if (timing.timingDelta > 0.2) { // 20% difference
            issues.push({
                severity: 'warning',
                category: 'timing',
                message: `Bridge timing differs by ${(timing.timingDelta * 100).toFixed(1)}% from native`,
                details: timing
            });
            score -= 10;
        }

        // Check forbidden headers
        if (headers.forbidden.length > 0) {
            issues.push({
                severity: 'critical',
                category: 'headers',
                message: `Proxy-revealing headers detected: ${headers.forbidden.join(', ')}`,
                details: headers.forbidden
            });
            score -= 30;
        }

        // Check missing critical headers
        const missingCritical = headers.nativeOnly.filter(h =>
            this.criticalHeaders.includes(h.toLowerCase())
        );
        if (missingCritical.length > 0) {
            issues.push({
                severity: 'critical',
                category: 'headers',
                message: `Missing critical headers: ${missingCritical.join(', ')}`,
                details: missingCritical
            });
            score -= 20;
        }

        // Check message sequence
        if (messages.sequenceMatch < 90) {
            issues.push({
                severity: 'warning',
                category: 'messages',
                message: `Message sequence match only ${messages.sequenceMatch.toFixed(1)}%`,
                details: messages
            });
            score -= 15;
        }

        // Check authentication
        if (!authentication.authFlowMatch) {
            issues.push({
                severity: 'critical',
                category: 'authentication',
                message: 'Authentication flow does not match native client',
                details: authentication
            });
            score -= 25;
        }

        const recommendations = this.generateRecommendations(issues);

        return {
            score: Math.max(0, score),
            issues,
            details: { timing, headers, messages, authentication },
            recommendations
        };
    }

    private analyzeTiming(native: TrafficSession, bridge: TrafficSession): TimingAnalysis {
        const nativeHttp = native.messages.filter(m => m.type === 'http');
        const bridgeHttp = bridge.messages.filter(m => m.type === 'http');

        const calculateAvgTime = (messages: RecordedMessage[]) => {
            const times = messages
                .filter(m => m.metadata?.duration)
                .map(m => m.metadata!.duration!);
            return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
        };

        const nativeAvg = calculateAvgTime(nativeHttp);
        const bridgeAvg = calculateAvgTime(bridgeHttp);

        // Calculate heartbeat intervals
        const calculateHeartbeat = (messages: RecordedMessage[]) => {
            const heartbeats = messages.filter(m =>
                m.type === 'websocket' &&
                m.data &&
                (m.data.type === 'HEARTBEAT' || m.data.type === 'ping')
            );

            if (heartbeats.length < 2) return 0;

            const intervals: number[] = [];
            for (let i = 1; i < heartbeats.length; i++) {
                // Use the timestamp from data if available (for test cases)
                const prevTime = heartbeats[i - 1].data?.timestamp || heartbeats[i - 1].timestamp;
                const currTime = heartbeats[i].data?.timestamp || heartbeats[i].timestamp;
                intervals.push(currTime - prevTime);
            }

            return intervals.length > 0 ? intervals.reduce((a, b) => a + b, 0) / intervals.length : 0;
        };

        const duration = (session: TrafficSession) =>
            (session.endTime || Date.now()) - session.startTime;

        return {
            avgRequestTime: { native: nativeAvg, bridge: bridgeAvg },
            avgResponseTime: { native: nativeAvg, bridge: bridgeAvg },
            timingDelta: nativeAvg > 0 ? Math.abs(bridgeAvg - nativeAvg) / nativeAvg : 0,
            requestFrequency: {
                native: (nativeHttp.length / duration(native)) * 1000,
                bridge: (bridgeHttp.length / duration(bridge)) * 1000
            },
            heartbeatInterval: {
                native: calculateHeartbeat(native.messages),
                bridge: calculateHeartbeat(bridge.messages)
            }
        };
    }

    private analyzeHeaders(native: TrafficSession, bridge: TrafficSession): HeaderAnalysis {
        const extractHeaders = (messages: RecordedMessage[]) => {
            const headers: Record<string, string> = {};
            messages
                .filter(m => m.type === 'http' && m.metadata?.headers)
                .forEach(m => {
                    Object.entries(m.metadata!.headers!).forEach(([k, v]) => {
                        headers[k.toLowerCase()] = v;
                    });
                });
            return headers;
        };

        const nativeHeaders = extractHeaders(native.messages);
        const bridgeHeaders = extractHeaders(bridge.messages);

        const identical: string[] = [];
        const different: Array<{ header: string; native: string; bridge: string }> = [];
        const nativeOnly: string[] = [];
        const bridgeOnly: string[] = [];
        const forbidden: string[] = [];

        // Compare headers
        const allHeaders = new Set([
            ...Object.keys(nativeHeaders),
            ...Object.keys(bridgeHeaders)
        ]);

        allHeaders.forEach(header => {
            const nativeValue = nativeHeaders[header];
            const bridgeValue = bridgeHeaders[header];

            if (nativeValue && bridgeValue) {
                if (nativeValue === bridgeValue || nativeValue === '[REDACTED]' || bridgeValue === '[REDACTED]') {
                    identical.push(header);
                } else {
                    different.push({ header, native: nativeValue, bridge: bridgeValue });
                }
            } else if (nativeValue && !bridgeValue) {
                nativeOnly.push(header);
            } else if (!nativeValue && bridgeValue) {
                bridgeOnly.push(header);
            }
        });

        // Check for forbidden headers in bridge headers
        Object.keys(bridgeHeaders).forEach(header => {
            if (this.forbiddenHeaders.includes(header)) {
                forbidden.push(header);
            }
        });

        return { identical, different, nativeOnly, bridgeOnly, forbidden };
    }

    private analyzeMessages(native: TrafficSession, bridge: TrafficSession): MessageAnalysis {
        const getMessageTypes = (messages: RecordedMessage[]) => {
            const types: Record<string, number> = {};
            messages.forEach(m => {
                const type = m.data?.type || m.type;
                types[type] = (types[type] || 0) + 1;
            });
            return types;
        };

        const nativeTypes = getMessageTypes(native.messages);
        const bridgeTypes = getMessageTypes(bridge.messages);

        // Calculate sequence match
        const nativeSequence = native.messages.map(m => m.data?.type || m.type);
        const bridgeSequence = bridge.messages.map(m => m.data?.type || m.type);

        let matches = 0;
        const minLength = Math.min(nativeSequence.length, bridgeSequence.length);

        for (let i = 0; i < minLength; i++) {
            if (nativeSequence[i] === bridgeSequence[i]) {
                matches++;
            }
        }

        const sequenceMatch = minLength > 0 ? (matches / minLength) * 100 : 100;

        // Calculate size differences
        const nativeSizes = native.messages.map(m => m.metadata?.size || 0);
        const bridgeSizes = bridge.messages.map(m => m.metadata?.size || 0);

        const avgNativeSize = nativeSizes.reduce((a, b) => a + b, 0) / nativeSizes.length || 1;
        const avgBridgeSize = bridgeSizes.reduce((a, b) => a + b, 0) / bridgeSizes.length || 1;

        const messageSizeDiff = Math.abs(avgBridgeSize - avgNativeSize) / avgNativeSize;

        return {
            totalMessages: {
                native: native.messages.length,
                bridge: bridge.messages.length
            },
            messageTypes: { native: nativeTypes, bridge: bridgeTypes },
            sequenceMatch,
            outOfOrder: minLength - matches,
            messageSizeDiff
        };
    }

    private analyzeAuthentication(native: TrafficSession, bridge: TrafficSession): AuthAnalysis {
        const hasSession = (messages: RecordedMessage[]) =>
            messages.some(m =>
                m.data?.type === 'SESSION_INIT' ||
                (m.metadata?.headers && m.metadata.headers['cookie']?.includes('anvil-session'))
            );

        const hasCookies = (messages: RecordedMessage[]) =>
            messages.some(m => m.metadata?.headers?.['cookie']);

        const hasAuthFlow = (messages: RecordedMessage[]) =>
            messages.some(m =>
                m.data?.type === 'AUTH' ||
                m.metadata?.url?.includes('auth') ||
                m.metadata?.url?.includes('login')
            );

        return {
            sessionHandling: hasSession(native.messages) === hasSession(bridge.messages),
            cookieMatching: hasCookies(native.messages) === hasCookies(bridge.messages),
            tokenConsistency: true, // Would need deeper analysis
            authFlowMatch: hasAuthFlow(native.messages) === hasAuthFlow(bridge.messages)
        };
    }

    private generateRecommendations(issues: ComplianceIssue[]): string[] {
        const recommendations: string[] = [];

        issues.forEach(issue => {
            switch (issue.category) {
                case 'headers':
                    if (issue.message.includes('forbidden')) {
                        recommendations.push('Remove proxy-revealing headers from all requests');
                        recommendations.push('Ensure NextJS middleware does not add proxy headers');
                    }
                    if (issue.message.includes('Missing critical')) {
                        recommendations.push('Forward all critical headers from the client request');
                        recommendations.push('Preserve original User-Agent and Accept headers');
                    }
                    break;

                case 'timing':
                    recommendations.push('Optimize proxy performance to match native client timing');
                    recommendations.push('Consider connection pooling and request pipelining');
                    break;

                case 'messages':
                    recommendations.push('Ensure message ordering matches native client exactly');
                    recommendations.push('Verify WebSocket message serialization is identical');
                    break;

                case 'authentication':
                    recommendations.push('Review authentication flow to match native client');
                    recommendations.push('Ensure session cookies are handled identically');
                    break;
            }
        });

        return [...new Set(recommendations)]; // Remove duplicates
    }

    generateReport(result: ComplianceResult): string {
        const lines: string[] = [
            '# Protocol Compliance Report',
            '',
            `## Overall Score: ${result.score}/100`,
            '',
            '## Issues Found:',
            ''
        ];

        if (result.issues.length === 0) {
            lines.push('✅ No compliance issues detected!');
        } else {
            result.issues.forEach(issue => {
                const icon = issue.severity === 'critical' ? '🔴' :
                    issue.severity === 'warning' ? '🟡' : 'ℹ️';
                lines.push(`${icon} **${issue.severity.toUpperCase()}**: ${issue.message}`);
                if (issue.details) {
                    lines.push(`   Details: ${JSON.stringify(issue.details, null, 2).replace(/\n/g, '\n   ')}`);
                }
                lines.push('');
            });
        }

        lines.push('', '## Detailed Analysis:', '');

        // Timing Analysis
        lines.push('### Timing Analysis:');
        lines.push(`- Average Response Time: Native ${result.details.timing.avgResponseTime.native.toFixed(2)}ms, Bridge ${result.details.timing.avgResponseTime.bridge.toFixed(2)}ms`);
        lines.push(`- Timing Delta: ${(result.details.timing.timingDelta * 100).toFixed(1)}%`);
        lines.push(`- Heartbeat Interval: Native ${result.details.timing.heartbeatInterval.native}ms, Bridge ${result.details.timing.heartbeatInterval.bridge}ms`);
        lines.push('');

        // Header Analysis
        lines.push('### Header Analysis:');
        lines.push(`- Identical Headers: ${result.details.headers.identical.length}`);
        lines.push(`- Different Headers: ${result.details.headers.different.length}`);
        lines.push(`- Native Only: ${result.details.headers.nativeOnly.join(', ') || 'None'}`);
        lines.push(`- Bridge Only: ${result.details.headers.bridgeOnly.join(', ') || 'None'}`);
        lines.push(`- Forbidden Headers: ${result.details.headers.forbidden.join(', ') || 'None'}`);
        lines.push('');

        // Message Analysis
        lines.push('### Message Analysis:');
        lines.push(`- Total Messages: Native ${result.details.messages.totalMessages.native}, Bridge ${result.details.messages.totalMessages.bridge}`);
        lines.push(`- Sequence Match: ${result.details.messages.sequenceMatch.toFixed(1)}%`);
        lines.push(`- Out of Order: ${result.details.messages.outOfOrder}`);
        lines.push(`- Size Difference: ${(result.details.messages.messageSizeDiff * 100).toFixed(1)}%`);
        lines.push('');

        // Recommendations
        lines.push('', '## Recommendations:', '');
        if (result.recommendations.length > 0) {
            result.recommendations.forEach(rec => {
                lines.push(`- ${rec}`);
            });
        } else {
            lines.push('- No specific recommendations. Continue monitoring compliance.');
        }

        return lines.join('\n');
    }
}

// Export singleton instance
export const protocolAnalyzer = new ProtocolAnalyzer(); 