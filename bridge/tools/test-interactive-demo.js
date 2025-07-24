#!/usr/bin/env node

/**
 * Interactive Components Visual Demo
 * 
 * This tool provides an interactive demonstration of all enhanced interactive
 * components including Button, Link, Timer, Notification, and DataGrid.
 */

const fs = require('fs');
const path = require('path');

// Generate HTML demo page
function generateDemoHTML() {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enhanced Interactive Components Demo</title>
    <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Roboto', sans-serif;
            background-color: #f5f5f5;
            padding: 20px;
            line-height: 1.6;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            padding: 30px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            padding-bottom: 20px;
            border-bottom: 2px solid #1976d2;
        }

        .header h1 {
            color: #1976d2;
            font-size: 2.5rem;
            margin-bottom: 10px;
        }

        .header p {
            color: #666;
            font-size: 1.1rem;
        }

        .section {
            margin-bottom: 50px;
        }

        .section h2 {
            color: #333;
            font-size: 1.8rem;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }

        .component-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .demo-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            background: #fafafa;
        }

        .demo-card h3 {
            color: #1976d2;
            margin-bottom: 15px;
            font-size: 1.2rem;
        }

        .demo-card .demo-content {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        /* Enhanced Button Styles */
        .anvil-enhanced-button {
            position: relative;
            overflow: hidden;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            font-family: 'Roboto', sans-serif;
            font-weight: 500;
            text-transform: none;
            cursor: pointer;
            transition: all 0.2s ease-in-out;
            text-decoration: none;
            min-height: 36px;
        }

        .anvil-enhanced-button:disabled {
            cursor: not-allowed;
            opacity: 0.6;
        }

        .anvil-button-contained.anvil-button-primary-color {
            background-color: #1976d2;
            color: #ffffff;
        }

        .anvil-button-contained.anvil-button-secondary-color {
            background-color: #dc004e;
            color: #ffffff;
        }

        .anvil-button-outlined.anvil-button-primary-color {
            background-color: transparent;
            color: #1976d2;
            border: 1px solid #1976d2;
        }

        .anvil-button-text.anvil-button-primary-color {
            background-color: transparent;
            color: #1976d2;
        }

        .anvil-button-small {
            padding: 6px 12px;
            font-size: 12px;
            min-height: 28px;
        }

        .anvil-button-large {
            padding: 12px 24px;
            font-size: 16px;
            min-height: 48px;
        }

        .anvil-enhanced-button:hover:not(:disabled) {
            filter: brightness(0.9);
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }

        .anvil-enhanced-button:active:not(:disabled) {
            transform: scale(0.98);
        }

        /* Loading Spinner */
        .anvil-button-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid transparent;
            border-top: 2px solid currentColor;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }

        /* Link Styles */
        .anvil-link {
            color: #1976d2;
            text-decoration: none;
            cursor: pointer;
            transition: color 0.2s ease;
        }

        .anvil-link:hover {
            text-decoration: underline;
        }

        /* Notification Styles */
        .anvil-notification {
            position: relative;
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 16px;
            border-radius: 4px;
            font-family: 'Roboto', sans-serif;
            margin-bottom: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .anvil-notification-info {
            background-color: #2196f3;
            color: #ffffff;
        }

        .anvil-notification-success {
            background-color: #4caf50;
            color: #ffffff;
        }

        .anvil-notification-warning {
            background-color: #ff9800;
            color: #ffffff;
        }

        .anvil-notification-error {
            background-color: #f44336;
            color: #ffffff;
        }

        .anvil-notification-close {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            font-size: 18px;
            line-height: 1;
            padding: 0;
            opacity: 0.7;
            transition: opacity 0.2s ease;
        }

        .anvil-notification-close:hover {
            opacity: 1;
        }

        .anvil-notification-content {
            flex: 1;
        }

        .anvil-notification-title {
            font-weight: 600;
            margin-bottom: 4px;
        }

        /* DataGrid Styles */
        .anvil-data-grid {
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            overflow: auto;
            background-color: #ffffff;
            font-family: 'Roboto', sans-serif;
        }

        .anvil-data-grid table {
            width: 100%;
            border-collapse: collapse;
        }

        .anvil-data-grid th,
        .anvil-data-grid td {
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid #e0e0e0;
        }

        .anvil-data-grid th {
            background-color: #f5f5f5;
            font-weight: 600;
            cursor: pointer;
            user-select: none;
        }

        .anvil-data-grid tr:hover {
            background-color: #f8f9fa;
        }

        .anvil-data-grid tr.selected {
            background-color: #e3f2fd;
        }

        .demo-controls {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            flex-wrap: wrap;
        }

        .control-group {
            display: flex;
            flex-direction: column;
            gap: 5px;
        }

        .control-group label {
            font-size: 0.9rem;
            color: #666;
        }

        .control-group select,
        .control-group input {
            padding: 5px 8px;
            border: 1px solid #ccc;
            border-radius: 4px;
        }

        .timer-controls {
            display: flex;
            gap: 10px;
            margin-top: 10px;
        }

        .timer-display {
            font-family: monospace;
            font-size: 1.2rem;
            padding: 10px;
            background: #f0f0f0;
            border-radius: 4px;
            margin-bottom: 10px;
        }

        .log-output {
            background: #1e1e1e;
            color: #00ff00;
            font-family: monospace;
            padding: 15px;
            border-radius: 4px;
            height: 150px;
            overflow-y: auto;
            margin-top: 10px;
        }

        .status-indicator {
            display: inline-block;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            margin-right: 8px;
        }

        .status-running {
            background-color: #4caf50;
        }

        .status-stopped {
            background-color: #f44336;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Enhanced Interactive Components Demo</h1>
            <p>Interactive demonstration of Anvil Bridge enhanced components</p>
        </div>

        <!-- Enhanced Button Section -->
        <div class="section">
            <h2>🔘 Enhanced Button Component</h2>
            
            <div class="demo-controls">
                <div class="control-group">
                    <label>Variant:</label>
                    <select id="button-variant">
                        <option value="contained">Contained</option>
                        <option value="outlined">Outlined</option>
                        <option value="text">Text</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Role:</label>
                    <select id="button-role">
                        <option value="primary-color">Primary Color</option>
                        <option value="secondary-color">Secondary Color</option>
                        <option value="outlined">Outlined</option>
                        <option value="raised">Raised</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Size:</label>
                    <select id="button-size">
                        <option value="small">Small</option>
                        <option value="medium" selected>Medium</option>
                        <option value="large">Large</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Text:</label>
                    <input type="text" id="button-text" value="Click Me!" />
                </div>
            </div>

            <div class="component-grid">
                <div class="demo-card">
                    <h3>Basic Buttons</h3>
                    <div class="demo-content">
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-medium" onclick="showNotification('Primary button clicked!', 'info')">
                            Primary Button
                        </button>
                        <button class="anvil-enhanced-button anvil-button-outlined anvil-button-primary-color anvil-button-medium" onclick="showNotification('Outlined button clicked!', 'info')">
                            Outlined Button
                        </button>
                        <button class="anvil-enhanced-button anvil-button-text anvil-button-primary-color anvil-button-medium" onclick="showNotification('Text button clicked!', 'info')">
                            Text Button
                        </button>
                    </div>
                </div>

                <div class="demo-card">
                    <h3>Button Sizes</h3>
                    <div class="demo-content">
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small">
                            Small
                        </button>
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-medium">
                            Medium
                        </button>
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-large">
                            Large
                        </button>
                    </div>
                </div>

                <div class="demo-card">
                    <h3>Loading State</h3>
                    <div class="demo-content">
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-medium" onclick="simulateLoading(this)">
                            Submit Form
                        </button>
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-secondary-color anvil-button-medium" disabled>
                            <span class="anvil-button-spinner"></span>
                            Loading...
                        </button>
                    </div>
                </div>

                <div class="demo-card">
                    <h3>Customizable Button</h3>
                    <div class="demo-content">
                        <button id="custom-button" class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-medium" onclick="showNotification('Custom button clicked!', 'success')">
                            Click Me!
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Link Component Section -->
        <div class="section">
            <h2>🔗 Link Component</h2>
            <div class="component-grid">
                <div class="demo-card">
                    <h3>Link Types</h3>
                    <div class="demo-content">
                        <a href="#" class="anvil-link" onclick="event.preventDefault(); showNotification('External link clicked!', 'info')">External Link</a>
                        <a href="#" class="anvil-link" onclick="event.preventDefault(); showNotification('Form navigation triggered!', 'info')">Navigate to Form</a>
                        <a href="#" class="anvil-link" onclick="event.preventDefault(); showNotification('Internal navigation!', 'info')">Internal Navigation</a>
                    </div>
                </div>

                <div class="demo-card">
                    <h3>Underline Styles</h3>
                    <div class="demo-content">
                        <a href="#" class="anvil-link" style="text-decoration: underline;" onclick="event.preventDefault()">Always Underlined</a>
                        <a href="#" class="anvil-link" onclick="event.preventDefault()">Hover to Underline</a>
                        <a href="#" class="anvil-link" style="text-decoration: none;" onmouseover="this.style.textDecoration='none'" onclick="event.preventDefault()">Never Underlined</a>
                    </div>
                </div>
            </div>
        </div>

        <!-- Timer Component Section -->
        <div class="section">
            <h2>⏱️ Timer Component</h2>
            <div class="demo-card">
                <h3>Timer Demo</h3>
                <div class="timer-display">
                    <span class="status-indicator status-stopped" id="timer-status"></span>
                    Tick Count: <span id="tick-count">0</span> | 
                    Elapsed: <span id="elapsed-time">0.0s</span>
                </div>
                <div class="timer-controls">
                    <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small" onclick="startTimer()">Start</button>
                    <button class="anvil-enhanced-button anvil-button-outlined anvil-button-primary-color anvil-button-small" onclick="stopTimer()">Stop</button>
                    <button class="anvil-enhanced-button anvil-button-text anvil-button-primary-color anvil-button-small" onclick="resetTimer()">Reset</button>
                    <select id="timer-interval" onchange="updateTimerInterval()">
                        <option value="1000" selected>1 second</option>
                        <option value="500">0.5 seconds</option>
                        <option value="100">0.1 seconds</option>
                    </select>
                </div>
                <div class="log-output" id="timer-log">Timer events will appear here...</div>
            </div>
        </div>

        <!-- Notification Component Section -->
        <div class="section">
            <h2>🔔 Notification Component</h2>
            
            <div class="demo-controls">
                <div class="control-group">
                    <label>Type:</label>
                    <select id="notification-type">
                        <option value="info">Info</option>
                        <option value="success">Success</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                    </select>
                </div>
                <div class="control-group">
                    <label>Title:</label>
                    <input type="text" id="notification-title" value="Test Notification" />
                </div>
                <div class="control-group">
                    <label>Message:</label>
                    <input type="text" id="notification-message" value="This is a test message" />
                </div>
                <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small" onclick="showCustomNotification()">
                    Show Notification
                </button>
            </div>

            <div class="component-grid">
                <div class="demo-card">
                    <h3>Notification Types</h3>
                    <div class="demo-content">
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small" onclick="showNotification('This is an info message', 'info')">Info</button>
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small" onclick="showNotification('Operation completed successfully!', 'success')">Success</button>
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small" onclick="showNotification('Please check your input', 'warning')">Warning</button>
                        <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small" onclick="showNotification('Something went wrong', 'error')">Error</button>
                    </div>
                </div>

                <div class="demo-card">
                    <h3>Auto-Hide Demo</h3>
                    <div class="demo-content">
                        <button class="anvil-enhanced-button anvil-button-outlined anvil-button-primary-color anvil-button-small" onclick="showAutoHideNotification()">Auto-Hide (3s)</button>
                        <button class="anvil-enhanced-button anvil-button-outlined anvil-button-primary-color anvil-button-small" onclick="showPersistentNotification()">Persistent</button>
                    </div>
                </div>
            </div>

            <div id="notification-area" style="position: fixed; top: 20px; right: 20px; z-index: 1000; max-width: 400px;"></div>
        </div>

        <!-- DataGrid Component Section -->
        <div class="section">
            <h2>📊 DataGrid Component</h2>
            
            <div class="demo-controls">
                <button class="anvil-enhanced-button anvil-button-contained anvil-button-primary-color anvil-button-small" onclick="addRandomRow()">Add Row</button>
                <button class="anvil-enhanced-button anvil-button-outlined anvil-button-primary-color anvil-button-small" onclick="clearGrid()">Clear Grid</button>
                <button class="anvil-enhanced-button anvil-button-text anvil-button-primary-color anvil-button-small" onclick="loadSampleData()">Load Sample Data</button>
            </div>

            <div class="demo-card">
                <h3>Sample DataGrid</h3>
                <div class="anvil-data-grid">
                    <table id="sample-grid">
                        <thead>
                            <tr>
                                <th onclick="sortGrid('id')">ID ↕</th>
                                <th onclick="sortGrid('name')">Name ↕</th>
                                <th onclick="sortGrid('email')">Email ↕</th>
                                <th onclick="sortGrid('role')">Role ↕</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody id="grid-body">
                            <!-- Data will be populated by JavaScript -->
                        </tbody>
                    </table>
                </div>
                <div style="margin-top: 10px; color: #666; font-size: 0.9rem;">
                    Selected rows: <span id="selected-count">0</span>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Component state
        let timerInterval = null;
        let tickCount = 0;
        let startTime = null;
        let currentInterval = 1000;
        let notificationCounter = 0;
        let gridData = [];
        let selectedRows = new Set();
        let sortOrder = { column: null, direction: 'asc' };

        // Button customization
        function updateCustomButton() {
            const button = document.getElementById('custom-button');
            const variant = document.getElementById('button-variant').value;
            const role = document.getElementById('button-role').value;
            const size = document.getElementById('button-size').value;
            const text = document.getElementById('button-text').value;

            // Update classes
            button.className = \`anvil-enhanced-button anvil-button-\${variant} anvil-button-\${role} anvil-button-\${size}\`;
            button.textContent = text;
        }

        // Add event listeners for button customization
        document.getElementById('button-variant').addEventListener('change', updateCustomButton);
        document.getElementById('button-role').addEventListener('change', updateCustomButton);
        document.getElementById('button-size').addEventListener('change', updateCustomButton);
        document.getElementById('button-text').addEventListener('input', updateCustomButton);

        // Loading simulation
        function simulateLoading(button) {
            const originalText = button.textContent;
            button.disabled = true;
            button.innerHTML = '<span class="anvil-button-spinner"></span> Loading...';
            
            setTimeout(() => {
                button.disabled = false;
                button.textContent = originalText;
                showNotification('Operation completed!', 'success');
            }, 2000);
        }

        // Timer functions
        function startTimer() {
            if (timerInterval) return;
            
            const statusIndicator = document.getElementById('timer-status');
            statusIndicator.className = 'status-indicator status-running';
            
            if (!startTime) {
                startTime = Date.now();
            } else {
                startTime = Date.now() - (tickCount * currentInterval);
            }
            
            timerInterval = setInterval(() => {
                tickCount++;
                const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
                
                document.getElementById('tick-count').textContent = tickCount;
                document.getElementById('elapsed-time').textContent = elapsed + 's';
                
                logTimerEvent(\`Tick \${tickCount} at \${elapsed}s\`);
            }, currentInterval);
            
            logTimerEvent('Timer started');
        }

        function stopTimer() {
            if (timerInterval) {
                clearInterval(timerInterval);
                timerInterval = null;
                
                const statusIndicator = document.getElementById('timer-status');
                statusIndicator.className = 'status-indicator status-stopped';
                
                logTimerEvent('Timer stopped');
            }
        }

        function resetTimer() {
            stopTimer();
            tickCount = 0;
            startTime = null;
            
            document.getElementById('tick-count').textContent = '0';
            document.getElementById('elapsed-time').textContent = '0.0s';
            
            logTimerEvent('Timer reset');
        }

        function updateTimerInterval() {
            const newInterval = parseInt(document.getElementById('timer-interval').value);
            const wasRunning = timerInterval !== null;
            
            if (wasRunning) {
                stopTimer();
                currentInterval = newInterval;
                startTimer();
            } else {
                currentInterval = newInterval;
            }
            
            logTimerEvent(\`Interval changed to \${newInterval}ms\`);
        }

        function logTimerEvent(message) {
            const log = document.getElementById('timer-log');
            const timestamp = new Date().toLocaleTimeString();
            log.innerHTML += \`[\${timestamp}] \${message}\\n\`;
            log.scrollTop = log.scrollHeight;
        }

        // Notification functions
        function showNotification(message, type = 'info', title = null, autoHide = true) {
            const notificationArea = document.getElementById('notification-area');
            const id = 'notification-' + (++notificationCounter);
            
            const notification = document.createElement('div');
            notification.id = id;
            notification.className = \`anvil-notification anvil-notification-\${type}\`;
            
            const icon = type === 'info' ? 'ℹ' : 
                        type === 'success' ? '✓' : 
                        type === 'warning' ? '⚠' : '✕';
            
            notification.innerHTML = \`
                <span class="anvil-notification-icon">\${icon}</span>
                <div class="anvil-notification-content">
                    \${title ? \`<div class="anvil-notification-title">\${title}</div>\` : ''}
                    <div class="anvil-notification-message">\${message}</div>
                </div>
                <button class="anvil-notification-close" onclick="dismissNotification('\${id}')">×</button>
            \`;
            
            notificationArea.appendChild(notification);
            
            if (autoHide) {
                setTimeout(() => dismissNotification(id), 5000);
            }
        }

        function showCustomNotification() {
            const type = document.getElementById('notification-type').value;
            const title = document.getElementById('notification-title').value;
            const message = document.getElementById('notification-message').value;
            
            showNotification(message, type, title, false);
        }

        function showAutoHideNotification() {
            showNotification('This notification will disappear in 3 seconds', 'info', 'Auto-Hide Demo', true);
        }

        function showPersistentNotification() {
            showNotification('This notification stays until dismissed', 'warning', 'Persistent Demo', false);
        }

        function dismissNotification(id) {
            const notification = document.getElementById(id);
            if (notification) {
                notification.style.animation = 'slideOut 0.3s ease-in forwards';
                setTimeout(() => notification.remove(), 300);
            }
        }

        // DataGrid functions
        function loadSampleData() {
            gridData = [
                { id: 1, name: 'John Doe', email: 'john@example.com', role: 'Admin' },
                { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'User' },
                { id: 3, name: 'Bob Johnson', email: 'bob@example.com', role: 'Manager' },
                { id: 4, name: 'Alice Brown', email: 'alice@example.com', role: 'User' },
                { id: 5, name: 'Charlie Wilson', email: 'charlie@example.com', role: 'Admin' }
            ];
            renderGrid();
        }

        function addRandomRow() {
            const names = ['David', 'Emily', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Kate'];
            const roles = ['Admin', 'User', 'Manager', 'Guest'];
            
            const name = names[Math.floor(Math.random() * names.length)];
            const role = roles[Math.floor(Math.random() * roles.length)];
            const email = \`\${name.toLowerCase()}@example.com\`;
            const id = Math.max(...gridData.map(row => row.id), 0) + 1;
            
            gridData.push({ id, name, email, role });
            renderGrid();
            showNotification(\`Added \${name} to the grid\`, 'success');
        }

        function clearGrid() {
            gridData = [];
            selectedRows.clear();
            renderGrid();
            showNotification('Grid cleared', 'info');
        }

        function sortGrid(column) {
            if (sortOrder.column === column) {
                sortOrder.direction = sortOrder.direction === 'asc' ? 'desc' : 'asc';
            } else {
                sortOrder.column = column;
                sortOrder.direction = 'asc';
            }
            
            gridData.sort((a, b) => {
                const aVal = a[column];
                const bVal = b[column];
                const comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return sortOrder.direction === 'asc' ? comparison : -comparison;
            });
            
            renderGrid();
            showNotification(\`Sorted by \${column} (\${sortOrder.direction})\`, 'info');
        }

        function toggleRowSelection(id) {
            if (selectedRows.has(id)) {
                selectedRows.delete(id);
            } else {
                selectedRows.add(id);
            }
            renderGrid();
        }

        function deleteRow(id) {
            gridData = gridData.filter(row => row.id !== id);
            selectedRows.delete(id);
            renderGrid();
            showNotification('Row deleted', 'warning');
        }

        function renderGrid() {
            const tbody = document.getElementById('grid-body');
            tbody.innerHTML = '';
            
            gridData.forEach(row => {
                const tr = document.createElement('tr');
                tr.className = selectedRows.has(row.id) ? 'selected' : '';
                tr.onclick = () => toggleRowSelection(row.id);
                
                tr.innerHTML = \`
                    <td>\${row.id}</td>
                    <td>\${row.name}</td>
                    <td>\${row.email}</td>
                    <td>\${row.role}</td>
                    <td>
                        <button class="anvil-enhanced-button anvil-button-text anvil-button-primary-color anvil-button-small" 
                                onclick="event.stopPropagation(); deleteRow(\${row.id})">Delete</button>
                    </td>
                \`;
                
                tbody.appendChild(tr);
            });
            
            document.getElementById('selected-count').textContent = selectedRows.size;
        }

        // Initialize demo
        document.addEventListener('DOMContentLoaded', function() {
            loadSampleData();
            logTimerEvent('Timer demo initialized');
            showNotification('Interactive components demo loaded!', 'success', 'Welcome');
        });

        // Add slide-out animation
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes slideOut {
                from {
                    opacity: 1;
                    transform: translateX(0);
                }
                to {
                    opacity: 0;
                    transform: translateX(100%);
                }
            }
        \`;
        document.head.appendChild(style);
    </script>
</body>
</html>`;
}

// Main execution
async function runDemo() {
    console.log('🚀 Enhanced Interactive Components Demo');
    console.log('=======================================');

    try {
        // Generate demo HTML
        const demoHTML = generateDemoHTML();
        const demoPath = path.join(process.cwd(), 'demo-interactive-components.html');

        fs.writeFileSync(demoPath, demoHTML);

        console.log('✅ Demo HTML generated successfully!');
        console.log(`📄 Demo file: ${demoPath}`);
        console.log('');
        console.log('🎯 Demo Features:');
        console.log('   • Enhanced Button - All variants, sizes, loading states');
        console.log('   • Link Component - Navigation and external links');
        console.log('   • Timer Component - Start/stop/reset with real-time display');
        console.log('   • Notification System - All types with auto-hide options');
        console.log('   • DataGrid Component - Sorting, selection, CRUD operations');
        console.log('');
        console.log('🌐 Open the HTML file in your browser to see the demo!');
        console.log('💡 Try all the interactive features and controls.');

    } catch (error) {
        console.error('❌ Error generating demo:', error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    runDemo();
}

module.exports = { runDemo }; 