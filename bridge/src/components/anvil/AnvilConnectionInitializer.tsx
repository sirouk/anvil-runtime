'use client';

import React, { useEffect, useState } from 'react';
import { getGlobalAnvilClient } from '@/lib/protocol/anvil-client';
import { AppErrorHandler } from '@/lib/app-loader/app-error-handler';

/**
 * Anvil Connection Initializer
 * 
 * Automatically initializes connection to the Anvil server when component mounts.
 * Handles connection status and provides feedback to the user.
 */

interface ConnectionState {
    status: 'connecting' | 'connected' | 'disconnected' | 'error';
    error?: string;
    retryCount: number;
}

export function AnvilConnectionInitializer() {
    const [connectionState, setConnectionState] = useState<ConnectionState>({
        status: 'connecting',
        retryCount: 0
    });

    useEffect(() => {
        let mounted = true;

        const initializeConnection = async () => {
            try {
                console.log('🔌 Initializing connection to Anvil server...');
                setConnectionState(prev => ({ ...prev, status: 'connecting' }));

                // Get global client instance
                const client = getGlobalAnvilClient({
                    autoReconnect: true,
                    debug: process.env.NODE_ENV === 'development'
                });

                // Set up event listeners
                client.on('connected', () => {
                    if (mounted) {
                        console.log('✅ Connected to Anvil server');
                        setConnectionState(prev => ({
                            ...prev,
                            status: 'connected',
                            error: undefined,
                            retryCount: 0
                        }));
                    }
                });

                client.on('disconnected', () => {
                    if (mounted) {
                        console.log('🔌 Disconnected from Anvil server');
                        setConnectionState(prev => ({ ...prev, status: 'disconnected' }));
                    }
                });

                client.on('error', (error) => {
                    if (mounted) {
                        const connectionError = AppErrorHandler.handleConnectionError(error);
                        console.error('❌ Anvil connection error:', connectionError);
                        setConnectionState(prev => ({
                            ...prev,
                            status: 'error',
                            error: connectionError.message
                        }));
                    }
                });

                // Attempt connection
                await client.connect();

            } catch (error) {
                if (mounted) {
                    const connectionError = AppErrorHandler.handleConnectionError(error);
                    console.error('❌ Failed to initialize Anvil connection:', connectionError);
                    setConnectionState(prev => ({
                        ...prev,
                        status: 'error',
                        error: connectionError.message,
                        retryCount: prev.retryCount + 1
                    }));
                }
            }
        };

        // Initialize connection
        initializeConnection();

        // Cleanup
        return () => {
            mounted = false;
        };
    }, []);

    // Auto-retry on error with exponential backoff
    useEffect(() => {
        if (connectionState.status === 'error' && connectionState.retryCount < 3) {
            const retryDelay = Math.pow(2, connectionState.retryCount) * 2000; // 2s, 4s, 8s
            console.log(`🔄 Retrying connection in ${retryDelay}ms (attempt ${connectionState.retryCount + 1}/3)`);

            const timer = setTimeout(() => {
                setConnectionState(prev => ({ ...prev, status: 'connecting' }));
            }, retryDelay);

            return () => clearTimeout(timer);
        }
    }, [connectionState.status, connectionState.retryCount]);

    // Render connection status indicator (minimal UI)
    if (connectionState.status === 'connected') {
        return null; // No UI when connected
    }

    return (
        <div className="fixed top-4 right-4 z-50">
            <div className={`
                px-4 py-2 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2
                ${connectionState.status === 'connecting' ? 'bg-blue-100 text-blue-800 border border-blue-200' : ''}
                ${connectionState.status === 'disconnected' ? 'bg-yellow-100 text-yellow-800 border border-yellow-200' : ''}
                ${connectionState.status === 'error' ? 'bg-red-100 text-red-800 border border-red-200' : ''}
            `}>
                {connectionState.status === 'connecting' && (
                    <>
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span>Connecting to Anvil server...</span>
                    </>
                )}

                {connectionState.status === 'disconnected' && (
                    <>
                        <div className="w-4 h-4 bg-yellow-500 rounded-full"></div>
                        <span>Disconnected from Anvil server</span>
                    </>
                )}

                {connectionState.status === 'error' && (
                    <>
                        <div className="w-4 h-4 bg-red-500 rounded-full"></div>
                        <span>
                            Connection failed
                            {connectionState.retryCount < 3 && ' (retrying...)'}
                        </span>
                    </>
                )}
            </div>

            {connectionState.status === 'error' && connectionState.retryCount >= 3 && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    <div className="font-medium mb-1">Connection failed after 3 attempts</div>
                    <div>Check that Anvil server is running on port 3030</div>
                </div>
            )}
        </div>
    );
}

export default AnvilConnectionInitializer; 