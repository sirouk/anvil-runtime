# Traffic Monitoring Setup for Anvil Bridge Development

## Overview

This document establishes protocol monitoring infrastructure to capture baseline Anvil communication patterns. These recordings will validate that our NextJS bridge behaves identically to the native Anvil client.

## Current Test Environment

**Server**: anvil-app-server running TestTodoApp on localhost:3030
- Java OpenJDK 11 + PostgreSQL@14 configured  
- WebSocket endpoint: `ws://localhost:3030/_/uplink`
- HTTP endpoint: `http://localhost:3030/`
- Session management: 32-char browser sessions with encrypted cookies

## Monitoring Tools Setup

### 1. Chrome DevTools WebSocket Monitoring

#### Setup Procedure
1. **Open TestTodoApp**: Navigate to `http://localhost:3030/` in Chrome
2. **Open DevTools**: F12 → Network tab
3. **Filter WebSocket**: Click "WS" filter button to show only WebSocket traffic
4. **Start Monitoring**: All WebSocket messages will be captured automatically

#### Manual Capture Process
```bash
# 1. Start monitoring session
echo "=== Anvil Protocol Capture Session: $(date) ===" > capture-log.txt

# 2. Document test scenario
echo "Scenario: TestTodoApp - Add/Complete/Delete Task Workflow" >> capture-log.txt

# 3. Perform test actions in browser while DevTools captures traffic:
#    - Load application (initial WebSocket handshake)
#    - Add new task ("Test Task")
#    - Mark task as completed  
#    - Delete task
#    - Reload page (session restoration)

# 4. Export captured data
# Right-click on WebSocket connection → "Save as HAR"
```

#### Key Messages to Capture

**Session Initialization**:
- Initial WebSocket connection establishment
- Authentication/session validation messages
- App configuration loading
- Component instantiation requests

**User Interactions**:
- Form input changes (TextBox updates)
- Button click events
- Server function calls (`anvil.server.call`)
- Data table operations (add/update/delete tasks)

**Real-time Updates**:
- Component state synchronization
- Data binding updates  
- Custom event propagation (`x-delete-task`)
- Heartbeat/keepalive messages

### 2. Automated Traffic Capture Scripts

#### WebSocket Traffic Logger
```javascript
// bridge/tools/websocket-logger.js
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
```

#### HTTP Request Monitor
```javascript
// bridge/tools/http-monitor.js
const axios = require('axios');
const fs = require('fs');

class AnvilHttpMonitor {
  constructor(baseUrl = 'http://localhost:3030') {
    this.baseUrl = baseUrl;
    this.logFile = `logs/anvil-http-${Date.now()}.json`;
    this.requests = [];
  }

  async monitorEndpoint(path, method = 'GET', data = null) {
    const startTime = Date.now();
    const url = `${this.baseUrl}${path}`;
    
    try {
      const response = await axios({
        method,
        url,
        data,
        timeout: 10000,
        validateStatus: () => true // Accept all status codes
      });

      const endTime = Date.now();
      const requestLog = {
        timestamp: startTime,
        duration: endTime - startTime,
        request: {
          method,
          url,
          data,
          headers: response.config.headers
        },
        response: {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data?.length > 1000 ? 
                 `[${response.data.length} bytes]` : 
                 response.data
        }
      };

      this.requests.push(requestLog);
      console.log(`${method} ${path} → ${response.status} (${endTime - startTime}ms)`);
      
      return response;
    } catch (error) {
      const errorLog = {
        timestamp: startTime,
        request: { method, url, data },
        error: error.message
      };
      this.requests.push(errorLog);
      console.error(`${method} ${path} → ERROR: ${error.message}`);
      throw error;
    }
  }

  saveLog() {
    const logData = {
      baseUrl: this.baseUrl,
      timestamp: Date.now(),
      requests: this.requests,
      summary: {
        totalRequests: this.requests.length,
        successfulRequests: this.requests.filter(r => r.response?.status < 400).length,
        errorRequests: this.requests.filter(r => r.error || r.response?.status >= 400).length
      }
    };

    fs.writeFileSync(this.logFile, JSON.stringify(logData, null, 2));
    console.log(`HTTP log saved: ${this.logFile}`);
  }
}

module.exports = AnvilHttpMonitor;
```

### 3. Test Data Generation

#### Baseline Test Scenarios
```javascript
// bridge/tools/test-scenarios.js
const AnvilTrafficLogger = require('./websocket-logger');
const AnvilHttpMonitor = require('./http-monitor');

class AnvilTestScenarios {
  constructor() {
    this.wsLogger = new AnvilTrafficLogger();
    this.httpMonitor = new AnvilHttpMonitor();
  }

  async runBaselineCapture() {
    console.log('Starting baseline Anvil protocol capture...');
    
    // Scenario 1: HTTP Application Loading
    await this.captureApplicationLoad();
    
    // Scenario 2: WebSocket Communication  
    await this.captureWebSocketFlow();
    
    // Scenario 3: Static Resource Loading
    await this.captureStaticResources();
    
    console.log('Baseline capture completed');
  }

  async captureApplicationLoad() {
    console.log('\\n=== HTTP Application Loading ===');
    
    // Main application page
    await this.httpMonitor.monitorEndpoint('/');
    
    // Session creation and cookies
    await this.httpMonitor.monitorEndpoint('/');
    
    this.httpMonitor.saveLog();
  }

  async captureWebSocketFlow() {
    console.log('\\n=== WebSocket Communication Flow ===');
    
    await this.wsLogger.startCapture();
    
    // Wait for connection
    await this.sleep(2000);
    
    // Simulate session initialization (this would normally come from browser)
    this.wsLogger.sendMessage({
      type: 'SESSION_INIT',
      id: this.generateId(),
      payload: {
        appId: 'TestTodoApp',
        clientCapabilities: ['skulpt', 'material_design'],
        runtimeVersion: 'client-core'
      },
      timestamp: Date.now()
    });

    // Simulate component interactions
    this.wsLogger.sendMessage({
      type: 'SERVER_CALL',
      id: this.generateId(),
      payload: {
        function: 'get_tasks',
        args: [],
        kwargs: {}
      },
      timestamp: Date.now()
    });

    // Wait for responses
    await this.sleep(5000);
    
    this.wsLogger.disconnect();
  }

  async captureStaticResources() {
    console.log('\\n=== Static Resource Loading ===');
    
    const staticResources = [
      '/_/static/runtime/css/bootstrap.css',
      '/_/static/runtime/css/bootstrap-theme.min.css',
      '/_/app/TestTodoApp'
    ];

    for (const resource of staticResources) {
      await this.httpMonitor.monitorEndpoint(resource);
      await this.sleep(100);
    }
  }

  generateId() {
    return Math.random().toString(36).substr(2, 9);
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AnvilTestScenarios;
```

### 4. Bridge Validation Framework

#### Protocol Comparison Tool
```javascript
// bridge/tools/protocol-validator.js
class AnvilProtocolValidator {
  constructor() {
    this.tolerances = {
      timingDelta: 100, // 100ms tolerance for timing differences
      messageOrderFlexibility: 2 // Allow 2 messages out of order
    };
  }

  validateProtocolCompliance(nativeLog, bridgeLog) {
    const results = {
      passed: 0,
      failed: 0,
      warnings: 0,
      details: []
    };

    // Message structure validation
    this.validateMessageStructure(nativeLog, bridgeLog, results);
    
    // Session management validation  
    this.validateSessionManagement(nativeLog, bridgeLog, results);
    
    // Event timing validation
    this.validateEventTiming(nativeLog, bridgeLog, results);
    
    // Custom event validation
    this.validateCustomEvents(nativeLog, bridgeLog, results);

    return results;
  }

  validateMessageStructure(nativeLog, bridgeLog, results) {
    console.log('Validating message structure compatibility...');
    
    const nativeMessageTypes = new Set(
      nativeLog.messages
        .filter(m => m.direction === 'sent')
        .map(m => m.data.type)
    );
    
    const bridgeMessageTypes = new Set(
      bridgeLog.messages
        .filter(m => m.direction === 'sent')  
        .map(m => m.data.type)
    );

    // Check if bridge supports all native message types
    for (const messageType of nativeMessageTypes) {
      if (bridgeMessageTypes.has(messageType)) {
        results.passed++;
        results.details.push(`✅ Message type ${messageType} supported`);
      } else {
        results.failed++;
        results.details.push(`❌ Message type ${messageType} missing in bridge`);
      }
    }
  }

  validateSessionManagement(nativeLog, bridgeLog, results) {
    console.log('Validating session management...');
    
    // Check session ID format consistency
    const nativeSessionPattern = /[A-Z0-9]{32}/;
    const bridgeSessionIds = bridgeLog.messages
      .filter(m => m.data.sessionId)
      .map(m => m.data.sessionId);

    if (bridgeSessionIds.every(id => nativeSessionPattern.test(id))) {
      results.passed++;
      results.details.push('✅ Session ID format matches native pattern');
    } else {
      results.failed++;
      results.details.push('❌ Session ID format does not match native pattern');
    }
  }

  validateEventTiming(nativeLog, bridgeLog, results) {
    console.log('Validating event timing patterns...');
    
    // Check heartbeat intervals
    const nativeHeartbeats = nativeLog.messages.filter(m => m.data.type === 'HEARTBEAT');
    const bridgeHeartbeats = bridgeLog.messages.filter(m => m.data.type === 'HEARTBEAT');

    if (nativeHeartbeats.length > 1 && bridgeHeartbeats.length > 1) {
      const nativeInterval = this.calculateAverageInterval(nativeHeartbeats);
      const bridgeInterval = this.calculateAverageInterval(bridgeHeartbeats);
      
      if (Math.abs(nativeInterval - bridgeInterval) < this.tolerances.timingDelta) {
        results.passed++;
        results.details.push(`✅ Heartbeat interval matches (±${this.tolerances.timingDelta}ms)`);
      } else {
        results.warnings++;
        results.details.push(`⚠️ Heartbeat interval differs: native=${nativeInterval}ms, bridge=${bridgeInterval}ms`);
      }
    }
  }

  calculateAverageInterval(messages) {
    if (messages.length < 2) return 0;
    
    const intervals = [];
    for (let i = 1; i < messages.length; i++) {
      intervals.push(messages[i].timestamp - messages[i-1].timestamp);
    }
    
    return intervals.reduce((a, b) => a + b, 0) / intervals.length;
  }

  generateComplianceReport(results) {
    const totalTests = results.passed + results.failed + results.warnings;
    const passRate = (results.passed / totalTests * 100).toFixed(1);
    
    return {
      summary: {
        totalTests,
        passed: results.passed,
        failed: results.failed,
        warnings: results.warnings,
        passRate: `${passRate}%`
      },
      compliance: results.failed === 0 ? 'COMPLIANT' : 'NON_COMPLIANT',
      details: results.details
    };
  }
}

module.exports = AnvilProtocolValidator;
```

## Usage Instructions

### 1. Manual Monitoring Session

```bash
# Terminal 1: Ensure Anvil server is running
cd /Users/$USER/anvil-runtime/anvil-testing
source anvil-env/bin/activate
export PATH="/opt/homebrew/opt/openjdk@11/bin:$PATH"
anvil-app-server --app TestTodoApp --port 3030 --database "jdbc:postgresql://localhost/testtodoapp?username=$USER" --auto-migrate

# Terminal 2: Prepare monitoring tools
cd /Users/$USER/anvil-runtime/bridge
mkdir -p logs tools
npm install ws axios

# Terminal 3: Start traffic capture
node tools/test-scenarios.js

# Browser: Perform manual testing
# 1. Open http://localhost:3030/
# 2. Open Chrome DevTools → Network → WS filter
# 3. Perform test actions:
#    - Add task: "Test Protocol Capture"
#    - Mark as complete
#    - Delete task
#    - Reload page
# 4. Export WebSocket traffic as HAR file
```

### 2. Automated Baseline Recording

```bash
# Run comprehensive baseline capture
cd /Users/$USER/anvil-runtime/bridge
node -e "
  const TestScenarios = require('./tools/test-scenarios');
  const scenarios = new TestScenarios();
  scenarios.runBaselineCapture();
"
```

### 3. Bridge Validation Testing

```bash
# Compare bridge behavior against baseline (when bridge is ready)
node -e "
  const Validator = require('./tools/protocol-validator');
  const validator = new Validator();
  
  const nativeLog = require('./logs/anvil-traffic-baseline.json');
  const bridgeLog = require('./logs/bridge-traffic-test.json');
  
  const results = validator.validateProtocolCompliance(nativeLog, bridgeLog);
  const report = validator.generateComplianceReport(results);
  
  console.log(JSON.stringify(report, null, 2));
"
```

## Expected Monitoring Outputs

### WebSocket Message Patterns
```json
{
  "session": {
    "startTime": 1640995200000,
    "duration": 30000,
    "serverUrl": "ws://localhost:3030/_/uplink"
  },
  "messages": [
    {
      "timestamp": 1640995201000,
      "direction": "received",
      "type": "Server → Client", 
      "data": {
        "type": "SESSION_INIT_RESPONSE",
        "id": "resp_001",
        "sessionId": "XZQXN2KIRIH3PZKPU5PGDWXY",
        "success": true
      }
    }
  ]
}
```

### HTTP Request Patterns
```json
{
  "requests": [
    {
      "timestamp": 1640995200000,
      "duration": 150,
      "request": {
        "method": "GET",
        "url": "http://localhost:3030/"
      },
      "response": {
        "status": 200,
        "headers": {
          "set-cookie": "anvil-session=SESSIONID%3DEncryptedData; Path=/; HttpOnly"
        }
      }
    }
  ]
}
```

## Validation Criteria

**Protocol Compliance**:
- ✅ WebSocket message structure matches native client exactly
- ✅ Session management behavior identical to native
- ✅ HTTP headers and cookies properly maintained
- ✅ Event timing within acceptable tolerance (±100ms)
- ✅ Custom events propagate correctly

**Performance Baselines**:
- WebSocket connection: <500ms establishment time
- Message throughput: 10-50 messages/second sustained
- HTTP requests: <200ms for static resources
- Session creation: <100ms for cookie setup

**Quality Metrics**:
- Protocol compliance: >95% message compatibility  
- Timing accuracy: ±100ms for interactive events
- Error rate: <1% failed message delivery
- Session stability: 99%+ session persistence

---

**Document Status**: ✅ Complete monitoring infrastructure specification  
**Last Updated**: July 23, 2025  
**Environment**: TestTodoApp on anvil-app-server with Java/PostgreSQL  
**Next Steps**: Set up actual monitoring tools and capture baseline recordings 