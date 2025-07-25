/**
 * Anvil Media API Test Suite
 * 
 * Tests all media classes and utility functions for compatibility
 * with Anvil's Python media API
 */

import {
    AnvilMedia,
    BlobMedia,
    URLMedia,
    FileMedia,
    LazyMedia,
    TempUrl,
    TempFile,
    download,
    print_media,
    from_file,
    write_to_file,
    open,
    media
} from '../../src/lib/media/anvil-media';

// Mock fetch for testing
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock FileReader for data URL tests
global.FileReader = jest.fn(() => ({
    readAsDataURL: jest.fn(),
    readAsArrayBuffer: jest.fn(),
    readAsBinaryString: jest.fn(),
    onload: jest.fn(),
    onerror: jest.fn(),
    result: ''
})) as any;

// Mock URL object methods
global.URL = {
    createObjectURL: jest.fn(() => 'blob:http://localhost/test-blob-url'),
    revokeObjectURL: jest.fn()
} as any;

// Mock window for browser-specific tests
Object.defineProperty(window, 'open', {
    value: jest.fn(() => ({
        onload: jest.fn(),
        print: jest.fn(),
        close: jest.fn()
    })),
    writable: true
});

// Mock DOM elements for download tests
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

describe('Anvil Media API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockFetch.mockClear();
    });

    describe('BlobMedia', () => {
        it('should create BlobMedia from string content', async () => {
            const content = 'Hello, World!';
            const blob = new BlobMedia('text/plain', content, { name: 'test.txt' });

            expect(await blob.get_content_type()).toBe('text/plain');
            expect(blob.get_name()).toBe('test.txt');
            expect(await blob.get_length()).toBe(content.length);

            const bytes = await blob.get_bytes();
            expect(bytes.constructor.name).toBe('Uint8Array');
            expect(new TextDecoder().decode(bytes)).toBe(content);
        });

        it('should create BlobMedia from Uint8Array', async () => {
            const bytes = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
            const blob = new BlobMedia('application/octet-stream', bytes);

            expect(await blob.get_content_type()).toBe('application/octet-stream');
            expect(blob.get_name()).toBeNull();
            expect(await blob.get_length()).toBe(5);

            const resultBytes = await blob.get_bytes();
            expect(resultBytes).toEqual(bytes);
        });

        it('should create BlobMedia from Blob object', async () => {
            const browserBlob = new Blob(['test content'], { type: 'text/plain' });
            const blob = new BlobMedia('text/plain', browserBlob, { name: 'blob.txt' });

            expect(await blob.get_content_type()).toBe('text/plain');
            expect(blob.get_name()).toBe('blob.txt');
            expect(await blob.get_length()).toBe(browserBlob.size);
        });

        it('should return null for get_url without forceDataUrl', async () => {
            const blob = new BlobMedia('text/plain', 'test');
            const url = await blob.get_url();
            expect(url).toBeNull();
        });

        it('should create data URL when forceDataUrl is true', async () => {
            const content = 'test content';
            const blob = new BlobMedia('text/plain', content);

            // Mock FileReader
            const mockFileReader = {
                readAsDataURL: jest.fn(),
                onload: jest.fn(),
                result: 'data:text/plain;base64,dGVzdCBjb250ZW50'
            };

            (global.FileReader as any) = jest.fn(() => mockFileReader);

            const urlPromise = blob.get_url(true);

            // Simulate FileReader completion
            setTimeout(() => mockFileReader.onload(), 0);

            const url = await urlPromise;
            expect(url).toBe('data:text/plain;base64,dGVzdCBjb250ZW50');
        });
    });

    describe('URLMedia', () => {
        it('should create URLMedia and extract name from URL', () => {
            const url = 'https://example.com/path/to/file.jpg';
            const urlMedia = new URLMedia(url);

            expect(urlMedia.get_name()).toBe('file.jpg');
            expect(urlMedia.url).toBe(url);
        });

        it('should handle data URLs', async () => {
            const dataUrl = 'data:text/plain;base64,SGVsbG8gV29ybGQ='; // "Hello World"
            const urlMedia = new URLMedia(dataUrl);

            const contentType = await urlMedia.get_content_type();
            expect(contentType).toBe('text/plain');

            const bytes = await urlMedia.get_bytes();
            expect(new TextDecoder().decode(bytes)).toBe('Hello World');
        });

        it('should fetch content from HTTP URLs', async () => {
            const url = 'https://example.com/test.json';
            const responseData = { message: 'test' };
            const responseBuffer = new TextEncoder().encode(JSON.stringify(responseData));

            mockFetch.mockResolvedValue({
                ok: true,
                arrayBuffer: () => Promise.resolve(responseBuffer.buffer),
                headers: new Map([['content-type', 'application/json']])
            } as any);

            const urlMedia = new URLMedia(url);

            const contentType = await urlMedia.get_content_type();
            expect(contentType).toBe('application/json');

            const bytes = await urlMedia.get_bytes();
            expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual(responseData);

            expect(mockFetch).toHaveBeenCalledWith(url);
        });

        it('should handle fetch errors', async () => {
            const url = 'https://example.com/not-found.txt';

            mockFetch.mockResolvedValue({
                ok: false,
                status: 404
            } as any);

            const urlMedia = new URLMedia(url);

            await expect(urlMedia.get_bytes()).rejects.toThrow('Failed to load media (HTTP 404)');
        });

        it('should return original URL from get_url', async () => {
            const url = 'https://example.com/test.jpg';
            const urlMedia = new URLMedia(url);

            const resultUrl = await urlMedia.get_url();
            expect(resultUrl).toBe(url);
        });
    });

    describe('FileMedia', () => {
        it('should create FileMedia from File object', () => {
            const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
            const fileMedia = new FileMedia(file);

            expect(fileMedia.get_name()).toBe('test.txt');
            expect(fileMedia.content_type).toBe('text/plain');
        });
    });

    describe('LazyMedia', () => {
        it('should create LazyMedia with spec', () => {
            const spec = {
                id: 'test-id',
                key: 'test-key',
                manager: 'test-manager',
                name: 'test.jpg',
                'mime-type': 'image/jpeg'
            };

            const lazyMedia = new LazyMedia(spec);

            expect(lazyMedia.get_name()).toBe('test.jpg');
            expect(lazyMedia.content_type).toBe('image/jpeg');
        });

        it('should construct proper LazyMedia URL', async () => {
            const spec = {
                id: 'test-id',
                key: 'test-key',
                manager: 'test-manager',
                name: 'test.jpg'
            };

            // Mock window.anvilSessionToken
            (window as any).anvilSessionToken = 'test-session-token';

            const lazyMedia = new LazyMedia(spec);
            const url = await lazyMedia.get_url();

            expect(url).toContain('/_/lm/test-manager/test-key/test-id/test.jpg');
            expect(url).toContain('_anvil_session=test-session-token');
            expect(url).not.toContain('&nodl=1');
        });

        it('should handle no-download URLs', async () => {
            const spec = {
                id: 'test-id',
                key: 'test-key',
                manager: 'test-manager',
                name: 'test.jpg'
            };

            const lazyMedia = new LazyMedia(spec);
            const url = await lazyMedia.get_url(false);

            expect(url).toContain('&nodl=1');
        });
    });

    describe('TempUrl', () => {
        it('should create temporary URL for media without permanent URL', async () => {
            const blob = new BlobMedia('text/plain', 'test content');
            const tempUrl = new TempUrl(blob);

            const url = await tempUrl.getUrl();
            expect(url).toBe('blob:http://localhost/test-blob-url');
            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should use permanent URL if available', async () => {
            const urlMedia = new URLMedia('https://example.com/test.jpg');
            const tempUrl = new TempUrl(urlMedia);

            const url = await tempUrl.getUrl();
            expect(url).toBe('https://example.com/test.jpg');
            expect(URL.createObjectURL).not.toHaveBeenCalled();
        });

        it('should revoke blob URL', async () => {
            const blob = new BlobMedia('text/plain', 'test content');
            const tempUrl = new TempUrl(blob);

            await tempUrl.getUrl();
            tempUrl.revoke();

            expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:http://localhost/test-blob-url');
        });

        it('should support context manager pattern', async () => {
            const blob = new BlobMedia('text/plain', 'test content');
            const tempUrl = new TempUrl(blob);

            const url = await tempUrl.__enter__();
            expect(url).toBe('blob:http://localhost/test-blob-url');

            tempUrl.__exit__();
            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });
    });

    describe('TempFile', () => {
        it('should create temporary file with media content', async () => {
            const blob = new BlobMedia('text/plain', 'test content');
            const tempFile = new TempFile(blob);

            const url = await tempFile.__enter__();
            expect(url).toBe('blob:http://localhost/test-blob-url');
            expect(URL.createObjectURL).toHaveBeenCalled();
        });

        it('should create empty temporary file', async () => {
            const tempFile = new TempFile();

            const url = await tempFile.__enter__();
            expect(url).toBe('blob:http://localhost/test-blob-url');
        });

        it('should clean up on exit', async () => {
            const tempFile = new TempFile();
            await tempFile.__enter__();
            tempFile.__exit__();

            expect(URL.revokeObjectURL).toHaveBeenCalled();
        });
    });

    describe('Utility Functions', () => {
        describe('download()', () => {
            it('should trigger download for media object', async () => {
                const blob = new BlobMedia('text/plain', 'test content', { name: 'test.txt' });

                await download(blob);

                expect(document.createElement).toHaveBeenCalledWith('a');
                expect(document.body.appendChild).toHaveBeenCalled();

                // Wait for the setTimeout cleanup
                await new Promise(resolve => setTimeout(resolve, 10));
                expect(document.body.removeChild).toHaveBeenCalled();
            });

            it('should use default filename if none provided', async () => {
                const blob = new BlobMedia('text/plain', 'test content');

                await download(blob);

                expect(document.createElement).toHaveBeenCalledWith('a');
            });
        });

        describe('print_media()', () => {
            it('should open print window for media', async () => {
                const blob = new BlobMedia('text/plain', 'test content');

                await print_media(blob);

                expect(window.open).toHaveBeenCalled();
            });

            it('should handle window.open failure', async () => {
                const blob = new BlobMedia('text/plain', 'test content');
                (window.open as jest.Mock).mockReturnValue(null);

                await expect(print_media(blob)).rejects.toThrow('Could not open print window');
            });
        });

        describe('from_file()', () => {
            it('should create BlobMedia from File', () => {
                const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
                const media = from_file(file);

                expect(media).toBeInstanceOf(BlobMedia);
                expect(media.get_name()).toBe('test.txt');
                expect(media.content_type).toBe('text/plain');
            });

            it('should use custom mime type and name', () => {
                const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
                const media = from_file(file, 'application/octet-stream', 'custom.bin');

                expect(media.get_name()).toBe('custom.bin');
                expect(media.content_type).toBe('application/octet-stream');
            });
        });

        describe('write_to_file()', () => {
            it('should trigger download with custom filename', async () => {
                const blob = new BlobMedia('text/plain', 'test content', { name: 'original.txt' });

                await write_to_file(blob, 'custom.txt');

                expect(document.createElement).toHaveBeenCalledWith('a');
            });
        });

        describe('open()', () => {
            it('should return Blob from media', async () => {
                const content = 'test content';
                const blob = new BlobMedia('text/plain', content);

                const result = await open(blob);

                expect(result).toBeInstanceOf(Blob);
            });
        });
    });

    describe('Media Module Export', () => {
        it('should export all classes and functions', () => {
            expect(media.BlobMedia).toBe(BlobMedia);
            expect(media.URLMedia).toBe(URLMedia);
            expect(media.FileMedia).toBe(FileMedia);
            expect(media.LazyMedia).toBe(LazyMedia);
            expect(media.TempUrl).toBe(TempUrl);
            expect(media.TempFile).toBe(TempFile);
            expect(media.download).toBe(download);
            expect(media.print_media).toBe(print_media);
            expect(media.from_file).toBe(from_file);
            expect(media.write_to_file).toBe(write_to_file);
            expect(media.open).toBe(open);
        });
    });

    describe('Error Handling', () => {
        it('should handle malformed data URLs in URLMedia', async () => {
            const urlMedia = new URLMedia('data:invalid');

            await expect(urlMedia.get_bytes()).rejects.toThrow();
        });

        it('should handle network errors in URLMedia', async () => {
            const url = 'https://example.com/test.txt';

            mockFetch.mockRejectedValue(new Error('Network error'));

            const urlMedia = new URLMedia(url);

            await expect(urlMedia.get_bytes()).rejects.toThrow('Network error');
        });
    });

    describe('Performance and Edge Cases', () => {
        it('should handle large binary data', async () => {
            const largeData = new Uint8Array(1024 * 1024); // 1MB
            largeData.fill(42);

            const blob = new BlobMedia('application/octet-stream', largeData);

            const result = await blob.get_bytes();
            expect(result.length).toBe(largeData.length);
            expect(result[0]).toBe(42);
        });

        it('should handle empty content', async () => {
            const blob = new BlobMedia('text/plain', '');

            expect(await blob.get_length()).toBe(0);
            expect((await blob.get_bytes()).length).toBe(0);
        });

        it('should handle Unicode content', async () => {
            const unicode = '🚀 Hello, 世界! 🌍';
            const blob = new BlobMedia('text/plain', unicode);

            const bytes = await blob.get_bytes();
            const decoded = new TextDecoder().decode(bytes);
            expect(decoded).toBe(unicode);
        });

        it('should handle concurrent TempUrl creation and revocation', async () => {
            const blob = new BlobMedia('text/plain', 'test');
            const tempUrl1 = new TempUrl(blob);
            const tempUrl2 = new TempUrl(blob);

            const [url1, url2] = await Promise.all([
                tempUrl1.getUrl(),
                tempUrl2.getUrl()
            ]);

            expect(url1).toBeDefined();
            expect(url2).toBeDefined();

            tempUrl1.revoke();
            tempUrl2.revoke();

            expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
        });
    });
}); 