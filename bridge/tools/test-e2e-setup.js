/**
 * Test E2E Setup Validation
 * 
 * Quick validation that the E2E testing infrastructure is working:
 * - Servers can be reached
 * - Basic proxy functionality works
 * - Test environment is properly configured
 */

const { chromium } = require('playwright');

async function validateSetup() {
    console.log('🧪 Validating E2E Test Setup...');
    console.log('='.repeat(50));

    let browser = null;
    let context = null;
    let page = null;

    try {
        // Step 1: Launch browser
        console.log('\n🌐 Launching browser...');
        browser = await chromium.launch({ headless: true });
        context = await browser.newContext();
        page = await context.newPage();

        // Step 2: Test bridge server
        console.log('\n🌉 Testing bridge server...');
        try {
            const response = await page.goto('http://localhost:3000', {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });

            if (response && response.ok()) {
                console.log('✅ Bridge server responding');
                const title = await page.title();
                console.log(`📄 Page title: ${title}`);
            } else {
                console.log('❌ Bridge server not responding properly');
            }
        } catch (error) {
            console.log(`❌ Bridge server error: ${error.message}`);
        }

        // Step 3: Test Anvil server
        console.log('\n🎯 Testing Anvil server...');
        try {
            const response = await page.goto('http://localhost:3030', {
                waitUntil: 'domcontentloaded',
                timeout: 10000
            });

            if (response && response.ok()) {
                console.log('✅ Anvil server responding');
                const title = await page.title();
                console.log(`📄 Page title: ${title}`);
            } else {
                console.log('❌ Anvil server not responding properly');
            }
        } catch (error) {
            console.log(`❌ Anvil server error: ${error.message}`);
        }

        // Step 4: Test proxy functionality
        console.log('\n🔄 Testing proxy functionality...');
        try {
            const response = await page.goto('http://localhost:3000/api/proxy/', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
            });

            if (response && response.ok()) {
                console.log('✅ Proxy endpoint responding');
                const content = await page.content();
                console.log(`📊 Content length: ${content.length} characters`);

                if (content.length > 1000) {
                    console.log('✅ Proxy returned substantial content');
                } else {
                    console.log('⚠️ Proxy returned minimal content');
                }
            } else {
                console.log('❌ Proxy endpoint not responding properly');
            }
        } catch (error) {
            console.log(`❌ Proxy error: ${error.message}`);
        }

        // Step 5: Test network monitoring
        console.log('\n📡 Testing network monitoring...');
        let requestCount = 0;

        page.on('request', req => {
            requestCount++;
            console.log(`📤 Request: ${req.method()} ${req.url()}`);
        });

        await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 });
        console.log(`📊 Captured ${requestCount} requests`);

        console.log('\n✅ E2E Setup Validation Complete!');

    } catch (error) {
        console.error('\n❌ E2E Setup Validation Failed:', error);
    } finally {
        if (page) await page.close();
        if (context) await context.close();
        if (browser) await browser.close();
    }
}

// Run validation
validateSetup().catch(console.error);

module.exports = validateSetup; 