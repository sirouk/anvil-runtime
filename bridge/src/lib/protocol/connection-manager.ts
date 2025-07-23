/**
 * Anvil Connection Manager
 * 
 * Handles connection state, heartbeat timing, auto-reconnection,
 * and message queuing for reliable Anvil server communication
 */

import { AnvilMessage } from '@/types/anvil-protocol';

export interface ConnectionConfig {
    heartbeatInterval?: number;     // Milliseconds between heartbeats
    maxReconnectAttempts?: number;  // Maximum reconnection attempts
    reconnectBaseDelay?: number;    // Base delay for exponential backoff
    maxReconnectDelay?: number;     // Maximum delay between reconnection attempts
    connectionTimeout?: number;     // Connection timeout
    messageQueueLimit?: number;     // Maximum queued messages
    debug?: boolean;
}

export interface ConnectionState {
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
    lastHeartbeat: number;
    reconnectAttempts: number;
    totalConnections: number;
    messagesQueued: number;
    uptime: number;
    sessionId?: string;
}

export interface QueuedMessage {
    message: AnvilMessage;
    timestamp: number;
    attempts: number;
    priority: 'normal' | 'high';
}

export class AnvilConnectionManager {
    private config: Required<ConnectionConfig>;
    private state: ConnectionState;
    private heartbeatTimer?: NodeJS.Timeout;
    private reconnectTimer?: NodeJS.Timeout;
    private messageQueue: QueuedMessage[] = [];
    private connectionStartTime: number = 0;

    // Callbacks for connection events
    public onConnect?: () => void;
    public onDisconnect?: (reason: string) => void;
    public onReconnect?: () => void;
    public onHeartbeat?: () => void;
    public onMessage?: (message: AnvilMessage) => void;
    public onError?: (error: Error) => void;

    constructor(config: ConnectionConfig = {}) {
        this.config = {
            heartbeatInterval: config.heartbeatInterval || 30000,        // 30 seconds
            maxReconnectAttempts: config.maxReconnectAttempts || 10,
            reconnectBaseDelay: config.reconnectBaseDelay || 1000,       // 1 second
            maxReconnectDelay: config.maxReconnectDelay || 30000,        // 30 seconds
            connectionTimeout: config.connectionTimeout || 15000,        // 15 seconds
            messageQueueLimit: config.messageQueueLimit || 100,
            debug: config.debug || false
        };

        this.state = {
            status: 'disconnected',
            lastHeartbeat: 0,
            reconnectAttempts: 0,
            totalConnections: 0,
            messagesQueued: 0,
            uptime: 0
        };
    }

    /**
     * Start connection management
     */
    start(): void {
        if (this.state.status !== 'disconnected') {
            this.log('Connection manager already active');
            return;
        }

        this.connectionStartTime = Date.now();
        this.setState('connecting');
        this.log('Starting connection manager');
    }

    /**
     * Stop connection management
     */
    stop(): void {
        this.log('Stopping connection manager');
        this.clearTimers();
        this.setState('disconnected');
        this.state.reconnectAttempts = 0;
    }

    /**
     * Handle successful connection
     */
    onConnectionEstablished(sessionId?: string): void {
        this.log('Connection established');
        this.state.sessionId = sessionId;
        this.state.totalConnections++;
        this.state.reconnectAttempts = 0;
        this.setState('connected');

        // Start heartbeat timer
        this.startHeartbeat();

        // Process queued messages
        this.processMessageQueue();

        if (this.onConnect) {
            this.onConnect();
        }
    }

    /**
     * Handle connection loss
     */
    onConnectionLost(reason: string = 'Unknown'): void {
        this.log(`Connection lost: ${reason}`);
        this.clearTimers();

        if (this.onDisconnect) {
            this.onDisconnect(reason);
        }

        // Attempt reconnection if not exceeded max attempts
        if (this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
            this.scheduleReconnection();
        } else {
            this.log('Max reconnection attempts exceeded');
            this.setState('failed');
        }
    }

    /**
     * Queue message for sending
     */
    queueMessage(message: AnvilMessage, priority: 'normal' | 'high' = 'normal'): boolean {
        if (this.messageQueue.length >= this.config.messageQueueLimit) {
            this.log('Message queue full, dropping oldest message');
            this.messageQueue.shift();
        }

        const queuedMessage: QueuedMessage = {
            message,
            timestamp: Date.now(),
            attempts: 0,
            priority
        };

        // Insert by priority (high priority first)
        if (priority === 'high') {
            this.messageQueue.unshift(queuedMessage);
        } else {
            this.messageQueue.push(queuedMessage);
        }

        this.state.messagesQueued = this.messageQueue.length;
        this.log(`Message queued (${priority}): ${message.type} - Queue size: ${this.messageQueue.length}`);

        return true;
    }

    /**
     * Process queued messages when connection is restored
     */
    private processMessageQueue(): void {
        if (this.state.status !== 'connected' || this.messageQueue.length === 0) {
            return;
        }

        this.log(`Processing ${this.messageQueue.length} queued messages`);

        const messages = [...this.messageQueue];
        this.messageQueue = [];
        this.state.messagesQueued = 0;

        for (const queuedMessage of messages) {
            if (this.onMessage) {
                queuedMessage.attempts++;
                this.onMessage(queuedMessage.message);
            }
        }
    }

    /**
     * Start heartbeat timer
     */
    private startHeartbeat(): void {
        this.clearHeartbeatTimer();

        this.heartbeatTimer = setInterval(() => {
            this.sendHeartbeat();
        }, this.config.heartbeatInterval);

        this.log(`Heartbeat started (${this.config.heartbeatInterval}ms interval)`);
    }

    /**
     * Send heartbeat message
     */
    private sendHeartbeat(): void {
        const now = Date.now();
        this.state.lastHeartbeat = now;

        const heartbeatMessage: AnvilMessage = {
            type: 'PING',
            id: this.generateMessageId(),
            sessionId: this.state.sessionId,
            timestamp: now
        };

        if (this.onMessage) {
            this.onMessage(heartbeatMessage);
        }

        if (this.onHeartbeat) {
            this.onHeartbeat();
        }

        this.log('Heartbeat sent');
    }

    /**
     * Handle received heartbeat response
     */
    handleHeartbeatResponse(message: AnvilMessage): void {
        if (message.type === 'PONG') {
            const latency = Date.now() - (message.timestamp || 0);
            this.log(`Heartbeat response received (latency: ${latency}ms)`);
        }
    }

    /**
     * Schedule reconnection with exponential backoff
     */
    private scheduleReconnection(): void {
        this.state.reconnectAttempts++;
        this.setState('reconnecting');

        const delay = Math.min(
            this.config.reconnectBaseDelay * Math.pow(2, this.state.reconnectAttempts - 1),
            this.config.maxReconnectDelay
        );

        this.log(`Scheduling reconnection attempt ${this.state.reconnectAttempts}/${this.config.maxReconnectAttempts} in ${delay}ms`);

        this.reconnectTimer = setTimeout(() => {
            this.log(`Attempting reconnection ${this.state.reconnectAttempts}`);
            this.setState('connecting');

            if (this.onReconnect) {
                this.onReconnect();
            }
        }, delay);
    }

    /**
     * Check if heartbeat is overdue
     */
    isHeartbeatOverdue(): boolean {
        if (this.state.status !== 'connected' || this.state.lastHeartbeat === 0) {
            return false;
        }

        const timeSinceLastHeartbeat = Date.now() - this.state.lastHeartbeat;
        const overdueThreshold = this.config.heartbeatInterval * 2.5; // 2.5x interval

        return timeSinceLastHeartbeat > overdueThreshold;
    }

    /**
     * Get connection statistics
     */
    getStats(): ConnectionState & { queuedMessageTypes: { [key: string]: number } } {
        // Count queued message types
        const queuedMessageTypes: { [key: string]: number } = {};
        this.messageQueue.forEach(item => {
            const type = item.message.type;
            queuedMessageTypes[type] = (queuedMessageTypes[type] || 0) + 1;
        });

        return {
            ...this.state,
            uptime: this.connectionStartTime ? Date.now() - this.connectionStartTime : 0,
            queuedMessageTypes
        };
    }

    /**
     * Clear all timers
     */
    private clearTimers(): void {
        this.clearHeartbeatTimer();
        this.clearReconnectTimer();
    }

    /**
     * Clear heartbeat timer
     */
    private clearHeartbeatTimer(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = undefined;
        }
    }

    /**
     * Clear reconnect timer
     */
    private clearReconnectTimer(): void {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
    }

    /**
     * Set connection state
     */
    private setState(status: ConnectionState['status']): void {
        const previousStatus = this.state.status;
        this.state.status = status;

        if (previousStatus !== status) {
            this.log(`State changed: ${previousStatus} → ${status}`);
        }
    }

    /**
     * Generate unique message ID
     */
    private generateMessageId(): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 5);
        return `hb_${timestamp}_${random}`;
    }

    /**
     * Log message with debug flag
     */
    private log(message: string): void {
        if (this.config.debug) {
            console.log(`[ConnectionManager] ${message}`);
        }
    }

    /**
     * Force reconnection
     */
    forceReconnect(): void {
        this.log('Force reconnection requested');
        this.state.reconnectAttempts = 0; // Reset attempts
        this.onConnectionLost('Force reconnect');
    }

    /**
     * Check connection health
     */
    getHealthStatus(): 'healthy' | 'warning' | 'critical' {
        if (this.state.status === 'connected') {
            if (this.isHeartbeatOverdue()) {
                return 'warning';
            }
            return 'healthy';
        }

        if (this.state.status === 'reconnecting' && this.state.reconnectAttempts < this.config.maxReconnectAttempts) {
            return 'warning';
        }

        return 'critical';
    }
}

export default AnvilConnectionManager; 