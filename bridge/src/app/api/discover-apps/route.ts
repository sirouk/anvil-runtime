import { NextRequest, NextResponse } from 'next/server';
import { AppDiscoveryService } from '@/lib/app-loader/app-discovery';

/**
 * API endpoint for server-side Anvil app discovery
 * GET /api/discover-apps
 */
export async function GET(request: NextRequest) {
    try {
        console.log('🔍 API: Starting server-side app discovery...');

        // Perform discovery on server side
        const result = await AppDiscoveryService.discoverApps();

        console.log(`🔍 API: Found ${result.apps.length} apps, errors: ${result.errors.length}`);

        return NextResponse.json({
            success: true,
            result: {
                apps: result.apps.map(app => ({
                    name: app.name,
                    path: app.path,
                    config: app.config,
                    startupForm: app.startupForm,
                    formsCount: app.forms.size,
                    forms: Object.fromEntries(app.forms),
                    errors: app.errors
                })),
                errors: result.errors,
                primaryApp: result.primaryApp ? {
                    name: result.primaryApp.name,
                    path: result.primaryApp.path,
                    config: result.primaryApp.config,
                    startupForm: result.primaryApp.startupForm,
                    formsCount: result.primaryApp.forms.size,
                    forms: Object.fromEntries(result.primaryApp.forms),
                    errors: result.primaryApp.errors
                } : undefined
            }
        });

    } catch (error: any) {
        console.error('❌ API: App discovery failed:', error);

        return NextResponse.json({
            success: false,
            error: error.message || 'Failed to discover apps'
        }, { status: 500 });
    }
} 