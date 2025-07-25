import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';

/**
 * Theme Asset Server
 * 
 * Serves theme assets (CSS, images, etc.) from the Anvil app's theme directory.
 * This allows the NextJS app to load the exact Anvil styles.
 * 
 * Usage: /api/theme/theme.css → serves anvil-testing/APP_NAME/theme/assets/theme.css
 */

export async function GET(
    request: NextRequest,
    { params }: { params: { path: string[] } }
) {
    try {
        // Get the requested asset path
        const assetPath = params.path.join('/');

        // Security: prevent directory traversal
        if (assetPath.includes('..')) {
            return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
        }

        // Find the first app in anvil-testing
        const anvilTestingPath = path.join(process.cwd(), '..', 'anvil-testing');
        const apps = await fs.readdir(anvilTestingPath);

        if (apps.length === 0) {
            return NextResponse.json({ error: 'No Anvil app found' }, { status: 404 });
        }

        // Use the first app found
        const appName = apps[0];
        const fullPath = path.join(anvilTestingPath, appName, 'theme', 'assets', assetPath);

        // Check if file exists
        try {
            await fs.access(fullPath);
        } catch {
            return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
        }

        // Read the file
        const content = await fs.readFile(fullPath);

        // Determine content type
        let contentType = 'application/octet-stream';
        if (assetPath.endsWith('.css')) {
            contentType = 'text/css';
        } else if (assetPath.endsWith('.js')) {
            contentType = 'application/javascript';
        } else if (assetPath.endsWith('.png')) {
            contentType = 'image/png';
        } else if (assetPath.endsWith('.jpg') || assetPath.endsWith('.jpeg')) {
            contentType = 'image/jpeg';
        } else if (assetPath.endsWith('.svg')) {
            contentType = 'image/svg+xml';
        } else if (assetPath.endsWith('.html')) {
            contentType = 'text/html';
        }

        // Return the file with appropriate headers
        return new NextResponse(content, {
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
            },
        });

    } catch (error) {
        console.error('Error serving theme asset:', error);
        return NextResponse.json(
            { error: 'Failed to serve theme asset' },
            { status: 500 }
        );
    }
} 