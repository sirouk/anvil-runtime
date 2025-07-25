import { defineConfig } from '@playwright/test';

/**
 * Playwright Configuration for Docker-based Todo Demo Workflow Test
 * 
 * This configuration is specifically for the containerized todo workflow test
 * which manages its own services (Anvil server, NextJS, WebSocket bridge).
 * 
 * Key differences from main config:
 * - No global setup/teardown (test manages its own services)
 * - No webServer (test starts its own NextJS server)
 * - Focuses only on todo-demo-workflow.test.ts
 */
export default defineConfig({
    testDir: './tests/e2e',

    /* Run tests in files in parallel */
    fullyParallel: false,  // Sequential for service management

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    /* No retries in Docker for faster feedback */
    retries: 0,

    /* Single worker for Docker environment */
    workers: 1,

    /* Reporter to use */
    reporter: [
        ['line'],
        ['json', { outputFile: 'test-results/e2e-results.json' }],
    ],

    /* Test settings for Docker environment */
    use: {
        /* Base URL - not used since test manages its own server */
        // baseURL: 'http://localhost:3000',

        /* Collect trace when retrying the failed test */
        trace: 'on-first-retry',

        /* Record video on failure */
        video: 'retain-on-failure',

        /* Take screenshot on failure */
        screenshot: 'only-on-failure',

        /* Timeout settings optimized for Docker */
        actionTimeout: 30000,
        navigationTimeout: 60000
    },

    /* Configure projects for Docker testing */
    projects: [
        {
            name: 'chromium-docker',
            use: {
                ...require('@playwright/test').devices['Desktop Chrome'],
                // Docker-specific browser settings
                headless: true,
                screenshot: 'only-on-failure',
                video: 'retain-on-failure'
            },
        },
    ],

    /* NO global setup - the todo workflow test manages its own services */
    // globalSetup: undefined,
    // globalTeardown: undefined,

    /* NO webServer - the todo workflow test starts its own NextJS server */
    // webServer: undefined,

    /* Test-specific configuration */
    expect: {
        /* Maximum time expect() should wait for the condition to be met */
        timeout: 15000,

        /* Animation handling for Docker */
        toHaveScreenshot: {
            animations: 'disabled',
            caret: 'hide',
            threshold: 0.3
        }
    },

    /* Output directories */
    outputDir: 'test-results/e2e-artifacts',

    /* Extended timeout for complex workflows in Docker */
    timeout: 300 * 1000, // 5 minutes for complete workflow

    /* Only run the todo workflow test */
    testMatch: '**/todo-demo-workflow.test.ts'
}); 