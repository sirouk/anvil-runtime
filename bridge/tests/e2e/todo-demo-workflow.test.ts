/**
 * Comprehensive Todo Demo Workflow Test
 * 
 * This test spins up a complete Todo demo environment and tests:
 * - Setting up Todo demo app
 * - Starting Anvil server and NextJS bridge
 * - Adding two todo items
 * - Marking one item as complete
 * - Removing the first item
 * - Refreshing to verify persistence
 * - Full cleanup
 */

import { test, expect, Page, BrowserContext, chromium } from '@playwright/test';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs/promises';

const execAsync = promisify(exec);

interface TodoTestEnvironment {
    anvilProcess?: ChildProcess;
    nextjsProcess?: ChildProcess;
    websocketProcess?: ChildProcess;
    appDirectory: string;
    demoAppName: string;
    bridgeUrl: string;
    anvilUrl: string;
    websocketUrl: string;
}

const testEnv: TodoTestEnvironment = {
    appDirectory: path.join(__dirname, '../../../anvil-testing'),
    demoAppName: 'E2ETodoDemo',
    bridgeUrl: 'http://localhost:3000',
    anvilUrl: 'http://localhost:3030',
    websocketUrl: 'ws://localhost:3001'
};

// Test data
const testTodos = {
    first: `E2E Todo Item 1 - ${Date.now()}`,
    second: `E2E Todo Item 2 - ${Date.now() + 1}`
};

test.describe('Todo Demo Complete Workflow', () => {
    let page: Page;
    let context: BrowserContext;

    test.beforeAll(async () => {
        console.log('\n🚀 Setting up Todo Demo Environment...');

        // Setup environment
        await setupTodoDemoEnvironment();
        await startServices();
        await waitForServicesToBeReady();
    });

    test.afterAll(async () => {
        console.log('\n🧹 Cleaning up Todo Demo Environment...');
        await cleanupServices();
        await cleanupDemoApp();
    });

    test.beforeEach(async ({ browser }) => {
        context = await browser.newContext({
            recordVideo: { dir: 'test-results/videos/todo-demo/' },
            recordHar: { path: 'test-results/har/todo-demo.har' }
        });
        page = await context.newPage();

        // Enable console logging
        page.on('console', msg => console.log(`🖥️  Browser: ${msg.text()}`));
        page.on('pageerror', err => console.error(`❌ Page Error: ${err.message}`));
    });

    test.afterEach(async () => {
        await context.close();
    });

    test('Complete Todo workflow with persistence', async () => {
        console.log('\n📝 Testing complete Todo workflow...');

        // Step 1: Load the Todo app
        await test.step('Load Todo App', async () => {
            await page.goto(testEnv.bridgeUrl, { waitUntil: 'networkidle' });

            // Wait for Anvil app to load
            await page.waitForSelector('.anvil-form-container', { timeout: 30000 });

            // Verify app title
            await expect(page).toHaveTitle(/Todo|Task|MyTodoList/i);

            console.log('✅ Todo app loaded successfully');
        });

        // Step 2: Add first todo item
        await test.step('Add first todo item', async () => {
            await addTodoItem(page, testTodos.first);

            // Verify item appears in list
            await expect(page.locator('text=' + testTodos.first)).toBeVisible();
            console.log(`✅ Added first todo: ${testTodos.first}`);
        });

        // Step 3: Add second todo item
        await test.step('Add second todo item', async () => {
            await addTodoItem(page, testTodos.second);

            // Verify item appears in list
            await expect(page.locator('text=' + testTodos.second)).toBeVisible();
            console.log(`✅ Added second todo: ${testTodos.second}`);
        });

        // Step 4: Mark second item as complete
        await test.step('Mark second item as complete', async () => {
            await markTodoComplete(page, testTodos.second);

            // Verify item is marked as complete (check for strikethrough, completed class, or checkbox)
            const completedItem = page.locator('text=' + testTodos.second);
            await expect(completedItem).toBeVisible();

            // Check if item has completion indicators
            const hasCompletionIndicator = await checkForCompletionIndicators(page, testTodos.second);
            expect(hasCompletionIndicator).toBe(true);

            console.log(`✅ Marked second todo as complete: ${testTodos.second}`);
        });

        // Step 5: Delete first item
        await test.step('Delete first todo item', async () => {
            await deleteTodoItem(page, testTodos.first);

            // Verify item is removed from list
            await expect(page.locator('text=' + testTodos.first)).not.toBeVisible({ timeout: 5000 });
            console.log(`✅ Deleted first todo: ${testTodos.first}`);
        });

        // Step 6: Verify persistence after refresh
        await test.step('Verify persistence after page refresh', async () => {
            await page.reload({ waitUntil: 'networkidle' });

            // Wait for app to reload
            await page.waitForSelector('.anvil-form-container', { timeout: 30000 });

            // Verify first item is still gone
            await expect(page.locator('text=' + testTodos.first)).not.toBeVisible({ timeout: 5000 });

            // Verify second item is still there and still marked as complete
            await expect(page.locator('text=' + testTodos.second)).toBeVisible();
            const hasCompletionIndicator = await checkForCompletionIndicators(page, testTodos.second);
            expect(hasCompletionIndicator).toBe(true);

            console.log('✅ Data persistence verified after page refresh');
        });

        console.log('\n🎉 Todo workflow test completed successfully!');
    });
});

// Helper Functions

async function setupTodoDemoEnvironment(): Promise<void> {
    console.log('📋 Setting up Todo demo environment...');

    try {
        // Clean up any existing demo
        await cleanupDemoApp();

        // Create fresh Todo demo app using Anvil's create-app command
        // Ensure anvil-testing directory exists and create app inside it
        await fs.mkdir(testEnv.appDirectory, { recursive: true });
        const createAppCommand = `cd ${testEnv.appDirectory} && create-anvil-app todo-list ${testEnv.demoAppName}`;

        console.log(`Running: ${createAppCommand}`);
        const { stdout, stderr } = await execAsync(createAppCommand);

        if (stderr && !stderr.includes('Warning')) {
            console.warn('⚠️ Create app warnings:', stderr);
        }

        console.log('✅ Todo demo app created');

        // Verify app was created
        const appPath = path.join(testEnv.appDirectory, testEnv.demoAppName);
        const anvilYamlExists = await fs.access(path.join(appPath, 'anvil.yaml')).then(() => true).catch(() => false);

        if (!anvilYamlExists) {
            throw new Error(`Demo app not created at ${appPath}`);
        }

    } catch (error) {
        console.error('❌ Failed to setup Todo demo environment:', error);
        throw error;
    }
}

async function startServices(): Promise<void> {
    console.log('🚀 Starting services...');

    try {
        // Start Anvil server
        await startAnvilServer();

        // Start WebSocket bridge
        await startWebSocketBridge();

        // Start NextJS bridge
        await startNextJSBridge();

        console.log('✅ All services started');

    } catch (error) {
        console.error('❌ Failed to start services:', error);
        await cleanupServices();
        throw error;
    }
}

async function startAnvilServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        const appPath = path.join(testEnv.appDirectory, testEnv.demoAppName);
        const command = 'anvil-app-server';

        // Use Docker PostgreSQL connection if in Docker environment
        const databaseUrl = process.env.DOCKER_ENV
            ? 'jdbc:postgresql://postgres:5432/anvil_test?user=anvil_user&password=anvil_password'
            : 'jdbc:postgresql://localhost:5432/anvil_test?user=anvil_user&password=anvil_password';

        const args = [
            '--app', appPath,
            '--port', '3030',
            '--database', databaseUrl,
            '--auto-migrate'
        ];

        console.log(`Starting Anvil server: ${command} ${args.join(' ')}`);

        testEnv.anvilProcess = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env, PATH: process.env.PATH }
        });

        let output = '';

        testEnv.anvilProcess.stdout?.on('data', (data) => {
            const chunk = data.toString();
            output += chunk;
            console.log('Anvil stdout:', chunk.trim());

            // Look for various startup indicators
            if (output.includes('Server is now running') ||
                output.includes('started on port') ||
                output.includes('ready') ||
                chunk.includes('Listening on')) {
                console.log('✅ Anvil server startup detected, verifying...');
                // Verify server is actually responding before considering it ready
                const verifyServer = async () => {
                    for (let attempt = 1; attempt <= 10; attempt++) {
                        try {
                            // Try multiple endpoints to verify server is responsive
                            const endpoints = [
                                'http://localhost:3030/',
                                'http://localhost:3030/_/',
                                'http://localhost:3030/_/health'
                            ];

                            for (const endpoint of endpoints) {
                                try {
                                    const response = await fetch(endpoint, {
                                        signal: AbortSignal.timeout(2000)
                                    });
                                    if (response.status < 500) { // Accept any non-server-error response
                                        console.log(`✅ Anvil server verified responsive at ${endpoint}`);
                                        resolve();
                                        return;
                                    }
                                } catch (endpointError) {
                                    // Try next endpoint
                                    continue;
                                }
                            }
                            throw new Error('All verification endpoints failed');
                        } catch (error) {
                            console.log(`⚠️ Server verification attempt ${attempt}/10:`, error instanceof Error ? error.message : String(error));
                        }
                        await new Promise(r => setTimeout(r, 1000));
                    }
                    reject(new Error('Anvil server started but failed verification checks'));
                };
                verifyServer();
            }
        });

        testEnv.anvilProcess.stderr?.on('data', (data) => {
            const error = data.toString();
            console.log('Anvil stderr:', error.trim());

            // Don't treat progress bars and warnings as errors
            if (!error.includes('Warning') &&
                !error.includes('INFO') &&
                !error.includes('%') &&
                !error.includes('Elapsed Time') &&
                !error.includes('ETA')) {
                console.error('❌ Anvil server error:', error);
            }
        });

        testEnv.anvilProcess.on('error', (error) => {
            console.error('Failed to start Anvil server:', error);
            reject(error);
        });

        // Extended timeout for containerized environments and database migration
        const timeoutMs = process.env.DOCKER_ENV ? 120000 : 60000; // 2min for Docker, 1min for local

        setTimeout(() => {
            if (testEnv.anvilProcess && !testEnv.anvilProcess.killed) {
                reject(new Error(`Anvil server startup timeout after ${timeoutMs / 1000}s. This may be due to:\n` +
                    `- Database schema migration (--auto-migrate) taking longer than expected\n` +
                    `- Slow JAR download in containerized environment\n` +
                    `- Network connectivity issues\n` +
                    `- Check anvil-app-server logs for more details`));
            }
        }, timeoutMs);
    });
}

async function startWebSocketBridge(): Promise<void> {
    return new Promise((resolve, reject) => {
        const bridgePath = path.join(__dirname, '../../server');

        testEnv.websocketProcess = spawn('node', ['websocket-server.js'], {
            cwd: bridgePath,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';

        testEnv.websocketProcess.stdout?.on('data', (data) => {
            output += data.toString();
            if (output.includes('listening on port 3001')) {
                console.log('✅ WebSocket bridge started');
                resolve();
            }
        });

        testEnv.websocketProcess.stderr?.on('data', (data) => {
            console.error('WebSocket bridge error:', data.toString());
        });

        testEnv.websocketProcess.on('error', (error) => {
            console.error('Failed to start WebSocket bridge:', error);
            reject(error);
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            if (testEnv.websocketProcess && !testEnv.websocketProcess.killed) {
                reject(new Error('WebSocket bridge startup timeout'));
            }
        }, 10000);
    });
}

async function startNextJSBridge(): Promise<void> {
    return new Promise((resolve, reject) => {
        const bridgePath = path.join(__dirname, '../..');

        testEnv.nextjsProcess = spawn('npm', ['run', 'dev'], {
            cwd: bridgePath,
            stdio: ['ignore', 'pipe', 'pipe']
        });

        let output = '';

        testEnv.nextjsProcess.stdout?.on('data', (data) => {
            output += data.toString();
            if (output.includes('Ready in') || output.includes('localhost:3000')) {
                console.log('✅ NextJS bridge started');
                resolve();
            }
        });

        testEnv.nextjsProcess.stderr?.on('data', (data) => {
            const error = data.toString();
            if (!error.includes('Warning') && !error.includes('Compiled')) {
                console.error('NextJS bridge error:', error);
            }
        });

        testEnv.nextjsProcess.on('error', (error) => {
            console.error('Failed to start NextJS bridge:', error);
            reject(error);
        });

        // Timeout after 60 seconds (NextJS can take a while to start)
        setTimeout(() => {
            if (testEnv.nextjsProcess && !testEnv.nextjsProcess.killed) {
                reject(new Error('NextJS bridge startup timeout'));
            }
        }, 60000);
    });
}

async function waitForServicesToBeReady(): Promise<void> {
    console.log('⏳ Waiting for services to be ready...');

    const services = [
        { name: 'Anvil Server', url: testEnv.anvilUrl },
        { name: 'NextJS Bridge', url: testEnv.bridgeUrl }
    ];

    for (const service of services) {
        await waitForService(service.name, service.url);
    }

    console.log('✅ All services are ready');
}

async function waitForService(name: string, url: string, timeout: number = 60000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: { 'User-Agent': 'E2E-Test/1.0' }
            });

            if (response.ok) {
                console.log(`✅ ${name} is ready`);
                return;
            }
        } catch (error) {
            // Service not ready yet
        }

        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error(`${name} not ready after ${timeout}ms`);
}

async function addTodoItem(page: Page, text: string): Promise<void> {
    // Try different selectors for todo input
    const inputSelectors = [
        'input[placeholder*="todo" i]',
        'input[placeholder*="task" i]',
        'input[placeholder*="add" i]',
        'input[type="text"]',
        '.anvil-textbox input',
        '[data-anvil-component="TextBox"] input',
        '.todo-input',
        '#todo-input'
    ];

    let inputElement = null;
    for (const selector of inputSelectors) {
        try {
            inputElement = await page.waitForSelector(selector, { timeout: 3000 });
            if (inputElement) {
                console.log(`Found todo input: ${selector}`);
                break;
            }
        } catch (error) {
            // Try next selector
        }
    }

    if (!inputElement) {
        throw new Error('Could not find todo input field');
    }

    // Fill the input
    await inputElement.fill(text);

    // Try to find and click add button or press Enter
    const buttonSelectors = [
        'button:has-text("Add")',
        'button:has-text("+")',
        'input[type="submit"]',
        '.anvil-button',
        '[data-anvil-component="Button"]',
        '.add-todo-button',
        '#add-todo'
    ];

    let buttonClicked = false;
    for (const selector of buttonSelectors) {
        try {
            const button = await page.waitForSelector(selector, { timeout: 3000 });
            if (button) {
                await button.click();
                buttonClicked = true;
                console.log(`Clicked add button: ${selector}`);
                break;
            }
        } catch (error) {
            // Try next button
        }
    }

    if (!buttonClicked) {
        // Try pressing Enter as fallback
        await inputElement.press('Enter');
        console.log('Pressed Enter to add todo');
    }

    // Wait for the item to appear
    await page.waitForTimeout(2000);
}

async function markTodoComplete(page: Page, text: string): Promise<void> {
    // Find the todo item and look for completion mechanisms
    const todoItem = page.locator('text=' + text);

    // Try different ways to mark complete
    const completionSelectors = [
        `//text()[contains(., "${text}")]/ancestor::*//input[@type="checkbox"]`,
        `//text()[contains(., "${text}")]/ancestor::*//*[contains(@class, "checkbox")]`,
        `//text()[contains(., "${text}")]/ancestor::*//*[contains(@class, "complete")]`,
        `//text()[contains(., "${text}")]/following-sibling::*//input[@type="checkbox"]`,
        `//text()[contains(., "${text}")]/preceding-sibling::*//input[@type="checkbox"]`
    ];

    for (const selector of completionSelectors) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 3000 });
            if (element) {
                await element.click();
                console.log(`Marked complete using: ${selector}`);
                return;
            }
        } catch (error) {
            // Try next selector
        }
    }

    // Fallback: try clicking on the todo item itself
    try {
        await todoItem.click();
        console.log('Clicked on todo item to mark complete');
    } catch (error) {
        throw new Error(`Could not find way to mark todo complete: ${text}`);
    }
}

async function deleteTodoItem(page: Page, text: string): Promise<void> {
    // Try different ways to delete
    const deleteSelectors = [
        `//text()[contains(., "${text}")]/ancestor::*//button[contains(text(), "Delete")]`,
        `//text()[contains(., "${text}")]/ancestor::*//button[contains(text(), "Remove")]`,
        `//text()[contains(., "${text}")]/ancestor::*//button[contains(text(), "×")]`,
        `//text()[contains(., "${text}")]/ancestor::*//*[contains(@class, "delete")]`,
        `//text()[contains(., "${text}")]/ancestor::*//*[contains(@class, "remove")]`,
        `//text()[contains(., "${text}")]/following-sibling::*//button`,
        `//text()[contains(., "${text}")]/ancestor::*//input[@type="button" and contains(@value, "Delete")]`
    ];

    for (const selector of deleteSelectors) {
        try {
            const element = await page.waitForSelector(selector, { timeout: 3000 });
            if (element) {
                await element.click();
                console.log(`Deleted using: ${selector}`);
                return;
            }
        } catch (error) {
            // Try next selector
        }
    }

    throw new Error(`Could not find way to delete todo: ${text}`);
}

async function checkForCompletionIndicators(page: Page, text: string): Promise<boolean> {
    // Check for various completion indicators
    const indicators = [
        `//text()[contains(., "${text}")]/ancestor::*[contains(@class, "completed")]`,
        `//text()[contains(., "${text}")]/ancestor::*[contains(@class, "done")]`,
        `//text()[contains(., "${text}")]/ancestor::*[contains(@style, "line-through")]`,
        `//text()[contains(., "${text}")]/ancestor::*//input[@type="checkbox" and @checked]`,
        `//text()[contains(., "${text}")]/*[contains(@style, "line-through")]`
    ];

    for (const indicator of indicators) {
        try {
            const element = await page.waitForSelector(indicator, { timeout: 1000 });
            if (element) {
                console.log(`Found completion indicator: ${indicator}`);
                return true;
            }
        } catch (error) {
            // Try next indicator
        }
    }

    return false;
}

async function cleanupServices(): Promise<void> {
    console.log('🛑 Stopping services...');

    const processes = [
        { name: 'NextJS', process: testEnv.nextjsProcess },
        { name: 'WebSocket Bridge', process: testEnv.websocketProcess },
        { name: 'Anvil Server', process: testEnv.anvilProcess }
    ];

    for (const { name, process } of processes) {
        if (process && !process.killed) {
            console.log(`Stopping ${name}...`);
            process.kill('SIGTERM');

            // Give it time to gracefully shutdown
            await new Promise(resolve => setTimeout(resolve, 2000));

            if (!process.killed) {
                process.kill('SIGKILL');
            }
        }
    }

    // Kill any remaining processes on our ports
    try {
        await execAsync('pkill -f "anvil-app-server" || true');
        await execAsync('pkill -f "websocket-server" || true');
        await execAsync('pkill -f "npm.*dev" || true');
    } catch (error) {
        // Ignore errors from pkill
    }

    console.log('✅ Services stopped');
}

async function cleanupDemoApp(): Promise<void> {
    try {
        const appPath = path.join(testEnv.appDirectory, testEnv.demoAppName);
        await fs.rm(appPath, { recursive: true, force: true });
        console.log('✅ Demo app cleaned up');
    } catch (error) {
        // Ignore cleanup errors
        console.log('⚠️ Demo app cleanup skipped (may not exist)');
    }
} 