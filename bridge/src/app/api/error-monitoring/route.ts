/**
 * Error Monitoring API Route
 * 
 * Provides access to error metrics, circuit breaker stats,
 * and system health information for monitoring and debugging.
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalErrorMonitor } from '@/lib/error-handling/error-monitor';
import { globalCircuitBreakerManager } from '@/lib/error-handling/circuit-breaker';

/**
 * GET /api/error-monitoring - Get comprehensive error monitoring data
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') || 'all';

        switch (type) {
            case 'metrics':
                return NextResponse.json({
                    metrics: globalErrorMonitor.getMetrics(),
                    timestamp: new Date().toISOString()
                });

            case 'circuit-breakers':
                const circuitBreakerStats = Object.fromEntries(globalCircuitBreakerManager.getAllStats());
                return NextResponse.json({
                    circuitBreakers: circuitBreakerStats,
                    timestamp: new Date().toISOString()
                });

            case 'alerts':
                const alertRules = globalErrorMonitor.getAlertRules();
                return NextResponse.json({
                    alertRules,
                    timestamp: new Date().toISOString()
                });

            case 'search':
                const level = searchParams.get('level') as any;
                const category = searchParams.get('category') as any;
                const since = searchParams.get('since') ? new Date(searchParams.get('since')!) : undefined;
                const until = searchParams.get('until') ? new Date(searchParams.get('until')!) : undefined;
                const message = searchParams.get('message') || undefined;
                const fingerprint = searchParams.get('fingerprint') || undefined;

                const searchResults = globalErrorMonitor.searchErrors({
                    level,
                    category,
                    since,
                    until,
                    message,
                    fingerprint
                });

                return NextResponse.json({
                    errors: searchResults,
                    count: searchResults.length,
                    timestamp: new Date().toISOString()
                });

            case 'all':
            default:
                const metrics = globalErrorMonitor.getMetrics();
                const circuitBreakers = Object.fromEntries(globalCircuitBreakerManager.getAllStats());
                const alerts = globalErrorMonitor.getAlertRules();

                return NextResponse.json({
                    metrics,
                    circuitBreakers,
                    alerts,
                    system: {
                        uptime: process.uptime(),
                        memory: process.memoryUsage(),
                        version: process.version,
                        platform: process.platform
                    },
                    timestamp: new Date().toISOString()
                });
        }

    } catch (error) {
        console.error('Error monitoring API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to retrieve monitoring data',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

/**
 * POST /api/error-monitoring - Control error monitoring system
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'clear_errors':
                globalErrorMonitor.clear();
                return NextResponse.json({
                    success: true,
                    message: 'Error history cleared',
                    timestamp: new Date().toISOString()
                });

            case 'reset_circuit_breakers':
                globalCircuitBreakerManager.resetAll();
                return NextResponse.json({
                    success: true,
                    message: 'All circuit breakers reset',
                    timestamp: new Date().toISOString()
                });

            case 'add_alert_rule':
                if (!params.rule) {
                    return NextResponse.json(
                        { error: 'Alert rule configuration required' },
                        { status: 400 }
                    );
                }
                globalErrorMonitor.addAlertRule(params.rule);
                return NextResponse.json({
                    success: true,
                    message: 'Alert rule added',
                    timestamp: new Date().toISOString()
                });

            case 'remove_alert_rule':
                if (!params.ruleId) {
                    return NextResponse.json(
                        { error: 'Rule ID required' },
                        { status: 400 }
                    );
                }
                globalErrorMonitor.removeAlertRule(params.ruleId);
                return NextResponse.json({
                    success: true,
                    message: 'Alert rule removed',
                    timestamp: new Date().toISOString()
                });

            case 'log_test_error':
                const testErrorId = globalErrorMonitor.error(
                    'unknown',
                    'Test error from monitoring API',
                    new Error('This is a test error'),
                    { source: 'api_test', level: params.level || 'error' }
                );
                return NextResponse.json({
                    success: true,
                    message: 'Test error logged',
                    errorId: testErrorId,
                    timestamp: new Date().toISOString()
                });

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${action}` },
                    { status: 400 }
                );
        }

    } catch (error) {
        console.error('Error monitoring control error:', error);
        return NextResponse.json(
            {
                error: 'Failed to process monitoring control request',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/error-monitoring - Clear specific monitoring data
 */
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');

        switch (type) {
            case 'errors':
                globalErrorMonitor.clear();
                return NextResponse.json({
                    success: true,
                    message: 'Error history cleared',
                    timestamp: new Date().toISOString()
                });

            case 'circuit-breakers':
                globalCircuitBreakerManager.resetAll();
                return NextResponse.json({
                    success: true,
                    message: 'Circuit breakers reset',
                    timestamp: new Date().toISOString()
                });

            case 'all':
                globalErrorMonitor.clear();
                globalCircuitBreakerManager.resetAll();
                return NextResponse.json({
                    success: true,
                    message: 'All monitoring data cleared',
                    timestamp: new Date().toISOString()
                });

            default:
                return NextResponse.json(
                    { error: 'Invalid type parameter. Use: errors, circuit-breakers, or all' },
                    { status: 400 }
                );
        }

    } catch (error) {
        console.error('Error monitoring delete error:', error);
        return NextResponse.json(
            {
                error: 'Failed to clear monitoring data',
                message: error instanceof Error ? error.message : 'Unknown error',
                timestamp: new Date().toISOString()
            },
            { status: 500 }
        );
    }
} 