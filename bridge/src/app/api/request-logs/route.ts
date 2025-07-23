/**
 * Request Logs API Route
 * 
 * Provides access to request logs, metrics, and correlation ID lookup
 * for debugging and monitoring HTTP proxy requests.
 */

import { NextRequest, NextResponse } from 'next/server';
import { globalRequestLogger } from '@/lib/logging/request-logger';

/**
 * GET /api/request-logs - Get request logs and metrics
 * 
 * Query parameters:
 * - correlationId: Get specific request by correlation ID
 * - startTime: Filter logs by start time (Unix timestamp)
 * - endTime: Filter logs by end time (Unix timestamp)
 * - status: Filter by HTTP status code
 * - method: Filter by HTTP method
 * - path: Filter by request path (partial match)
 * - hasError: Filter by error presence (true/false)
 * - metrics: Get metrics instead of logs (true/false)
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = request.nextUrl;

        // Get metrics if requested
        if (searchParams.get('metrics') === 'true') {
            const metrics = globalRequestLogger.getMetrics();
            return NextResponse.json({
                metrics,
                timestamp: new Date().toISOString()
            });
        }

        // Get specific log by correlation ID
        const correlationId = searchParams.get('correlationId');
        if (correlationId) {
            const log = globalRequestLogger.getLog(correlationId);
            if (!log) {
                return NextResponse.json(
                    { error: 'Log not found', correlationId },
                    { status: 404 }
                );
            }
            return NextResponse.json(log);
        }

        // Build filter from query parameters
        const filter: Parameters<typeof globalRequestLogger.getLogs>[0] = {};

        const startTime = searchParams.get('startTime');
        if (startTime) {
            filter.startTime = parseInt(startTime);
        }

        const endTime = searchParams.get('endTime');
        if (endTime) {
            filter.endTime = parseInt(endTime);
        }

        const status = searchParams.get('status');
        if (status) {
            filter.status = parseInt(status);
        }

        const method = searchParams.get('method');
        if (method) {
            filter.method = method.toUpperCase();
        }

        const path = searchParams.get('path');
        if (path) {
            filter.path = path;
        }

        const hasError = searchParams.get('hasError');
        if (hasError !== null) {
            filter.hasError = hasError === 'true';
        }

        // Get filtered logs
        const logs = globalRequestLogger.getLogs(filter);

        // Limit response size
        const limit = parseInt(searchParams.get('limit') || '100');
        const offset = parseInt(searchParams.get('offset') || '0');
        const paginatedLogs = logs.slice(offset, offset + limit);

        return NextResponse.json({
            logs: paginatedLogs,
            total: logs.length,
            limit,
            offset,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Request logs API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to retrieve request logs',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/request-logs - Clear request logs
 * 
 * Body parameters:
 * - correlationId: Clear specific log
 * - all: Clear all logs (requires confirmation)
 */
export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();

        if (body.all === true && body.confirm === true) {
            // Clear all logs (be careful!)
            globalRequestLogger.shutdown();
            return NextResponse.json({
                success: true,
                message: 'All request logs cleared'
            });
        }

        if (body.correlationId) {
            // For now, we can't delete individual logs
            // This would need to be implemented in the RequestLogger
            return NextResponse.json(
                {
                    error: 'Individual log deletion not supported',
                    message: 'Use GET with filters to view specific logs'
                },
                { status: 501 }
            );
        }

        return NextResponse.json(
            {
                error: 'Invalid request',
                message: 'Specify either correlationId or all:true with confirm:true'
            },
            { status: 400 }
        );

    } catch (error) {
        console.error('Request logs delete error:', error);
        return NextResponse.json(
            {
                error: 'Failed to delete request logs',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 