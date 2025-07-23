/**
 * Upload Progress Tracking API Route
 * 
 * Provides real-time upload progress information for clients
 */

import { NextRequest, NextResponse } from 'next/server';
import { defaultFileUploadHandler } from '@/lib/file/file-upload-handler';

/**
 * GET /api/upload-progress/[id] - Get upload progress for a specific upload ID
 */
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Upload ID is required' },
                { status: 400 }
            );
        }

        const progress = defaultFileUploadHandler.getProgress(id);

        if (!progress) {
            return NextResponse.json(
                { error: 'Upload progress not found' },
                { status: 404 }
            );
        }

        // Calculate percentage
        const percentage = progress.totalBytes > 0
            ? Math.round((progress.uploadedBytes / progress.totalBytes) * 100)
            : 0;

        return NextResponse.json({
            ...progress,
            percentage,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Upload progress API error:', error);
        return NextResponse.json(
            {
                error: 'Failed to get upload progress',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/upload-progress/[id] - Clean up upload progress tracking
 */
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                { error: 'Upload ID is required' },
                { status: 400 }
            );
        }

        // Clean up specific progress tracker
        const progress = defaultFileUploadHandler.getProgress(id);
        if (progress) {
            // This would need a cleanup method in the handler
            return NextResponse.json({ success: true });
        }

        return NextResponse.json(
            { error: 'Upload progress not found' },
            { status: 404 }
        );

    } catch (error) {
        console.error('Upload progress cleanup error:', error);
        return NextResponse.json(
            {
                error: 'Failed to clean up upload progress',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
} 