const WebSocket = require('ws');
const fs = require('fs');

class AnvilTrafficLogger {
    constructor(serverUrl = 'ws://localhost:3030/_/uplink') {
        this.serverUrl = serverUrl;
        this.logFile = `logs/anvil-traffic-${Date.now()}.json`;
        this.messages = [];
        this.startTime = Date.now();
    }

    async startCapture() {
        console.log(`Starting Anvil traffic capture: ${this.serverUrl}`);

        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => {
            console.log('WebSocket connection established');
            this.logMessage('connection', 'WebSocket opened', { timestamp: Date.now() });
        });

        this.ws.on('message', (data) => {
            try {
                const message = JSON.parse(data.toString());
                this.logMessage('received', 'Server → Client', message);
                console.log('←', JSON.stringify(message, null, 2));
            } catch (e) {
                this.logMessage('received', 'Binary/Invalid JSON', {
                    data: data.toString('base64'),
                    size: data.length
                });
            }
        });

        this.ws.on('close', (code, reason) => {
            this.logMessage('connection', 'WebSocket closed', { code, reason: reason.toString() });
            this.saveLog();
        });

        this.ws.on('error', (error) => {
            this.logMessage('error', 'WebSocket error', { error: error.message });
            console.error('WebSocket error:', error);
        });
    }

    sendMessage(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const messageStr = JSON.stringify(message);
            this.ws.send(messageStr);
            this.logMessage('sent', 'Client → Server', message);
            console.log('→', JSON.stringify(message, null, 2));
        }
    }

    logMessage(direction, type, data) {
        this.messages.push({
            timestamp: Date.now(),
            relativeTime: Date.now() - this.startTime,
            direction,
            type,
            data
        });
    }

    saveLog() {
        const logData = {
            session: {
                startTime: this.startTime,
                endTime: Date.now(),
                duration: Date.now() - this.startTime,
                serverUrl: this.serverUrl
            },
            messages: this.messages,
            summary: {
                totalMessages: this.messages.length,
                sentMessages: this.messages.filter(m => m.direction === 'sent').length,
                receivedMessages: this.messages.filter(m => m.direction === 'received').length,
                errorMessages: this.messages.filter(m => m.direction === 'error').length
            }
        };

        fs.writeFileSync(this.logFile, JSON.stringify(logData, null, 2));
        console.log(`Traffic log saved: ${this.logFile}`);
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

module.exports = AnvilTrafficLogger; 