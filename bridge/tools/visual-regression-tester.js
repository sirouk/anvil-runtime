#!/usr/bin/env node

/**
 * Visual Regression Tester
 * 
 * Automated visual testing for React components and full application views.
 * Uses Playwright to capture screenshots and detect visual changes.
 */

const { chromium, firefox, webkit } = require('playwright');
const fs = require('fs');
const path = require('path');

class VisualRegressionTester {
    constructor() {
        this.config = {
            baseUrl: 'http://localhost:3000',
            outputDir: path.join(process.cwd(), 'test-results', 'visual-tests'),
            browsers: ['chromium'], // Can extend to ['chromium', 'firefox', 'webkit']
            viewports: [
                { width: 1920, height: 1080, name: 'desktop' },
                { width: 768, height: 1024, name: 'tablet' },
                { width: 375, height: 667, name: 'mobile' }
            ],
            testScenarios: [
                {
                    name: 'component-showcase',
                    path: '/component-showcase',
                    description: 'Component library showcase page'
                },
                {
                    name: 'form-components',
                    path: '/form-demo',
                    description: 'Form components demo'
                },
                {
                    name: 'layout-components',
                    path: '/layout-demo',
                    description: 'Layout components demo'
                },
                {
                    name: 'display-media-components',
                    path: '/display-media-demo',
                    description: 'Display and media components demo'
                }
            ]
        };

        this.results = {
            passed: 0,
            failed: 0,
            total: 0,
            screenshots: [],
            differences: []
        };
    }

    async run() {
        console.log('📸 Starting Visual Regression Testing...\n');

        try {
            // Setup output directory
            await this.setupOutputDirectory();

            // Check if dev server is running
            if (!(await this.checkDevServer())) {
                console.log('⚠️  Dev server not running at localhost:3000');
                console.log('Please start with: npm run dev');
                process.exit(1);
            }

            // Run tests for each browser
            for (const browserName of this.config.browsers) {
                await this.runBrowserTests(browserName);
            }

            // Generate report
            await this.generateReport();

        } catch (error) {
            console.error('❌ Visual testing failed:', error.message);
            process.exit(1);
        }
    }

    async setupOutputDirectory() {
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
        }

        // Create subdirectories for different test types
        const subdirs = ['current', 'baseline', 'diff'];
        for (const subdir of subdirs) {
            const dirPath = path.join(this.config.outputDir, subdir);
            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }
        }
    }

    async checkDevServer() {
        try {
            const response = await fetch(this.config.baseUrl);
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async runBrowserTests(browserName) {
        console.log(`🌐 Testing in ${browserName}...`);

        const browser = await this.launchBrowser(browserName);

        try {
            for (const viewport of this.config.viewports) {
                console.log(`  📱 Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);

                const context = await browser.newContext({
                    viewport: { width: viewport.width, height: viewport.height }
                });

                const page = await context.newPage();

                for (const scenario of this.config.testScenarios) {
                    await this.runScenarioTest(page, scenario, browserName, viewport);
                }

                await context.close();
            }
        } finally {
            await browser.close();
        }
    }

    async launchBrowser(browserName) {
        const browsers = { chromium, firefox, webkit };
        return await browsers[browserName].launch({
            headless: true,
            args: ['--disable-web-security', '--disable-features=VizDisplayCompositor']
        });
    }

    async runScenarioTest(page, scenario, browserName, viewport) {
        const testName = `${scenario.name}-${browserName}-${viewport.name}`;

        try {
            console.log(`    🧪 Testing ${scenario.name}...`);

            // Navigate to the page
            await page.goto(`${this.config.baseUrl}${scenario.path}`, {
                waitUntil: 'networkidle',
                timeout: 30000
            });

            // Wait for any animations or dynamic content
            await page.waitForTimeout(1000);

            // Hide any dynamic elements that might cause false positives
            await this.hideDynamicElements(page);

            // Take screenshot
            const screenshotPath = path.join(
                this.config.outputDir,
                'current',
                `${testName}.png`
            );

            await page.screenshot({
                path: screenshotPath,
                fullPage: true,
                animations: 'disabled'
            });

            // Compare with baseline if it exists
            const comparisonResult = await this.compareWithBaseline(testName, screenshotPath);

            this.results.total++;
            if (comparisonResult.passed) {
                this.results.passed++;
                console.log(`      ✅ Passed`);
            } else {
                this.results.failed++;
                console.log(`      ❌ Failed - ${comparisonResult.reason}`);
                this.results.differences.push({
                    testName,
                    scenario: scenario.description,
                    browser: browserName,
                    viewport: viewport.name,
                    reason: comparisonResult.reason,
                    screenshotPath
                });
            }

            this.results.screenshots.push({
                testName,
                scenario: scenario.description,
                browser: browserName,
                viewport: viewport.name,
                path: screenshotPath,
                passed: comparisonResult.passed
            });

        } catch (error) {
            console.log(`      ❌ Error: ${error.message}`);
            this.results.total++;
            this.results.failed++;
        }
    }

    async hideDynamicElements(page) {
        // Hide elements that change frequently and cause false positives
        await page.evaluate(() => {
            // Hide timestamps, random IDs, etc.
            const selectors = [
                '[data-testid="timestamp"]',
                '[class*="timestamp"]',
                '[id*="random"]',
                '.loading-spinner'
            ];

            selectors.forEach(selector => {
                const elements = document.querySelectorAll(selector);
                elements.forEach(el => el.style.visibility = 'hidden');
            });

            // Replace any random text content
            const textNodes = document.evaluate(
                '//text()[contains(., "random") or contains(., "uuid")]',
                document,
                null,
                XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE,
                null
            );

            for (let i = 0; i < textNodes.snapshotLength; i++) {
                const node = textNodes.snapshotItem(i);
                if (node.nodeValue.includes('random') || node.nodeValue.includes('uuid')) {
                    node.nodeValue = 'STATIC_PLACEHOLDER';
                }
            }
        });
    }

    async compareWithBaseline(testName, currentPath) {
        const baselinePath = path.join(this.config.outputDir, 'baseline', `${testName}.png`);

        // If no baseline exists, create one
        if (!fs.existsSync(baselinePath)) {
            fs.copyFileSync(currentPath, baselinePath);
            return { passed: true, reason: 'New baseline created' };
        }

        // Compare using simple file size check (can be enhanced with pixel comparison)
        const currentStats = fs.statSync(currentPath);
        const baselineStats = fs.statSync(baselinePath);

        const sizeDifference = Math.abs(currentStats.size - baselineStats.size);
        const toleranceBytes = baselineStats.size * 0.05; // 5% tolerance

        if (sizeDifference <= toleranceBytes) {
            return { passed: true, reason: 'Screenshots match within tolerance' };
        } else {
            // Create diff visualization (simplified)
            const diffPath = path.join(this.config.outputDir, 'diff', `${testName}-diff.txt`);
            fs.writeFileSync(diffPath,
                `Baseline size: ${baselineStats.size} bytes\n` +
                `Current size: ${currentStats.size} bytes\n` +
                `Difference: ${sizeDifference} bytes\n` +
                `Tolerance: ${toleranceBytes} bytes\n`
            );

            return {
                passed: false,
                reason: `Size difference exceeds tolerance (${sizeDifference} > ${toleranceBytes} bytes)`
            };
        }
    }

    async generateReport() {
        console.log('\n📊 VISUAL REGRESSION TEST REPORT');
        console.log('═'.repeat(50));
        console.log(`📊 Total Tests: ${this.results.total}`);
        console.log(`✅ Passed: ${this.results.passed}`);
        console.log(`❌ Failed: ${this.results.failed}`);
        console.log(`📈 Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

        if (this.results.differences.length > 0) {
            console.log('\n🔍 VISUAL DIFFERENCES DETECTED:');
            this.results.differences.forEach((diff, index) => {
                console.log(`${index + 1}. ${diff.testName}`);
                console.log(`   Scenario: ${diff.scenario}`);
                console.log(`   Browser: ${diff.browser} | Viewport: ${diff.viewport}`);
                console.log(`   Reason: ${diff.reason}`);
                console.log(`   Screenshot: ${diff.screenshotPath}`);
                console.log('');
            });
        }

        // Save detailed report
        const reportPath = path.join(this.config.outputDir, 'visual-test-report.json');
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total: this.results.total,
                passed: this.results.passed,
                failed: this.results.failed,
                successRate: (this.results.passed / this.results.total) * 100
            },
            screenshots: this.results.screenshots,
            differences: this.results.differences,
            config: this.config
        };

        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);

        // Generate HTML report
        await this.generateHtmlReport(report);
    }

    async generateHtmlReport(report) {
        const htmlPath = path.join(this.config.outputDir, 'visual-test-report.html');

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Visual Regression Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: #e3f2fd; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { background: #e8f5e8; }
        .failed { background: #ffebee; }
        .screenshot { margin: 10px 0; padding: 10px; border: 1px solid #ddd; }
        .diff { background: #fff3e0; }
        img { max-width: 300px; height: auto; border: 1px solid #ccc; }
    </style>
</head>
<body>
    <div class="header">
        <h1>📸 Visual Regression Test Report</h1>
        <p>Generated: ${report.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="stat">
            <h3>Total Tests</h3>
            <p>${report.summary.total}</p>
        </div>
        <div class="stat passed">
            <h3>Passed</h3>
            <p>${report.summary.passed}</p>
        </div>
        <div class="stat failed">
            <h3>Failed</h3>
            <p>${report.summary.failed}</p>
        </div>
        <div class="stat">
            <h3>Success Rate</h3>
            <p>${report.summary.successRate.toFixed(1)}%</p>
        </div>
    </div>
    
    <h2>🖼️ Screenshots</h2>
    ${report.screenshots.map(screenshot => `
        <div class="screenshot ${screenshot.passed ? 'passed' : 'failed diff'}">
            <h4>${screenshot.testName}</h4>
            <p><strong>Scenario:</strong> ${screenshot.scenario}</p>
            <p><strong>Browser:</strong> ${screenshot.browser} | <strong>Viewport:</strong> ${screenshot.viewport}</p>
            <p><strong>Status:</strong> ${screenshot.passed ? '✅ Passed' : '❌ Failed'}</p>
            <img src="${path.relative(this.config.outputDir, screenshot.path)}" alt="${screenshot.testName}">
        </div>
    `).join('')}
    
    ${report.differences.length > 0 ? `
        <h2>🔍 Visual Differences</h2>
        ${report.differences.map(diff => `
            <div class="screenshot diff">
                <h4>${diff.testName}</h4>
                <p><strong>Reason:</strong> ${diff.reason}</p>
                <p><strong>Scenario:</strong> ${diff.scenario}</p>
                <p><strong>Browser:</strong> ${diff.browser} | <strong>Viewport:</strong> ${diff.viewport}</p>
            </div>
        `).join('')}
    ` : ''}
</body>
</html>`;

        fs.writeFileSync(htmlPath, html);
        console.log(`🌐 HTML report saved to: ${htmlPath}`);
    }
}

// Commands
const commands = {
    test: async () => {
        const tester = new VisualRegressionTester();
        await tester.run();
    },

    baseline: async () => {
        console.log('📸 Updating visual baselines...');
        const tester = new VisualRegressionTester();

        // Clear existing baselines
        const baselineDir = path.join(tester.config.outputDir, 'baseline');
        if (fs.existsSync(baselineDir)) {
            fs.rmSync(baselineDir, { recursive: true });
        }

        await tester.run();
        console.log('✅ Baselines updated successfully!');
    },

    help: () => {
        console.log('Visual Regression Testing Tool');
        console.log('');
        console.log('Commands:');
        console.log('  test     - Run visual regression tests');
        console.log('  baseline - Update baseline screenshots');
        console.log('  help     - Show this help message');
    }
};

// Run if called directly
if (require.main === module) {
    const command = process.argv[2] || 'test';

    if (commands[command]) {
        commands[command]().catch((error) => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
    } else {
        console.error(`Unknown command: ${command}`);
        commands.help();
        process.exit(1);
    }
}

module.exports = VisualRegressionTester; 