import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

export interface RecordedMessage {
    timestamp: number;
    direction: 'client->server' | 'server->client';
    type: 'websocket' | 'http';
    data: any;
    metadata?: {
        url?: string;
        method?: string;
        headers?: Record<string, string>;
        statusCode?: number;
        size?: number;
        duration?: number;
    };
}

export interface TrafficSession {
    id: string;
    clientType: 'native' | 'bridge';
    startTime: number;
    endTime?: number;
    messages: RecordedMessage[];
    metadata: {
        userAgent?: string;
        sessionId?: string;
        appName?: string;
        version?: string;
    };
}

export class TrafficRecorder extends EventEmitter {
    private sessions: Map<string, TrafficSession> = new Map();
    private isRecording: boolean = false;
    private storageDir: string;

    constructor(storageDir: string = './recordings') {
        super();
        this.storageDir = storageDir;
    }

    async startRecording(sessionId: string, clientType: 'native' | 'bridge', metadata?: TrafficSession['metadata']): Promise<void> {
        if (this.sessions.has(sessionId)) {
            throw new Error(`Session ${sessionId} already exists`);
        }

        const session: TrafficSession = {
            id: sessionId,
            clientType,
            startTime: Date.now(),
            messages: [],
            metadata: metadata || {}
        };

        this.sessions.set(sessionId, session);
        this.isRecording = true;
        this.emit('recording-started', sessionId);

        // Ensure storage directory exists
        await fs.mkdir(this.storageDir, { recursive: true });
    }

    recordWebSocketMessage(sessionId: string, direction: RecordedMessage['direction'], data: any): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`Session ${sessionId} not found`);
            return;
        }

        const message: RecordedMessage = {
            timestamp: Date.now(),
            direction,
            type: 'websocket',
            data: this.sanitizeData(data),
            metadata: {
                size: JSON.stringify(data).length
            }
        };

        session.messages.push(message);
        this.emit('message-recorded', sessionId, message);
    }

    recordHttpRequest(sessionId: string, url: string, method: string, headers: Record<string, string>, body?: any): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`Session ${sessionId} not found`);
            return;
        }

        const message: RecordedMessage = {
            timestamp: Date.now(),
            direction: 'client->server',
            type: 'http',
            data: body ? this.sanitizeData(body) : null,
            metadata: {
                url,
                method,
                headers: this.sanitizeHeaders(headers),
                size: body ? JSON.stringify(body).length : 0
            }
        };

        session.messages.push(message);
        this.emit('message-recorded', sessionId, message);
    }

    recordHttpResponse(sessionId: string, statusCode: number, headers: Record<string, string>, body?: any, duration?: number): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            console.warn(`Session ${sessionId} not found`);
            return;
        }

        const message: RecordedMessage = {
            timestamp: Date.now(),
            direction: 'server->client',
            type: 'http',
            data: body ? this.sanitizeData(body) : null,
            metadata: {
                statusCode,
                headers: this.sanitizeHeaders(headers),
                size: body ? JSON.stringify(body).length : 0,
                duration
            }
        };

        session.messages.push(message);
        this.emit('message-recorded', sessionId, message);
    }

    async stopRecording(sessionId: string): Promise<void> {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }

        session.endTime = Date.now();

        // Save session to file
        const filename = `${session.clientType}-${sessionId}-${session.startTime}.json`;
        const filepath = path.join(this.storageDir, filename);

        await fs.writeFile(filepath, JSON.stringify(session, null, 2));

        this.sessions.delete(sessionId);
        this.emit('recording-stopped', sessionId, filepath);

        if (this.sessions.size === 0) {
            this.isRecording = false;
        }
    }

    async loadSession(filepath: string): Promise<TrafficSession> {
        const content = await fs.readFile(filepath, 'utf-8');
        return JSON.parse(content);
    }

    async listRecordings(): Promise<string[]> {
        try {
            const files = await fs.readdir(this.storageDir);
            return files.filter(f => f.endsWith('.json'));
        } catch {
            return [];
        }
    }

    getActiveSession(sessionId: string): TrafficSession | undefined {
        return this.sessions.get(sessionId);
    }

    private sanitizeData(data: any): any {
        if (typeof data === 'string') {
            return data;
        }

        const sanitized = JSON.parse(JSON.stringify(data));

        // Sanitize sensitive fields
        const sensitiveFields = ['password', 'token', 'api_key', 'secret'];

        const sanitizeObject = (obj: any) => {
            if (!obj || typeof obj !== 'object') return;

            for (const key of Object.keys(obj)) {
                if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    obj[key] = '[REDACTED]';
                } else if (typeof obj[key] === 'object') {
                    sanitizeObject(obj[key]);
                }
            }
        };

        sanitizeObject(sanitized);
        return sanitized;
    }

    private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
        const sanitized = { ...headers };
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];

        for (const header of sensitiveHeaders) {
            if (sanitized[header]) {
                sanitized[header] = '[REDACTED]';
            }
        }

        return sanitized;
    }
}

// Export singleton instance
export const trafficRecorder = new TrafficRecorder(); 