/**
 * File Upload/Download Handler for Anvil HTTP Proxy
 * 
 * Handles multipart form uploads, streaming for large files, progress tracking,
 * download proxying with proper MIME types, and file security validation
 */

import { NextRequest } from 'next/server';
import { Readable } from 'stream';

export interface FileUploadConfig {
    maxFileSize: number; // in bytes
    maxTotalSize: number; // total upload size in bytes
    allowedMimeTypes?: string[]; // allowed MIME types, undefined = allow all
    allowedExtensions?: string[]; // allowed file extensions
    enableStreaming: boolean; // enable streaming for large files
    streamingThreshold: number; // file size threshold for streaming in bytes
    enableProgressTracking: boolean;
    debug: boolean;
}

export interface FileUploadResult {
    success: boolean;
    files: UploadedFile[];
    totalSize: number;
    errors: string[];
    progressId?: string;
}

export interface UploadedFile {
    fieldName: string;
    originalName: string;
    mimeType: string;
    size: number;
    data?: ArrayBuffer; // for small files
    stream?: Readable; // for large files
    tempPath?: string; // for streamed files
}

export interface DownloadConfig {
    supportedMimeTypes: Map<string, string>; // extension -> mime type mapping
    enableStreaming: boolean;
    bufferSize: number;
    debug: boolean;
}

export interface UploadProgress {
    uploadId: string;
    totalFiles: number;
    completedFiles: number;
    totalBytes: number;
    uploadedBytes: number;
    currentFile?: string;
    status: 'uploading' | 'processing' | 'complete' | 'error';
    error?: string;
}

class FileUploadHandler {
    private config: FileUploadConfig;
    private progressTrackers: Map<string, UploadProgress> = new Map();

    constructor(config: Partial<FileUploadConfig> = {}) {
        this.config = {
            maxFileSize: 100 * 1024 * 1024, // 100MB
            maxTotalSize: 500 * 1024 * 1024, // 500MB
            allowedMimeTypes: undefined, // allow all by default
            allowedExtensions: undefined, // allow all by default
            enableStreaming: true,
            streamingThreshold: 10 * 1024 * 1024, // 10MB
            enableProgressTracking: true,
            debug: false,
            ...config
        };
    }

    /**
     * Process multipart form data upload
     */
    async processUpload(request: NextRequest): Promise<FileUploadResult> {
        const result: FileUploadResult = {
            success: false,
            files: [],
            totalSize: 0,
            errors: []
        };

        try {
            const contentLength = parseInt(request.headers.get('content-length') || '0');

            // Check total size limit
            if (contentLength > this.config.maxTotalSize) {
                result.errors.push(`Total upload size ${contentLength} exceeds limit ${this.config.maxTotalSize}`);
                return result;
            }

            // Create progress tracker if enabled
            if (this.config.enableProgressTracking) {
                result.progressId = this.generateProgressId();
                this.initializeProgress(result.progressId, contentLength);
            }

            const formData = await request.formData();
            const files: UploadedFile[] = [];
            let totalSize = 0;

            for (const [fieldName, value] of formData.entries()) {
                if (value instanceof File) {
                    // Validate individual file
                    const validation = this.validateFile(value);
                    if (!validation.valid) {
                        result.errors.push(...validation.errors);
                        continue;
                    }

                    totalSize += value.size;

                    // Check if file should be streamed
                    const shouldStream = this.config.enableStreaming &&
                        value.size > this.config.streamingThreshold;

                    const uploadedFile: UploadedFile = {
                        fieldName,
                        originalName: value.name,
                        mimeType: value.type || this.getMimeTypeFromExtension(value.name),
                        size: value.size
                    };

                    if (shouldStream) {
                        uploadedFile.stream = this.createFileStream(value);
                        if (this.config.debug) {
                            console.log(`📁 Streaming large file: ${value.name} (${value.size} bytes)`);
                        }
                    } else {
                        uploadedFile.data = await value.arrayBuffer();
                        if (this.config.debug) {
                            console.log(`📁 Loaded file: ${value.name} (${value.size} bytes)`);
                        }
                    }

                    files.push(uploadedFile);

                    // Update progress
                    if (result.progressId) {
                        this.updateProgress(result.progressId, files.length, totalSize, value.name);
                    }
                }
            }

            // Final validation
            if (totalSize > this.config.maxTotalSize) {
                result.errors.push(`Total file size ${totalSize} exceeds limit ${this.config.maxTotalSize}`);
                return result;
            }

            result.files = files;
            result.totalSize = totalSize;
            result.success = result.errors.length === 0;

            if (result.progressId) {
                this.completeProgress(result.progressId, result.success);
            }

            if (this.config.debug) {
                console.log(`✅ Upload processed: ${files.length} files, ${totalSize} bytes`);
            }

        } catch (error) {
            result.errors.push(`Upload processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);

            if (result.progressId) {
                this.errorProgress(result.progressId, error instanceof Error ? error.message : 'Unknown error');
            }
        }

        return result;
    }

    /**
     * Validate individual file
     */
    private validateFile(file: File): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check file size
        if (file.size > this.config.maxFileSize) {
            errors.push(`File ${file.name} size ${file.size} exceeds limit ${this.config.maxFileSize}`);
        }

        // Check MIME type
        if (this.config.allowedMimeTypes && file.type) {
            if (!this.config.allowedMimeTypes.includes(file.type)) {
                errors.push(`File ${file.name} MIME type ${file.type} not allowed`);
            }
        }

        // Check file extension
        if (this.config.allowedExtensions) {
            const extension = this.getFileExtension(file.name);
            if (extension && !this.config.allowedExtensions.includes(extension)) {
                errors.push(`File ${file.name} extension ${extension} not allowed`);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Create a readable stream from a File object
     */
    private createFileStream(file: File): Readable {
        const reader = file.stream().getReader();

        return new Readable({
            async read() {
                try {
                    const { done, value } = await reader.read();
                    if (done) {
                        this.push(null);
                    } else {
                        this.push(Buffer.from(value));
                    }
                } catch (error) {
                    this.destroy(error instanceof Error ? error : new Error('Stream read error'));
                }
            }
        });
    }

    /**
     * Get file extension from filename
     */
    private getFileExtension(filename: string): string | null {
        const match = filename.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : null;
    }

    /**
     * Get MIME type from file extension
     */
    private getMimeTypeFromExtension(filename: string): string {
        const extension = this.getFileExtension(filename);
        const mimeTypes: Record<string, string> = {
            'txt': 'text/plain',
            'html': 'text/html',
            'css': 'text/css',
            'js': 'application/javascript',
            'json': 'application/json',
            'pdf': 'application/pdf',
            'doc': 'application/msword',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls': 'application/vnd.ms-excel',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'svg': 'image/svg+xml',
            'mp4': 'video/mp4',
            'avi': 'video/x-msvideo',
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'zip': 'application/zip',
            'tar': 'application/x-tar',
            'gz': 'application/gzip'
        };

        return extension ? (mimeTypes[extension] || 'application/octet-stream') : 'application/octet-stream';
    }

    /**
     * Progress tracking methods
     */
    private generateProgressId(): string {
        return `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private initializeProgress(progressId: string, totalBytes: number): void {
        this.progressTrackers.set(progressId, {
            uploadId: progressId,
            totalFiles: 0,
            completedFiles: 0,
            totalBytes,
            uploadedBytes: 0,
            status: 'uploading'
        });
    }

    private updateProgress(progressId: string, completedFiles: number, uploadedBytes: number, currentFile?: string): void {
        const progress = this.progressTrackers.get(progressId);
        if (progress) {
            progress.completedFiles = completedFiles;
            progress.uploadedBytes = uploadedBytes;
            progress.currentFile = currentFile;
            progress.status = 'processing';
        }
    }

    private completeProgress(progressId: string, success: boolean): void {
        const progress = this.progressTrackers.get(progressId);
        if (progress) {
            progress.status = success ? 'complete' : 'error';
            progress.uploadedBytes = progress.totalBytes;
        }
    }

    private errorProgress(progressId: string, error: string): void {
        const progress = this.progressTrackers.get(progressId);
        if (progress) {
            progress.status = 'error';
            progress.error = error;
        }
    }

    /**
     * Get upload progress
     */
    getProgress(progressId: string): UploadProgress | null {
        return this.progressTrackers.get(progressId) || null;
    }

    /**
     * Clean up old progress trackers
     */
    cleanupProgress(olderThanMs: number = 300000): void { // 5 minutes default
        const cutoff = Date.now() - olderThanMs;
        for (const [id, progress] of this.progressTrackers.entries()) {
            const uploadTime = parseInt(id.split('_')[1]);
            if (uploadTime < cutoff) {
                this.progressTrackers.delete(id);
            }
        }
    }
}

class FileDownloadHandler {
    private config: DownloadConfig;

    constructor(config: Partial<DownloadConfig> = {}) {
        this.config = {
            supportedMimeTypes: new Map([
                ['txt', 'text/plain'],
                ['html', 'text/html'],
                ['css', 'text/css'],
                ['js', 'application/javascript'],
                ['json', 'application/json'],
                ['pdf', 'application/pdf'],
                ['jpg', 'image/jpeg'],
                ['jpeg', 'image/jpeg'],
                ['png', 'image/png'],
                ['gif', 'image/gif'],
                ['svg', 'image/svg+xml'],
                ['mp4', 'video/mp4'],
                ['mp3', 'audio/mpeg'],
                ['zip', 'application/zip']
            ]),
            enableStreaming: true,
            bufferSize: 64 * 1024, // 64KB chunks
            debug: false,
            ...config
        };
    }

    /**
     * Enhance response headers for file downloads
     */
    enhanceDownloadHeaders(
        headers: Record<string, string>,
        filename?: string,
        mimeType?: string
    ): Record<string, string> {
        const enhancedHeaders = { ...headers };

        // Set proper content type
        if (mimeType) {
            enhancedHeaders['content-type'] = mimeType;
        } else if (filename) {
            const extension = this.getFileExtension(filename);
            const detectedMimeType = extension ? this.config.supportedMimeTypes.get(extension) : null;
            if (detectedMimeType) {
                enhancedHeaders['content-type'] = detectedMimeType;
            }
        }

        // Set download headers if filename is provided
        if (filename) {
            enhancedHeaders['content-disposition'] = `attachment; filename="${filename}"`;
        }

        // Add caching headers for static content
        if (enhancedHeaders['content-type']?.startsWith('image/') ||
            enhancedHeaders['content-type']?.startsWith('video/') ||
            enhancedHeaders['content-type']?.startsWith('audio/')) {
            enhancedHeaders['cache-control'] = 'public, max-age=31536000'; // 1 year
        }

        // Add security headers
        enhancedHeaders['x-content-type-options'] = 'nosniff';

        if (this.config.debug) {
            console.log(`📥 Download headers enhanced for: ${filename || 'unknown'}`);
        }

        return enhancedHeaders;
    }

    private getFileExtension(filename: string): string | null {
        const match = filename.match(/\.([^.]+)$/);
        return match ? match[1].toLowerCase() : null;
    }
}

// Default instances
export const defaultFileUploadHandler = new FileUploadHandler({
    debug: process.env.NODE_ENV === 'development'
});

export const defaultFileDownloadHandler = new FileDownloadHandler({
    debug: process.env.NODE_ENV === 'development'
});

export { FileUploadHandler, FileDownloadHandler }; 