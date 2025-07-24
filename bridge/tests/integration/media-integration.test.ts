/**
 * Media API Integration Tests
 * 
 * Tests anvil.media integration with the complete bridge system including:
 * - Server calls with media objects
 * - File upload/download workflows
 * - Component integration
 * - Protocol compliance
 */

import {
    BlobMedia,
    URLMedia,
    FileMedia,
    LazyMedia,
    TempUrl,
    download,
    from_file
} from '../../src/lib/media/anvil-media';

// Mock fetch and DOM for integration tests
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock DOM elements
Object.defineProperty(document, 'createElement', {
    value: jest.fn((tagName: string) => {
        if (tagName === 'a') {
            return {
                href: '',
                download: '',
                style: { display: '' },
                click: jest.fn()
            };
        }
        return {};
    }),
    writable: true
});

Object.defineProperty(document.body, 'appendChild', {
    value: jest.fn(),
    writable: true
});

Object.defineProperty(document.body, 'removeChild', {
    value: jest.fn(),
    writable: true
});

global.URL = {
    createObjectURL: jest.fn(() => 'blob:http://localhost/test-blob-url'),
    revokeObjectURL: jest.fn()
} as any;

describe('Media API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
    });

    describe('Server Call Integration', () => {
        it('should serialize media objects for server calls', async () => {
            const testData = 'Hello from integration test!';
            const media = new BlobMedia('text/plain', testData, { name: 'integration-test.txt' });

            // Simulate server call serialization
            const bytes = await media.get_bytes();
            const contentType = await media.get_content_type();
            const name = media.get_name();

            expect(bytes).toBeInstanceOf(Uint8Array);
            expect(new TextDecoder().decode(bytes)).toBe(testData);
            expect(contentType).toBe('text/plain');
            expect(name).toBe('integration-test.txt');
        });

        it('should handle media in server call responses', async () => {
            // Simulate receiving LazyMedia from server
            const lazySpec = {
                id: 'server-media-123',
                key: 'upload-key-456',
                manager: 'files',
                name: 'server-file.pdf',
                'mime-type': 'application/pdf'
            };

            const lazyMedia = new LazyMedia(lazySpec);

            expect(lazyMedia.get_name()).toBe('server-file.pdf');
            expect(lazyMedia.content_type).toBe('application/pdf');

            // Mock session token for URL generation
            (window as any).anvilSessionToken = 'test-session-token';

            const url = await lazyMedia.get_url();
            expect(url).toContain('/_/lm/files/upload-key-456/server-media-123/server-file.pdf');
            expect(url).toContain('_anvil_session=test-session-token');
        });

        it('should handle file upload workflow', async () => {
            // Simulate file upload process
            const fileContent = 'File upload test content';
            const file = new File([fileContent], 'upload-test.txt', { type: 'text/plain' });
            const fileMedia = new FileMedia(file);

            expect(fileMedia.get_name()).toBe('upload-test.txt');
            expect(fileMedia.content_type).toBe('text/plain');

            // Simulate upload via server call
            const bytes = await fileMedia.get_bytes();
            expect(new TextDecoder().decode(bytes)).toBe(fileContent);
        });
    });

    describe('Component Integration', () => {
        it('should integrate with FileLoader component workflow', async () => {
            // Simulate FileLoader component usage
            const files = [
                new File(['Image data'], 'test-image.jpg', { type: 'image/jpeg' }),
                new File(['Document data'], 'test-doc.pdf', { type: 'application/pdf' }),
                new File(['Text data'], 'test-text.txt', { type: 'text/plain' })
            ];

            const mediaObjects = files.map(file => new FileMedia(file));

            expect(mediaObjects).toHaveLength(3);
            expect(mediaObjects[0].get_name()).toBe('test-image.jpg');
            expect(mediaObjects[1].get_name()).toBe('test-doc.pdf');
            expect(mediaObjects[2].get_name()).toBe('test-text.txt');

            // Test content access
            for (const media of mediaObjects) {
                const bytes = await media.get_bytes();
                expect(bytes).toBeInstanceOf(Uint8Array);
            }
        });

        it('should integrate with Image component for display', async () => {
            // Create image media
            const imageData = new Uint8Array([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52  // IHDR chunk start
            ]);

            const imageMedia = new BlobMedia('image/png', imageData, { name: 'test-image.png' });

            // Simulate Image component getting display URL
            const tempUrl = new TempUrl(imageMedia);
            const displayUrl = await tempUrl.getUrl();

            expect(displayUrl).toBe('blob:http://localhost/test-blob-url');
            expect(URL.createObjectURL).toHaveBeenCalled();

            // Clean up
            tempUrl.revoke();
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });

        it('should handle Plot component with media data sources', async () => {
            // Create CSV data for plotting
            const csvData = `x,y
1,10
2,20
3,15
4,25
5,30`;

            const csvMedia = new BlobMedia('text/csv', csvData, { name: 'plot-data.csv' });

            expect(csvMedia.get_name()).toBe('plot-data.csv');
            expect(await csvMedia.get_content_type()).toBe('text/csv');

            // Simulate reading data for plotting
            const bytes = await csvMedia.get_bytes();
            const csvContent = new TextDecoder().decode(bytes);
            expect(csvContent).toContain('x,y');
            expect(csvContent).toContain('1,10');
        });
    });

    describe('Download and Export Workflows', () => {
        it('should handle complete download workflow', async () => {
            const reportData = {
                title: 'Integration Test Report',
                timestamp: new Date().toISOString(),
                data: [1, 2, 3, 4, 5],
                summary: 'All tests passing'
            };

            const jsonContent = JSON.stringify(reportData, null, 2);
            const reportMedia = new BlobMedia('application/json', jsonContent, {
                name: 'integration-report.json'
            });

            // Trigger download
            await download(reportMedia);

            expect(document.createElement).toHaveBeenCalledWith('a');
            expect(document.body.appendChild).toHaveBeenCalled();
        });

        it('should handle batch file operations', async () => {
            const files = [
                { name: 'file1.txt', content: 'Content 1', type: 'text/plain' },
                { name: 'file2.json', content: '{"test": true}', type: 'application/json' },
                { name: 'file3.csv', content: 'a,b,c\n1,2,3', type: 'text/csv' }
            ];

            const mediaObjects = files.map(file =>
                new BlobMedia(file.type, file.content, { name: file.name })
            );

            // Batch process
            const results = await Promise.all(
                mediaObjects.map(async media => ({
                    name: media.get_name(),
                    size: await media.get_length(),
                    type: await media.get_content_type()
                }))
            );

            expect(results).toHaveLength(3);
            expect(results[0]).toEqual({
                name: 'file1.txt',
                size: 9, // 'Content 1'
                type: 'text/plain'
            });
        });
    });

    describe('URL and External Resource Integration', () => {
        it('should handle external image loading', async () => {
            const imageUrl = 'https://example.com/test-image.jpg';
            const mockImageData = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // PNG start

            mockFetch.mockResolvedValue({
                ok: true,
                arrayBuffer: () => Promise.resolve(mockImageData.buffer),
                headers: new Map([['content-type', 'image/png']])
            } as any);

            const urlMedia = new URLMedia(imageUrl);

            expect(urlMedia.get_name()).toBe('test-image.jpg');
            expect(await urlMedia.get_url()).toBe(imageUrl);

            const contentType = await urlMedia.get_content_type();
            expect(contentType).toBe('image/png');

            const bytes = await urlMedia.get_bytes();
            expect(bytes).toEqual(mockImageData);
        });

        it('should handle data URLs in components', async () => {
            const dataUrl = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiPjwvc3ZnPg==';
            const urlMedia = new URLMedia(dataUrl);

            expect(urlMedia.get_name()).toBe('PHN2ZyB3aWR0aD0iMTAiIGhlaWdodD0iMTAiPjwvc3ZnPg==');

            const contentType = await urlMedia.get_content_type();
            expect(contentType).toBe('image/svg+xml');

            const bytes = await urlMedia.get_bytes();
            const svgContent = new TextDecoder().decode(bytes);
            expect(svgContent).toContain('<svg');
        });
    });

    describe('Memory Management and Performance', () => {
        it('should handle large file processing efficiently', async () => {
            // Create 1MB of test data
            const largeData = new Uint8Array(1024 * 1024);
            largeData.fill(42);

            const startTime = performance.now();
            const largeMedia = new BlobMedia('application/octet-stream', largeData, {
                name: 'large-file.bin'
            });
            const creationTime = performance.now() - startTime;

            expect(creationTime).toBeLessThan(100); // Should create quickly
            expect(await largeMedia.get_length()).toBe(1024 * 1024);

            // Test reading performance
            const readStart = performance.now();
            const bytes = await largeMedia.get_bytes();
            const readTime = performance.now() - readStart;

            expect(readTime).toBeLessThan(50); // Should read quickly
            expect(bytes.length).toBe(1024 * 1024);
            expect(bytes[0]).toBe(42);
        });

        it('should manage TempUrl lifecycle properly', async () => {
            const media = new BlobMedia('text/plain', 'Lifecycle test');

            // Create multiple TempUrls
            const tempUrls = Array.from({ length: 10 }, () => new TempUrl(media));

            // Get URLs
            const urls = await Promise.all(tempUrls.map(tu => tu.getUrl()));
            expect(urls).toHaveLength(10);
            expect(URL.createObjectURL).toHaveBeenCalledTimes(10);

            // Revoke all
            tempUrls.forEach(tu => tu.revoke());
            expect(URL.revokeObjectURL).toHaveBeenCalledTimes(10);
        });

        it('should handle concurrent media operations', async () => {
            const tasks = Array.from({ length: 20 }, (_, i) => async () => {
                const media = new BlobMedia('text/plain', `Concurrent test ${i}`, {
                    name: `concurrent-${i}.txt`
                });

                const [bytes, contentType, length] = await Promise.all([
                    media.get_bytes(),
                    media.get_content_type(),
                    media.get_length()
                ]);

                return {
                    id: i,
                    size: bytes.length,
                    type: contentType,
                    length
                };
            });

            const startTime = performance.now();
            const results = await Promise.all(tasks.map(task => task()));
            const totalTime = performance.now() - startTime;

            expect(results).toHaveLength(20);
            expect(totalTime).toBeLessThan(200); // Should complete within 200ms
            expect(results[0].type).toBe('text/plain');
            expect(results[19].size).toBeGreaterThan(0);
        });
    });

    describe('Error Handling and Edge Cases', () => {
        it('should handle network failures gracefully', async () => {
            const networkUrl = 'https://unreachable.example.com/file.txt';

            mockFetch.mockRejectedValue(new Error('Network error'));

            const urlMedia = new URLMedia(networkUrl);

            await expect(urlMedia.get_bytes()).rejects.toThrow('Network error');
            await expect(urlMedia.get_content_type()).rejects.toThrow('Network error');
        });

        it('should handle corrupted data gracefully', async () => {
            // Test with malformed data URL
            const malformedDataUrl = 'data:text/plain;base64,invalid!!!base64!!!';
            const urlMedia = new URLMedia(malformedDataUrl);

            await expect(urlMedia.get_bytes()).rejects.toThrow();
        });

        it('should handle empty and null inputs', async () => {
            // Empty content
            const emptyMedia = new BlobMedia('text/plain', '');
            expect(await emptyMedia.get_length()).toBe(0);
            expect((await emptyMedia.get_bytes()).length).toBe(0);

            // Empty URL
            const emptyUrl = new URLMedia('');
            expect(emptyUrl.get_name()).toBe('');
        });

        it('should handle special characters and Unicode', async () => {
            const unicodeContent = '🚀 Hello, 世界! Testing émojis and spëcial chars 🌟';
            const unicodeMedia = new BlobMedia('text/plain', unicodeContent, {
                name: 'unicode-tëst.txt'
            });

            const bytes = await unicodeMedia.get_bytes();
            const decoded = new TextDecoder().decode(bytes);

            expect(decoded).toBe(unicodeContent);
            expect(unicodeMedia.get_name()).toBe('unicode-tëst.txt');
        });
    });

    describe('Protocol Compliance', () => {
        it('should maintain compatibility with Anvil server expectations', async () => {
            // Test LazyMedia URL format compliance
            const spec = {
                id: 'test-file-123',
                key: 'upload-session-456',
                manager: 'user-files',
                name: 'document.pdf',
                'mime-type': 'application/pdf'
            };

            (window as any).anvilSessionToken = 'anvil-session-token-789';
            process.env.NEXT_PUBLIC_ANVIL_SERVER_URL = 'https://test-server.anvil.works';

            const lazyMedia = new LazyMedia(spec);
            const url = await lazyMedia.get_url();

            // Verify URL format matches Anvil expectations
            expect(url).toMatch(/^https:\/\/test-server\.anvil\.works\/_\/lm\/user-files\/upload-session-456\/test-file-123\/document\.pdf\?_anvil_session=anvil-session-token-789$/);
        });

        it('should serialize media for server communication', async () => {
            const media = new BlobMedia('application/json', '{"test": "data"}', {
                name: 'test.json'
            });

            // Simulate serialization for server call
            const serialized = {
                type: 'DataMedia',
                content_type: await media.get_content_type(),
                name: media.get_name(),
                content: Array.from(await media.get_bytes())
            };

            expect(serialized.type).toBe('DataMedia');
            expect(serialized.content_type).toBe('application/json');
            expect(serialized.name).toBe('test.json');
            expect(serialized.content).toBeInstanceOf(Array);
        });
    });

    describe('Real-World Usage Scenarios', () => {
        it('should support image editing workflow', async () => {
            // Simulate uploading an image, processing it, and downloading result
            const originalImage = new Uint8Array([
                0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
                0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07  // Mock image data
            ]);

            const uploadedMedia = new BlobMedia('image/png', originalImage, {
                name: 'original.png'
            });

            // Simulate processing (e.g., adding metadata)
            const originalBytes = await uploadedMedia.get_bytes();
            const processedBytes = new Uint8Array(originalBytes.length + 4);
            processedBytes.set(originalBytes);
            processedBytes.set([0xFF, 0xEE, 0xDD, 0xCC], originalBytes.length); // Add metadata

            const processedMedia = new BlobMedia('image/png', processedBytes, {
                name: 'processed.png'
            });

            expect(await processedMedia.get_length()).toBe(originalBytes.length + 4);
            expect(processedMedia.get_name()).toBe('processed.png');

            // Simulate download
            await download(processedMedia);
            expect(document.createElement).toHaveBeenCalledWith('a');
        });

        it('should support document generation and export', async () => {
            // Simulate generating a report document
            const reportData = {
                title: 'Monthly Report',
                generated: new Date().toISOString(),
                sections: [
                    { title: 'Summary', content: 'All systems operational' },
                    { title: 'Metrics', content: 'Performance improved by 15%' },
                    { title: 'Issues', content: 'No critical issues reported' }
                ]
            };

            // Generate HTML report
            const htmlContent = `
<!DOCTYPE html>
<html>
<head><title>${reportData.title}</title></head>
<body>
    <h1>${reportData.title}</h1>
    <p>Generated: ${reportData.generated}</p>
    ${reportData.sections.map(section =>
                `<h2>${section.title}</h2><p>${section.content}</p>`
            ).join('')}
</body>
</html>`;

            const htmlMedia = new BlobMedia('text/html', htmlContent, {
                name: 'monthly-report.html'
            });

            // Generate JSON export
            const jsonContent = JSON.stringify(reportData, null, 2);
            const jsonMedia = new BlobMedia('application/json', jsonContent, {
                name: 'monthly-report.json'
            });

            // Verify both formats
            expect(htmlMedia.get_name()).toBe('monthly-report.html');
            expect(jsonMedia.get_name()).toBe('monthly-report.json');
            expect(await htmlMedia.get_content_type()).toBe('text/html');
            expect(await jsonMedia.get_content_type()).toBe('application/json');

            // Test content
            const htmlBytes = await htmlMedia.get_bytes();
            const htmlText = new TextDecoder().decode(htmlBytes);
            expect(htmlText).toContain('<h1>Monthly Report</h1>');

            const jsonBytes = await jsonMedia.get_bytes();
            const jsonText = new TextDecoder().decode(jsonBytes);
            const parsed = JSON.parse(jsonText);
            expect(parsed.title).toBe('Monthly Report');
        });
    });
}); 