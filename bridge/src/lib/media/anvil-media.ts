/**
 * Anvil Media System - Complete Media API Implementation
 * 
 * Provides full compatibility with Anvil's Python media API including:
 * - BlobMedia: Create media from binary content
 * - URLMedia: Create media from URLs
 * - FileMedia: Handle File objects from FileLoader
 * - LazyMedia: Server-provided media with lazy loading
 * - TempUrl: Temporary URL management
 * - Utility functions: download, print_media, from_file, write_to_file, open
 */

// Media Base Classes and Interfaces
export interface MediaOptions {
    name?: string;
    contentType?: string;
}

export interface TempUrlOptions {
    download?: boolean;
}

export abstract class AnvilMedia {
    protected _contentType: string = '';
    protected _name: string | null = null;
    protected _length: number = 0;
    protected _url: string | null = null;

    // Properties matching Anvil Python API
    get content_type(): string {
        return this._contentType;
    }

    get name(): string | null {
        return this._name;
    }

    get length(): number {
        return this._length;
    }

    get url(): string | null {
        return this._url;
    }

    // Abstract methods that must be implemented by subclasses
    abstract get_bytes(): Promise<Uint8Array>;
    abstract get_content_type(): Promise<string>;
    abstract get_name(): string | null;
    abstract get_url(forceDataUrl?: boolean): Promise<string | null>;
    abstract get_length(): Promise<number>;
}

// BlobMedia Implementation
export class BlobMedia extends AnvilMedia {
    private _data: Uint8Array | Blob;

    constructor(contentType: string, content: Uint8Array | string | Blob, options: MediaOptions = {}) {
        super();

        this._contentType = contentType;
        this._name = options.name || null;

        if (content instanceof Blob) {
            this._data = content;
            this._contentType = content.type || contentType;
        } else if (typeof content === 'string') {
            // Convert string to bytes
            this._data = new TextEncoder().encode(content);
        } else {
            this._data = content;
        }

        this._length = this._data instanceof Blob ? this._data.size : this._data.length;
    }

    async get_bytes(): Promise<Uint8Array> {
        if (this._data instanceof Blob) {
            const arrayBuffer = await this._data.arrayBuffer();
            return new Uint8Array(arrayBuffer);
        }
        return this._data;
    }

    async get_content_type(): Promise<string> {
        return this._contentType;
    }

    get_name(): string | null {
        return this._name;
    }

    async get_url(forceDataUrl: boolean = false): Promise<string | null> {
        if (!forceDataUrl) {
            return null; // BlobMedia doesn't have a permanent URL
        }

        // Create data URL
        const bytes = await this.get_bytes();
        const blob = new Blob([bytes], { type: this._contentType });

        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
        });
    }

    async get_length(): Promise<number> {
        return this._length;
    }
}

// URLMedia Implementation
export class URLMedia extends AnvilMedia {
    private _sourceUrl: string;
    private _fetchPromise: Promise<{ data: ArrayBuffer; contentType: string }> | null = null;

    constructor(url: string) {
        super();
        this._sourceUrl = url;
        this._url = url;

        // Extract name from URL
        if (url.startsWith('data:')) {
            // For data URLs, extract the data part after base64,
            const base64Match = url.match(/;base64,(.+)$/);
            this._name = base64Match ? base64Match[1] : null;
        } else {
            const urlParts = url.replace(/\/+$/, '').split('/');
            this._name = urlParts.length > 0 ? urlParts[urlParts.length - 1] : null;
        }
    }

    private async doFetch(): Promise<{ data: ArrayBuffer; contentType: string }> {
        if (this._fetchPromise) {
            return this._fetchPromise;
        }

        this._fetchPromise = (async () => {
            if (this._sourceUrl.startsWith('data:')) {
                // Handle data URLs
                const parts = this._sourceUrl.split(';base64,');
                const contentType = parts[0].substring(5);
                const base64Data = parts[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                return { data: bytes.buffer, contentType };
            } else {
                // Fetch from URL
                const response = await fetch(this._sourceUrl);
                if (!response.ok) {
                    throw new Error(`Failed to load media (HTTP ${response.status}): ${this._sourceUrl}`);
                }
                const data = await response.arrayBuffer();
                const contentType = response.headers.get('content-type') || 'application/octet-stream';
                return { data, contentType };
            }
        })();

        return this._fetchPromise;
    }

    async get_bytes(): Promise<Uint8Array> {
        const { data } = await this.doFetch();
        return new Uint8Array(data);
    }

    async get_content_type(): Promise<string> {
        if (this._contentType) {
            return this._contentType;
        }
        const { contentType } = await this.doFetch();
        this._contentType = contentType;
        return contentType;
    }

    get_name(): string | null {
        return this._name;
    }

    async get_url(): Promise<string> {
        return this._sourceUrl;
    }

    async get_length(): Promise<number> {
        if (this._length === 0) {
            const bytes = await this.get_bytes();
            this._length = bytes.length;
        }
        return this._length;
    }
}

// FileMedia Implementation (for files from FileLoader components)
export class FileMedia extends BlobMedia {
    constructor(file: File) {
        super(file.type, file, { name: file.name });
    }
}

// LazyMedia Implementation (for server-provided media)
export interface LazyMediaSpec {
    id: string;
    key: string;
    manager: string;
    name?: string;
    'mime-type'?: string;
}

export class LazyMedia extends AnvilMedia {
    private _spec: LazyMediaSpec;
    private _fetchedMedia: BlobMedia | null = null;

    constructor(spec: LazyMediaSpec) {
        super();
        this._spec = spec;
        this._name = spec.name || null;
        this._contentType = spec['mime-type'] || '';
    }

    private async fetchMedia(): Promise<BlobMedia> {
        if (this._fetchedMedia) {
            return this._fetchedMedia;
        }

        // Use server call to fetch lazy media
        const { serverCall } = await import('../server/anvil-server-calls');

        const result = await serverCall('anvil.private.fetch_lazy_media', [this._spec]);
        this._fetchedMedia = result as BlobMedia;
        return this._fetchedMedia;
    }

    async get_bytes(): Promise<Uint8Array> {
        const media = await this.fetchMedia();
        return media.get_bytes();
    }

    async get_content_type(): Promise<string> {
        return this._contentType || 'application/octet-stream';
    }

    get_name(): string | null {
        return this._name;
    }

    async get_url(download: boolean = true): Promise<string> {
        // Construct LazyMedia URL using environment variables
        const appOrigin = process.env.NEXT_PUBLIC_ANVIL_SERVER_URL || 'http://localhost:3030';
        const sessionToken = typeof window !== 'undefined'
            ? (window as any).anvilSessionToken || ''
            : '';

        const downloadParam = download ? '' : '&nodl=1';
        return `${appOrigin}/_/lm/${encodeURIComponent(this._spec.manager)}/${encodeURIComponent(this._spec.key)}/${encodeURIComponent(this._spec.id)}/${encodeURIComponent(this._spec.name || '')}?_anvil_session=${sessionToken}${downloadParam}`;
    }

    async get_length(): Promise<number> {
        if (this._length === 0) {
            const bytes = await this.get_bytes();
            this._length = bytes.length;
        }
        return this._length;
    }
}

// TempUrl Implementation
export class TempUrl {
    private media: AnvilMedia;
    private options: TempUrlOptions;
    private _url: string | null = null;
    private _blob: Blob | null = null;

    constructor(media: AnvilMedia, options: TempUrlOptions = {}) {
        this.media = media;
        this.options = { download: true, ...options };
    }

    async getUrl(): Promise<string> {
        if (this._url) {
            return this._url;
        }

        // Check if media already has a permanent URL
        const permanentUrl = await this.media.get_url();
        if (permanentUrl) {
            this._url = permanentUrl;
            return this._url;
        }

        // Create blob URL for media without permanent URL
        const bytes = await this.media.get_bytes();
        const contentType = await this.media.get_content_type();
        this._blob = new Blob([bytes], { type: contentType });
        this._url = URL.createObjectURL(this._blob);

        return this._url;
    }

    revoke(): void {
        if (this._url && this._blob) {
            URL.revokeObjectURL(this._url);
            this._url = null;
            this._blob = null;
        }
    }

    // Context manager support (for use with async/await)
    async __enter__(): Promise<string> {
        return this.getUrl();
    }

    __exit__(): void {
        this.revoke();
    }

    get url(): Promise<string> {
        return this.getUrl();
    }
}

// Utility Functions

/**
 * Download a media object immediately in the user's browser
 */
export async function download(media: AnvilMedia): Promise<void> {
    const tempUrl = new TempUrl(media);

    try {
        const url = await tempUrl.getUrl();
        const filename = media.get_name() || 'download';

        // Create download link and trigger click
        const a = document.createElement('a');
        document.body.appendChild(a);
        a.href = url;
        a.download = filename;
        a.style.display = 'none';
        a.click();

        // Clean up
        setTimeout(() => {
            document.body.removeChild(a);
            tempUrl.revoke();
        }, 0);
    } catch (error) {
        tempUrl.revoke();
        throw error;
    }
}

/**
 * Print a media object immediately in the user's browser
 */
export async function print_media(media: AnvilMedia): Promise<void> {
    const tempUrl = new TempUrl(media);

    try {
        const url = await tempUrl.getUrl();

        // Open in new window and print
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
            printWindow.onload = () => {
                printWindow.print();
                setTimeout(() => {
                    printWindow.close();
                    tempUrl.revoke();
                }, 100);
            };
        } else {
            throw new Error('Could not open print window');
        }
    } catch (error) {
        tempUrl.revoke();
        throw error;
    }
}

/**
 * Create a Media object from a file (browser-side implementation)
 * Note: This is limited compared to server-side due to browser security
 */
export function from_file(file: File, mimeType?: string, name?: string): BlobMedia {
    const finalMimeType = mimeType || file.type;
    const finalName = name || file.name;

    return new BlobMedia(finalMimeType, file, { name: finalName });
}

/**
 * Write a Media object to a file (download in browser)
 */
export async function write_to_file(media: AnvilMedia, filename: string): Promise<void> {
    // In browser, this becomes a download with specified filename
    const originalName = media.get_name();

    // Temporarily override the name for download
    if (media instanceof BlobMedia) {
        (media as any)._name = filename;
    }

    try {
        await download(media);
    } finally {
        // Restore original name
        if (media instanceof BlobMedia) {
            (media as any)._name = originalName;
        }
    }
}

/**
 * Open a media file as a Blob (browser equivalent of BytesIO)
 */
export async function open(media: AnvilMedia): Promise<Blob> {
    const bytes = await media.get_bytes();
    const contentType = await media.get_content_type();
    return new Blob([bytes], { type: contentType });
}

/**
 * Create a temporary file initialized with media content
 * Note: Browser implementation returns a Blob URL instead of file path
 */
export class TempFile {
    private media: AnvilMedia | null;
    private _blob: Blob | null = null;
    private _url: string | null = null;

    constructor(media?: AnvilMedia) {
        this.media = media || null;
    }

    async __enter__(): Promise<string> {
        if (this.media) {
            this._blob = await open(this.media);
            this._url = URL.createObjectURL(this._blob);
            return this._url;
        } else {
            // Create empty blob
            this._blob = new Blob([], { type: 'application/octet-stream' });
            this._url = URL.createObjectURL(this._blob);
            return this._url;
        }
    }

    __exit__(): void {
        if (this._url) {
            URL.revokeObjectURL(this._url);
            this._url = null;
            this._blob = null;
        }
    }
}

// Main media module export
export const media = {
    // Classes
    BlobMedia,
    URLMedia,
    FileMedia,
    LazyMedia,
    TempUrl,
    TempFile,

    // Utility functions
    download,
    print_media,
    from_file,
    write_to_file,
    open,

    // Type exports for external use
    AnvilMedia,
};

// Default export for easier importing
export default media; 