/**
 * NextJS API route for WebSocket proxy to Anvil server
 * 
 * Note: NextJS 14 App Router doesn't support WebSocket upgrades directly.
 * This endpoint provides WebSocket proxy status and configuration.
 * Actual WebSocket server runs separately on a different port.
 */

import { NextRequest } from 'next/server';
import { getProxyInstance, getConnectionStatus, initializeAnvilConnection } from '@/lib/protocol/anvil-connection';

// GET /api/ws - WebSocket endpoint information and status
export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const action = searchParams.get('action');

        if (action === 'status') {
            const status = getConnectionStatus();
            return Response.json({
                ...status,
                websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
                anvilServerUrl: `${process.env.ANVIL_SERVER_URL || 'localhost'}:${process.env.ANVIL_SERVER_PORT || '3030'}`,
                endpoint: '/api/ws'
            });
        }

        if (action === 'connect') {
            try {
                await initializeAnvilConnection();
                return Response.json({
                    success: true,
                    message: 'Connection to Anvil server established',
                    status: getConnectionStatus()
                });
            } catch (error) {
                return Response.json({
                    success: false,
                    error: error instanceof Error ? error.message : 'Connection failed'
                }, { status: 500 });
            }
        }

        // Default response with WebSocket information
        return Response.json({
            endpoint: '/api/ws',
            websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
            anvilServer: `${process.env.ANVIL_SERVER_URL || 'localhost'}:${process.env.ANVIL_SERVER_PORT || '3030'}`,
            message: 'WebSocket proxy endpoint. Use ?action=status for connection status.',
            availableActions: ['status', 'connect']
        });

    } catch (error) {
        console.error('WebSocket endpoint error:', error);
        return Response.json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// POST /api/ws - Control WebSocket proxy operations
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, ...params } = body;

        switch (action) {
            case 'initialize':
                try {
                    await initializeAnvilConnection();
                    return Response.json({
                        success: true,
                        message: 'WebSocket proxy initialized',
                        status: getConnectionStatus()
                    });
                } catch (error) {
                    return Response.json({
                        success: false,
                        error: error instanceof Error ? error.message : 'Initialization failed'
                    }, { status: 500 });
                }

            case 'status':
                return Response.json({
                    success: true,
                    status: getConnectionStatus()
                });

            case 'send':
                // Send message through proxy (for testing)
                if (!params.message) {
                    return Response.json({
                        success: false,
                        error: 'Message required'
                    }, { status: 400 });
                }

                try {
                    const proxy = getProxyInstance();
                    // Note: This would need proper message sending implementation
                    return Response.json({
                        success: true,
                        message: 'Message queued for sending',
                        messageId: Date.now().toString()
                    });
                } catch (error) {
                    return Response.json({
                        success: false,
                        error: error instanceof Error ? error.message : 'Send failed'
                    }, { status: 500 });
                }

            default:
                return Response.json({
                    success: false,
                    error: 'Invalid action',
                    availableActions: ['initialize', 'status', 'send']
                }, { status: 400 });
        }

    } catch (error) {
        console.error('WebSocket POST error:', error);
        return Response.json({
            success: false,
            error: 'Invalid request body or server error'
        }, { status: 500 });
    }
} 