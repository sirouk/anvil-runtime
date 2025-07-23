// Optional: configure or set up a testing framework before each test.
// If you delete this file, remove `setupFilesAfterEnv` from `jest.config.js`

// Used for __tests__/testing-library.js
// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfills for Web APIs
const { TextEncoder, TextDecoder } = require('util');

// Add TextEncoder and TextDecoder to global scope
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock File API for file upload tests
global.File = class File {
    constructor(bits, filename, options = {}) {
        this.name = filename;
        this.type = options.type || '';
        this.lastModified = options.lastModified || Date.now();
        this.size = 0;
        this._bits = bits;

        // Calculate size
        if (bits && Array.isArray(bits)) {
            this.size = bits.reduce((total, bit) => {
                if (typeof bit === 'string') {
                    return total + new TextEncoder().encode(bit).length;
                } else if (bit instanceof ArrayBuffer) {
                    return total + bit.byteLength;
                } else if (bit && typeof bit.length === 'number') {
                    return total + bit.length;
                }
                return total;
            }, 0);
        }
    }

    async arrayBuffer() {
        const chunks = [];
        for (const bit of this._bits) {
            if (typeof bit === 'string') {
                chunks.push(new TextEncoder().encode(bit));
            } else if (bit instanceof ArrayBuffer) {
                chunks.push(new Uint8Array(bit));
            } else if (bit instanceof Uint8Array) {
                chunks.push(bit);
            }
        }

        const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
        const result = new ArrayBuffer(totalLength);
        const view = new Uint8Array(result);
        let offset = 0;

        for (const chunk of chunks) {
            view.set(chunk, offset);
            offset += chunk.length;
        }

        return result;
    }

    async text() {
        const buffer = await this.arrayBuffer();
        return new TextDecoder().decode(buffer);
    }

    stream() {
        const self = this;
        return new ReadableStream({
            async start(controller) {
                const buffer = await self.arrayBuffer();
                controller.enqueue(new Uint8Array(buffer));
                controller.close();
            }
        });
    }
};

// Mock FormData for file upload tests
global.FormData = class FormData {
    constructor() {
        this._data = new Map();
    }

    append(name, value, filename) {
        if (!this._data.has(name)) {
            this._data.set(name, []);
        }
        this._data.get(name).push({ value, filename });
    }

    get(name) {
        const values = this._data.get(name);
        return values && values.length > 0 ? values[0].value : null;
    }

    getAll(name) {
        const values = this._data.get(name);
        return values ? values.map(item => item.value) : [];
    }

    has(name) {
        return this._data.has(name);
    }

    set(name, value, filename) {
        this._data.set(name, [{ value, filename }]);
    }

    delete(name) {
        this._data.delete(name);
    }

    *entries() {
        for (const [name, values] of this._data) {
            for (const { value } of values) {
                yield [name, value];
            }
        }
    }

    *keys() {
        for (const name of this._data.keys()) {
            yield name;
        }
    }

    *values() {
        for (const [name, values] of this._data) {
            for (const { value } of values) {
                yield value;
            }
        }
    }

    [Symbol.iterator]() {
        return this.entries();
    }
};

// Mock ReadableStream
global.ReadableStream = class ReadableStream {
    constructor(underlyingSource) {
        this._underlyingSource = underlyingSource;
        this._controller = {
            enqueue: (chunk) => {
                this._chunks = this._chunks || [];
                this._chunks.push(chunk);
            },
            close: () => {
                this._closed = true;
            }
        };

        if (underlyingSource && underlyingSource.start) {
            underlyingSource.start(this._controller);
        }
    }

    async *[Symbol.asyncIterator]() {
        if (this._chunks) {
            for (const chunk of this._chunks) {
                yield chunk;
            }
        }
    }
};

// Mock Next.js router if needed
jest.mock('next/router', () => ({
    useRouter() {
        return {
            route: '/',
            pathname: '/',
            query: {},
            asPath: '/',
            push: jest.fn(),
            pop: jest.fn(),
            reload: jest.fn(),
            back: jest.fn(),
            prefetch: jest.fn(),
            beforePopState: jest.fn(),
            events: {
                on: jest.fn(),
                off: jest.fn(),
                emit: jest.fn(),
            },
        }
    },
}))

// Mock window.matchMedia for responsive components
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
    })),
})

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn(),
}))

// Suppress console warnings during tests unless debugging
const originalConsoleWarn = console.warn
console.warn = (...args) => {
    // Suppress specific warnings
    if (
        typeof args[0] === 'string' &&
        (args[0].includes('Warning: ReactDOM.render is deprecated') ||
            args[0].includes('Warning: findDOMNode is deprecated'))
    ) {
        return
    }
    originalConsoleWarn(...args)
} 