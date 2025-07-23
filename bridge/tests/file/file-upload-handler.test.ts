/**
 * Comprehensive test suite for File Upload/Download Handler
 */

import { FileUploadHandler, FileDownloadHandler } from '../../src/lib/file/file-upload-handler';

// Mock NextRequest for testing
class MockNextRequest {
    public method: string = 'POST';
    public headers: Map<string, string> = new Map();

    constructor(private mockFormData: FormData) { }

    async formData(): Promise<FormData> {
        return this.mockFormData;
    }

    // Mock headers.get method
    get headersObj() {
        return {
            get: (key: string) => this.headers.get(key),
            forEach: (callback: (value: string, key: string) => void) => {
                this.headers.forEach(callback);
            },
            entries: () => this.headers.entries()
        };
    }
}

describe('FileUploadHandler', () => {
    let uploadHandler: FileUploadHandler;

    beforeEach(() => {
        uploadHandler = new FileUploadHandler({
            maxFileSize: 10 * 1024 * 1024, // 10MB
            maxTotalSize: 50 * 1024 * 1024, // 50MB
            streamingThreshold: 1 * 1024 * 1024, // 1MB
            enableStreaming: true,
            enableProgressTracking: true,
            debug: true
        });
    });

    describe('File Validation', () => {
        test('should accept valid file within size limits', async () => {
            const fileContent = 'test content';
            const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '12');

            const result = await uploadHandler.processUpload(mockRequest);

            expect(result.success).toBe(true);
            expect(result.files).toHaveLength(1);
            expect(result.files[0].originalName).toBe('test.txt');
            expect(result.files[0].mimeType).toBe('text/plain');
            expect(result.errors).toHaveLength(0);
        });

        test('should reject file exceeding size limit', async () => {
            const uploadHandlerSmall = new FileUploadHandler({
                maxFileSize: 5, // 5 bytes
                debug: true
            });

            const fileContent = 'this content is too long';
            const file = new File([fileContent], 'large.txt', { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', fileContent.length.toString());

            const result = await uploadHandlerSmall.processUpload(mockRequest);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('exceeds limit');
        });

        test('should reject disallowed MIME types', async () => {
            const uploadHandlerRestricted = new FileUploadHandler({
                allowedMimeTypes: ['text/plain'],
                debug: true
            });

            const file = new File(['test'], 'test.jpg', { type: 'image/jpeg' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '4');

            const result = await uploadHandlerRestricted.processUpload(mockRequest);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('MIME type');
        });

        test('should reject disallowed file extensions', async () => {
            const uploadHandlerRestricted = new FileUploadHandler({
                allowedExtensions: ['txt', 'pdf'],
                debug: true
            });

            const file = new File(['test'], 'test.exe', { type: 'application/octet-stream' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '4');

            const result = await uploadHandlerRestricted.processUpload(mockRequest);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('extension');
        });
    });

    describe('MIME Type Detection', () => {
        test('should detect MIME type from file extension when not provided', async () => {
            const file = new File(['test'], 'document.pdf', { type: '' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '4');

            const result = await uploadHandler.processUpload(mockRequest);

            expect(result.success).toBe(true);
            expect(result.files[0].mimeType).toBe('application/pdf');
        });

        test('should use provided MIME type over detection', async () => {
            const file = new File(['test'], 'document.pdf', { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '4');

            const result = await uploadHandler.processUpload(mockRequest);

            expect(result.success).toBe(true);
            expect(result.files[0].mimeType).toBe('text/plain');
        });

        test('should default to application/octet-stream for unknown extensions', async () => {
            const file = new File(['test'], 'unknown.xyz', { type: '' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '4');

            const result = await uploadHandler.processUpload(mockRequest);

            expect(result.success).toBe(true);
            expect(result.files[0].mimeType).toBe('application/octet-stream');
        });
    });

    describe('Multiple File Uploads', () => {
        test('should handle multiple files in single upload', async () => {
            const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
            const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file1', file1);
            formData.append('file2', file2);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '16');

            const result = await uploadHandler.processUpload(mockRequest);

            expect(result.success).toBe(true);
            expect(result.files).toHaveLength(2);
            expect(result.files[0].fieldName).toBe('file1');
            expect(result.files[1].fieldName).toBe('file2');
        });

        test('should validate total size across multiple files', async () => {
            const uploadHandlerSmall = new FileUploadHandler({
                maxTotalSize: 10, // 10 bytes total
                debug: true
            });

            const file1 = new File(['content1'], 'file1.txt', { type: 'text/plain' });
            const file2 = new File(['content2'], 'file2.txt', { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file1', file1);
            formData.append('file2', file2);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '16');

            const result = await uploadHandlerSmall.processUpload(mockRequest);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Total upload size');
        });
    });

    describe('Progress Tracking', () => {
        test('should create progress tracker when enabled', async () => {
            const file = new File(['test'], 'test.txt', { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '4');

            const result = await uploadHandler.processUpload(mockRequest);

            expect(result.success).toBe(true);
            expect(result.progressId).toBeDefined();
            expect(typeof result.progressId).toBe('string');

            if (result.progressId) {
                const progress = uploadHandler.getProgress(result.progressId);
                expect(progress).not.toBeNull();
                expect(progress?.status).toBe('complete');
            }
        });

        test('should not create progress tracker when disabled', async () => {
            const uploadHandlerNoProgress = new FileUploadHandler({
                enableProgressTracking: false,
                debug: true
            });

            const file = new File(['test'], 'test.txt', { type: 'text/plain' });

            const formData = new FormData();
            formData.append('file', file);

            const mockRequest = new MockNextRequest(formData) as any;
            mockRequest.headers.set('content-length', '4');

            const result = await uploadHandlerNoProgress.processUpload(mockRequest);

            expect(result.success).toBe(true);
            expect(result.progressId).toBeUndefined();
        });
    });

    describe('Error Handling', () => {
        test('should handle processing errors gracefully', async () => {
            const mockRequest = {
                headers: {
                    get: () => '0'
                },
                formData: () => Promise.reject(new Error('FormData parsing failed'))
            } as any;

            const result = await uploadHandler.processUpload(mockRequest);

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0]).toContain('Upload processing error');
        });
    });
});

describe('FileDownloadHandler', () => {
    let downloadHandler: FileDownloadHandler;

    beforeEach(() => {
        downloadHandler = new FileDownloadHandler({
            debug: true
        });
    });

    describe('Header Enhancement', () => {
        test('should enhance headers for known file types', () => {
            const headers = { 'content-length': '1000' };
            const enhanced = downloadHandler.enhanceDownloadHeaders(
                headers,
                'document.pdf',
                'application/pdf'
            );

            expect(enhanced['content-type']).toBe('application/pdf');
            expect(enhanced['content-disposition']).toBe('attachment; filename="document.pdf"');
            expect(enhanced['x-content-type-options']).toBe('nosniff');
        });

        test('should detect MIME type from filename extension', () => {
            const headers = {};
            const enhanced = downloadHandler.enhanceDownloadHeaders(
                headers,
                'image.jpg'
            );

            expect(enhanced['content-type']).toBe('image/jpeg');
            expect(enhanced['content-disposition']).toBe('attachment; filename="image.jpg"');
        });

        test('should add caching headers for media files', () => {
            const headers = {};
            const enhanced = downloadHandler.enhanceDownloadHeaders(
                headers,
                'video.mp4',
                'video/mp4'
            );

            expect(enhanced['cache-control']).toBe('public, max-age=31536000');
        });

        test('should preserve existing headers', () => {
            const headers = {
                'custom-header': 'custom-value',
                'content-length': '1000'
            };
            const enhanced = downloadHandler.enhanceDownloadHeaders(
                headers,
                'file.txt'
            );

            expect(enhanced['custom-header']).toBe('custom-value');
            expect(enhanced['content-length']).toBe('1000');
        });
    });

    describe('MIME Type Support', () => {
        test('should support common file types', () => {
            const testCases = [
                ['document.pdf', 'application/pdf'],
                ['image.jpg', 'image/jpeg'],
                ['image.png', 'image/png'],
                ['video.mp4', 'video/mp4'],
                ['audio.mp3', 'audio/mpeg'],
                ['archive.zip', 'application/zip']
            ];

            testCases.forEach(([filename, expectedMimeType]) => {
                const enhanced = downloadHandler.enhanceDownloadHeaders({}, filename);
                expect(enhanced['content-type']).toBe(expectedMimeType);
            });
        });
    });
});

describe('Integration Tests', () => {
    test('should handle complete upload-download cycle', async () => {
        const uploadHandler = new FileUploadHandler({ debug: true });
        const downloadHandler = new FileDownloadHandler({ debug: true });

        // Upload phase
        const fileContent = 'Test file content for integration test';
        const file = new File([fileContent], 'integration-test.txt', { type: 'text/plain' });

        const formData = new FormData();
        formData.append('testFile', file);

        const mockRequest = new MockNextRequest(formData) as any;
        mockRequest.headers.set('content-length', fileContent.length.toString());

        const uploadResult = await uploadHandler.processUpload(mockRequest);

        expect(uploadResult.success).toBe(true);
        expect(uploadResult.files).toHaveLength(1);

        // Download phase
        const downloadHeaders = downloadHandler.enhanceDownloadHeaders(
            { 'content-length': fileContent.length.toString() },
            uploadResult.files[0].originalName,
            uploadResult.files[0].mimeType
        );

        expect(downloadHeaders['content-type']).toBe('text/plain');
        expect(downloadHeaders['content-disposition']).toBe('attachment; filename="integration-test.txt"');
        expect(downloadHeaders['x-content-type-options']).toBe('nosniff');
    });
}); 