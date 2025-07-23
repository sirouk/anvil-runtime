/**
 * Anvil server connection utilities
 * Manages proxy instances and connection initialization
 */

import { WebSocketProxy } from './websocket-proxy';

// Global proxy instance (in production, this should be managed properly)
let proxyInstance: WebSocketProxy | null = null;

// Initialize proxy if not already created
export function getProxyInstance(): WebSocketProxy {
    if (!proxyInstance) {
        proxyInstance = new WebSocketProxy({
            anvilServerUrl: process.env.ANVIL_SERVER_URL || 'localhost',
            anvilServerPort: parseInt(process.env.ANVIL_SERVER_PORT || '3030'),
        });
    }
    return proxyInstance;
}

// Helper function to initialize Anvil connection
export async function initializeAnvilConnection(): Promise<void> {
    const proxy = getProxyInstance();

    if (!proxy.isConnectedToAnvil()) {
        console.log('Initializing Anvil server connection...');
        try {
            await proxy.connectToAnvil();
            console.log('Successfully connected to Anvil server');
        } catch (error) {
            console.error('Failed to connect to Anvil server:', error);
            throw error;
        }
    }
}

// Reset proxy instance (useful for testing)
export function resetProxyInstance(): void {
    if (proxyInstance) {
        proxyInstance.disconnect();
        proxyInstance = null;
    }
}

// Check if proxy is connected
export function isAnvilConnected(): boolean {
    return proxyInstance?.isConnectedToAnvil() ?? false;
}

// Get connection status
export function getConnectionStatus() {
    const proxy = proxyInstance;
    return {
        connected: proxy?.isConnectedToAnvil() ?? false,
        clients: proxy?.getClientCount() ?? 0,
        session: proxy?.getSession() ?? null,
        timestamp: new Date().toISOString(),
    };
} 