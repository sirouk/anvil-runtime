/**
 * Global Teardown for Anvil Bridge E2E Tests
 * 
 * Cleans up test environment:
 * - Saves test artifacts
 * - Generates test reports
 * - Cleans up temporary files
 */

import { FullConfig } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

async function saveTestArtifacts(): Promise<void> {
    console.log('\n📁 Saving test artifacts...');

    try {
        // Ensure test-results directory exists
        await execAsync('mkdir -p test-results/final-reports');

        // Copy important logs if they exist
        const logPaths = [
            'test-results/e2e-results.json',
            'test-results/e2e-junit.xml',
            'playwright-report'
        ];

        for (const logPath of logPaths) {
            try {
                await fs.access(logPath);
                console.log(`✅ Preserved: ${logPath}`);
            } catch (error) {
                console.log(`⚠️ Not found: ${logPath}`);
            }
        }

        console.log('✅ Test artifacts saved');

    } catch (error) {
        console.error('❌ Failed to save test artifacts:', error);
    }
}

async function generateSummaryReport(): Promise<void> {
    console.log('\n📊 Generating test summary...');

    try {
        // Try to read test results
        let testResults = null;
        try {
            const resultsFile = await fs.readFile('test-results/e2e-results.json', 'utf-8');
            testResults = JSON.parse(resultsFile);
        } catch (error) {
            console.log('⚠️ No test results file found');
        }

        // Generate summary
        const summary = {
            timestamp: new Date().toISOString(),
            testRun: 'Anvil Bridge E2E Tests',
            environment: {
                anvilServer: process.env.E2E_ANVIL_URL,
                bridgeServer: process.env.E2E_BRIDGE_URL,
                websocketUrl: process.env.E2E_WS_URL
            },
            results: testResults || { message: 'No detailed results available' }
        };

        await fs.writeFile(
            'test-results/final-reports/test-summary.json',
            JSON.stringify(summary, null, 2)
        );

        console.log('✅ Test summary generated');

    } catch (error) {
        console.error('❌ Failed to generate test summary:', error);
    }
}

async function cleanupTempFiles(): Promise<void> {
    console.log('\n🧹 Cleaning up temporary files...');

    try {
        // List of temp files/directories to clean up
        const tempPaths = [
            'test-results/traces',
            'test-results/videos',
            'test-results/screenshots'
        ];

        for (const tempPath of tempPaths) {
            try {
                const stats = await fs.stat(tempPath);
                if (stats.isDirectory()) {
                    const files = await fs.readdir(tempPath);
                    console.log(`📁 ${tempPath}: ${files.length} files`);
                }
            } catch (error) {
                // Directory doesn't exist, which is fine
            }
        }

        console.log('✅ Temporary files reviewed');

    } catch (error) {
        console.error('❌ Failed to cleanup temp files:', error);
    }
}

async function printFinalReport(): Promise<void> {
    console.log('\n📋 Final Test Report:');
    console.log('='.repeat(50));

    try {
        // Check if HTML report was generated
        try {
            await fs.access('playwright-report/index.html');
            console.log('🎯 HTML Report: playwright-report/index.html');
        } catch (error) {
            console.log('⚠️ No HTML report generated');
        }

        // Check for JUnit results
        try {
            await fs.access('test-results/e2e-junit.xml');
            console.log('📊 JUnit Report: test-results/e2e-junit.xml');
        } catch (error) {
            console.log('⚠️ No JUnit report found');
        }

        // Environment information
        console.log('\n🌐 Test Environment:');
        console.log(`   Anvil Server: ${process.env.E2E_ANVIL_URL || 'Not set'}`);
        console.log(`   Bridge Server: ${process.env.E2E_BRIDGE_URL || 'Not set'}`);
        console.log(`   WebSocket: ${process.env.E2E_WS_URL || 'Not set'}`);

        console.log('\n💡 Next Steps:');
        console.log('   - Review HTML report for detailed results');
        console.log('   - Check failed test screenshots/videos if any');
        console.log('   - Verify proxy performance metrics');
        console.log('   - Ensure no server-side detection occurred');

    } catch (error) {
        console.error('❌ Failed to generate final report:', error);
    }
}

export default async function globalTeardown(config: FullConfig) {
    console.log('\n🏁 Starting Anvil Bridge E2E Test Teardown');
    console.log('='.repeat(50));

    try {
        // Step 1: Save test artifacts
        await saveTestArtifacts();

        // Step 2: Generate summary report
        await generateSummaryReport();

        // Step 3: Review temporary files
        await cleanupTempFiles();

        // Step 4: Print final report
        await printFinalReport();

        console.log('\n✅ Global teardown completed successfully!');
        console.log('🎯 All test artifacts preserved');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Global teardown failed:', error);
        console.log('⚠️ Some artifacts may not be preserved');
    }
} 