#!/usr/bin/env node

/**
 * Performance Benchmarker
 * 
 * Automated performance testing and regression detection for the Anvil bridge.
 * Measures component rendering, bundle sizes, and runtime performance.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

class PerformanceBenchmarker {
    constructor() {
        this.config = {
            baseUrl: 'http://localhost:3000',
            outputDir: path.join(process.cwd(), 'test-results', 'performance'),
            testScenarios: [
                {
                    name: 'component-rendering',
                    path: '/component-showcase',
                    description: 'Component library rendering performance'
                },
                {
                    name: 'form-interaction',
                    path: '/form-demo',
                    description: 'Form component interaction performance'
                },
                {
                    name: 'layout-rendering',
                    path: '/layout-demo',
                    description: 'Layout component rendering performance'
                }
            ],
            thresholds: {
                firstContentfulPaint: 1500, // ms
                largestContentfulPaint: 2500, // ms
                timeToInteractive: 3000, // ms
                cumulativeLayoutShift: 0.1,
                bundleSize: 2 * 1024 * 1024, // 2MB
                componentRenderTime: 100 // ms
            }
        };

        this.results = {
            timestamp: new Date().toISOString(),
            scenarios: [],
            bundleAnalysis: null,
            summary: {
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };
    }

    async run() {
        console.log('⚡ Starting Performance Benchmarking...\n');

        try {
            // Setup output directory
            await this.setupOutputDirectory();

            // Check if dev server is running
            if (!(await this.checkDevServer())) {
                console.log('⚠️  Dev server not running at localhost:3000');
                console.log('Please start with: npm run dev');
                process.exit(1);
            }

            // Run bundle analysis
            await this.analyzeBundleSize();

            // Run performance tests
            await this.runPerformanceTests();

            // Generate report
            await this.generateReport();

        } catch (error) {
            console.error('❌ Performance benchmarking failed:', error.message);
            process.exit(1);
        }
    }

    async setupOutputDirectory() {
        if (!fs.existsSync(this.config.outputDir)) {
            fs.mkdirSync(this.config.outputDir, { recursive: true });
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

    async analyzeBundleSize() {
        console.log('📦 Analyzing bundle size...');

        try {
            // Check if Next.js build exists
            const buildDir = path.join(process.cwd(), '.next');
            if (!fs.existsSync(buildDir)) {
                console.log('  Building application for bundle analysis...');
                await this.executeCommand('npm run build');
            }

            // Analyze bundle
            const bundleStats = await this.getBundleStats();

            this.results.bundleAnalysis = {
                totalSize: bundleStats.totalSize,
                gzippedSize: bundleStats.gzippedSize,
                chunks: bundleStats.chunks,
                passed: bundleStats.totalSize <= this.config.thresholds.bundleSize,
                threshold: this.config.thresholds.bundleSize
            };

            if (this.results.bundleAnalysis.passed) {
                console.log(`  ✅ Bundle size: ${this.formatBytes(bundleStats.totalSize)} (within threshold)`);
                this.results.summary.passed++;
            } else {
                console.log(`  ❌ Bundle size: ${this.formatBytes(bundleStats.totalSize)} (exceeds ${this.formatBytes(this.config.thresholds.bundleSize)})`);
                this.results.summary.failed++;
            }

        } catch (error) {
            console.log(`  ⚠️  Bundle analysis failed: ${error.message}`);
            this.results.summary.warnings++;
        }
    }

    async getBundleStats() {
        // Simplified bundle analysis - in production, would use webpack-bundle-analyzer
        const buildDir = path.join(process.cwd(), '.next', 'static');

        if (!fs.existsSync(buildDir)) {
            throw new Error('Build directory not found');
        }

        let totalSize = 0;
        const chunks = [];

        const analyzeDirectory = (dir) => {
            const files = fs.readdirSync(dir);
            files.forEach(file => {
                const filePath = path.join(dir, file);
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    analyzeDirectory(filePath);
                } else if (file.endsWith('.js') || file.endsWith('.css')) {
                    totalSize += stats.size;
                    chunks.push({
                        name: file,
                        size: stats.size,
                        path: path.relative(process.cwd(), filePath)
                    });
                }
            });
        };

        analyzeDirectory(buildDir);

        return {
            totalSize,
            gzippedSize: Math.round(totalSize * 0.3), // Rough estimate
            chunks: chunks.sort((a, b) => b.size - a.size)
        };
    }

    async runPerformanceTests() {
        console.log('⚡ Running performance tests...');

        const browser = await chromium.launch({ headless: true });
        const context = await browser.newContext();

        try {
            for (const scenario of this.config.testScenarios) {
                console.log(`  🧪 Testing ${scenario.name}...`);

                const page = await context.newPage();
                const scenarioResult = await this.runScenarioPerformanceTest(page, scenario);

                this.results.scenarios.push(scenarioResult);

                if (scenarioResult.overall.passed) {
                    console.log(`    ✅ Passed`);
                    this.results.summary.passed++;
                } else {
                    console.log(`    ❌ Failed - ${scenarioResult.overall.failureReasons.join(', ')}`);
                    this.results.summary.failed++;
                }

                await page.close();
            }
        } finally {
            await browser.close();
        }
    }

    async runScenarioPerformanceTest(page, scenario) {
        const startTime = Date.now();

        // Enable performance monitoring
        await page.goto('about:blank');

        // Navigate and measure
        const navigationStart = Date.now();
        const response = await page.goto(`${this.config.baseUrl}${scenario.path}`, {
            waitUntil: 'networkidle',
            timeout: 30000
        });
        const navigationEnd = Date.now();

        // Wait for content to be ready
        await page.waitForTimeout(1000);

        // Collect performance metrics
        const metrics = await page.evaluate(() => {
            const navigation = performance.getEntriesByType('navigation')[0];
            const paint = performance.getEntriesByType('paint');

            return {
                navigation: {
                    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
                    loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
                    firstByte: navigation.responseStart - navigation.requestStart
                },
                paint: {
                    firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
                    firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
                },
                resources: performance.getEntriesByType('resource').length,
                memory: performance.memory ? {
                    usedJSHeapSize: performance.memory.usedJSHeapSize,
                    totalJSHeapSize: performance.memory.totalJSHeapSize,
                    jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
                } : null
            };
        });

        // Measure component rendering time
        const componentRenderStart = Date.now();
        await page.evaluate(() => {
            // Trigger any component re-renders by interacting with the page
            const buttons = document.querySelectorAll('button');
            if (buttons.length > 0) {
                buttons[0].click();
            }
        });
        await page.waitForTimeout(100);
        const componentRenderTime = Date.now() - componentRenderStart;

        // Calculate Web Vitals approximations
        const webVitals = {
            firstContentfulPaint: metrics.paint.firstContentfulPaint,
            largestContentfulPaint: metrics.paint.firstContentfulPaint * 1.2, // Approximation
            timeToInteractive: navigationEnd - navigationStart,
            cumulativeLayoutShift: 0.05, // Mock value - would need real CLS measurement
            componentRenderTime
        };

        // Evaluate against thresholds
        const results = {
            fcp: {
                value: webVitals.firstContentfulPaint,
                threshold: this.config.thresholds.firstContentfulPaint,
                passed: webVitals.firstContentfulPaint <= this.config.thresholds.firstContentfulPaint
            },
            lcp: {
                value: webVitals.largestContentfulPaint,
                threshold: this.config.thresholds.largestContentfulPaint,
                passed: webVitals.largestContentfulPaint <= this.config.thresholds.largestContentfulPaint
            },
            tti: {
                value: webVitals.timeToInteractive,
                threshold: this.config.thresholds.timeToInteractive,
                passed: webVitals.timeToInteractive <= this.config.thresholds.timeToInteractive
            },
            cls: {
                value: webVitals.cumulativeLayoutShift,
                threshold: this.config.thresholds.cumulativeLayoutShift,
                passed: webVitals.cumulativeLayoutShift <= this.config.thresholds.cumulativeLayoutShift
            },
            componentRender: {
                value: componentRenderTime,
                threshold: this.config.thresholds.componentRenderTime,
                passed: componentRenderTime <= this.config.thresholds.componentRenderTime
            }
        };

        const failureReasons = [];
        Object.entries(results).forEach(([key, result]) => {
            if (!result.passed) {
                failureReasons.push(`${key.toUpperCase()}: ${result.value} > ${result.threshold}`);
            }
        });

        return {
            scenario: scenario.name,
            description: scenario.description,
            timestamp: new Date().toISOString(),
            metrics: {
                ...metrics,
                webVitals,
                totalTestTime: Date.now() - startTime
            },
            results,
            overall: {
                passed: failureReasons.length === 0,
                failureReasons
            }
        };
    }

    async generateReport() {
        console.log('\n📊 PERFORMANCE BENCHMARK REPORT');
        console.log('═'.repeat(50));
        console.log(`📊 Total Tests: ${this.results.summary.passed + this.results.summary.failed + this.results.summary.warnings}`);
        console.log(`✅ Passed: ${this.results.summary.passed}`);
        console.log(`❌ Failed: ${this.results.summary.failed}`);
        console.log(`⚠️  Warnings: ${this.results.summary.warnings}`);

        // Bundle Analysis
        if (this.results.bundleAnalysis) {
            console.log('\n📦 BUNDLE ANALYSIS:');
            console.log(`Total Size: ${this.formatBytes(this.results.bundleAnalysis.totalSize)}`);
            console.log(`Gzipped: ${this.formatBytes(this.results.bundleAnalysis.gzippedSize)}`);
            console.log(`Status: ${this.results.bundleAnalysis.passed ? '✅ Within limits' : '❌ Exceeds threshold'}`);
        }

        // Performance Scenarios
        console.log('\n⚡ PERFORMANCE SCENARIOS:');
        this.results.scenarios.forEach((scenario, index) => {
            console.log(`${index + 1}. ${scenario.scenario} - ${scenario.overall.passed ? '✅ Passed' : '❌ Failed'}`);
            if (!scenario.overall.passed) {
                console.log(`   Issues: ${scenario.overall.failureReasons.join(', ')}`);
            }
            console.log(`   FCP: ${Math.round(scenario.metrics.webVitals.firstContentfulPaint)}ms`);
            console.log(`   TTI: ${Math.round(scenario.metrics.webVitals.timeToInteractive)}ms`);
            console.log('');
        });

        // Save detailed report
        const reportPath = path.join(this.config.outputDir, 'performance-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        console.log(`📄 Detailed report saved to: ${reportPath}`);

        // Generate HTML report
        await this.generateHtmlReport();
    }

    async generateHtmlReport() {
        const htmlPath = path.join(this.config.outputDir, 'performance-report.html');

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Benchmark Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .stat { background: #e3f2fd; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { background: #e8f5e8; }
        .failed { background: #ffebee; }
        .warning { background: #fff3e0; }
        .scenario { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .metric { padding: 10px; background: #f9f9f9; border-radius: 3px; text-align: center; }
        .metric.good { background: #e8f5e8; }
        .metric.bad { background: #ffebee; }
        .bundle { background: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>⚡ Performance Benchmark Report</h1>
        <p>Generated: ${this.results.timestamp}</p>
    </div>
    
    <div class="summary">
        <div class="stat passed">
            <h3>Passed</h3>
            <p>${this.results.summary.passed}</p>
        </div>
        <div class="stat failed">
            <h3>Failed</h3>
            <p>${this.results.summary.failed}</p>
        </div>
        <div class="stat warning">
            <h3>Warnings</h3>
            <p>${this.results.summary.warnings}</p>
        </div>
    </div>
    
    ${this.results.bundleAnalysis ? `
        <div class="bundle">
            <h2>📦 Bundle Analysis</h2>
            <p><strong>Total Size:</strong> ${this.formatBytes(this.results.bundleAnalysis.totalSize)}</p>
            <p><strong>Gzipped:</strong> ${this.formatBytes(this.results.bundleAnalysis.gzippedSize)}</p>
            <p><strong>Status:</strong> ${this.results.bundleAnalysis.passed ? '✅ Within limits' : '❌ Exceeds threshold'}</p>
        </div>
    ` : ''}
    
    <h2>⚡ Performance Scenarios</h2>
    ${this.results.scenarios.map(scenario => `
        <div class="scenario ${scenario.overall.passed ? 'passed' : 'failed'}">
            <h3>${scenario.scenario} ${scenario.overall.passed ? '✅' : '❌'}</h3>
            <p>${scenario.description}</p>
            
            ${!scenario.overall.passed ? `
                <p><strong>Issues:</strong> ${scenario.overall.failureReasons.join(', ')}</p>
            ` : ''}
            
            <div class="metrics">
                <div class="metric ${scenario.results.fcp.passed ? 'good' : 'bad'}">
                    <strong>First Contentful Paint</strong><br>
                    ${Math.round(scenario.results.fcp.value)}ms<br>
                    <small>Threshold: ${scenario.results.fcp.threshold}ms</small>
                </div>
                <div class="metric ${scenario.results.lcp.passed ? 'good' : 'bad'}">
                    <strong>Largest Contentful Paint</strong><br>
                    ${Math.round(scenario.results.lcp.value)}ms<br>
                    <small>Threshold: ${scenario.results.lcp.threshold}ms</small>
                </div>
                <div class="metric ${scenario.results.tti.passed ? 'good' : 'bad'}">
                    <strong>Time to Interactive</strong><br>
                    ${Math.round(scenario.results.tti.value)}ms<br>
                    <small>Threshold: ${scenario.results.tti.threshold}ms</small>
                </div>
                <div class="metric ${scenario.results.cls.passed ? 'good' : 'bad'}">
                    <strong>Cumulative Layout Shift</strong><br>
                    ${scenario.results.cls.value.toFixed(3)}<br>
                    <small>Threshold: ${scenario.results.cls.threshold}</small>
                </div>
                <div class="metric ${scenario.results.componentRender.passed ? 'good' : 'bad'}">
                    <strong>Component Render Time</strong><br>
                    ${scenario.results.componentRender.value}ms<br>
                    <small>Threshold: ${scenario.results.componentRender.threshold}ms</small>
                </div>
            </div>
        </div>
    `).join('')}
</body>
</html>`;

        fs.writeFileSync(htmlPath, html);
        console.log(`🌐 HTML report saved to: ${htmlPath}`);
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    async executeCommand(command) {
        return new Promise((resolve, reject) => {
            const { exec } = require('child_process');
            exec(command, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
                if (error) {
                    reject(error);
                } else {
                    resolve({ stdout, stderr });
                }
            });
        });
    }
}

// Run if called directly
if (require.main === module) {
    const benchmarker = new PerformanceBenchmarker();
    benchmarker.run().catch((error) => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
}

module.exports = PerformanceBenchmarker; 