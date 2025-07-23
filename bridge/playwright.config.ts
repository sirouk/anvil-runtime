import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Anvil Bridge E2E Testing
 * 
 * Tests complete user workflows through the proxy to ensure:
 * - Full compatibility with Anvil applications
 * - Zero server-side detection of proxy
 * - Performance meets or exceeds native Anvil client
 */
export default defineConfig({
    testDir: './tests/e2e',

    /* Run tests in files in parallel */
    fullyParallel: true,

    /* Fail the build on CI if you accidentally left test.only in the source code. */
    forbidOnly: !!process.env.CI,

    /* Retry on CI only */
    retries: process.env.CI ? 2 : 0,

    /* Opt out of parallel tests on CI. */
    workers: process.env.CI ? 1 : undefined,

    /* Reporter to use. See https://playwright.dev/docs/test-reporters */
    reporter: [
        ['html'],
        ['json', { outputFile: 'test-results/e2e-results.json' }],
        ['junit', { outputFile: 'test-results/e2e-junit.xml' }]
    ],

    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        /* Base URL to use in actions like `await page.goto('/')`. */
        baseURL: 'http://localhost:3000',

        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry',

        /* Record video on failure */
        video: 'retain-on-failure',

        /* Take screenshot on failure */
        screenshot: 'only-on-failure',

        /* Timeout settings for Anvil app loading */
        actionTimeout: 30000,
        navigationTimeout: 30000
    },

    /* Configure projects for major browsers */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },

        {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
        },

        {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
        },

        /* Test against mobile viewports. */
        {
            name: 'Mobile Chrome',
            use: { ...devices['Pixel 5'] },
        },
        {
            name: 'Mobile Safari',
            use: { ...devices['iPhone 12'] },
        },

        /* Test against branded browsers. */
        {
            name: 'Microsoft Edge',
            use: { ...devices['Desktop Edge'], channel: 'msedge' },
        },
        {
            name: 'Google Chrome',
            use: { ...devices['Desktop Chrome'], channel: 'chrome' },
        },
    ],

    /* Global setup for starting servers */
    globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
    globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),

    /* Run your local dev server before starting the tests */
    webServer: [
        {
            command: 'npm run dev',
            url: 'http://localhost:3000',
            reuseExistingServer: !process.env.CI,
            timeout: 120 * 1000,
        }
    ],

    /* Anvil-specific test configuration */
    expect: {
        /* Maximum time expect() should wait for the condition to be met */
        timeout: 15000,

        /* Animation handling and visual comparisons */
        toHaveScreenshot: {
            animations: 'disabled',
            caret: 'hide',
            threshold: 0.3
        }
    },

    /* Output directories */
    outputDir: 'test-results/e2e-artifacts',

    /* Test timeout */
    timeout: 60 * 1000, // 60 seconds for complex Anvil workflows
}); 