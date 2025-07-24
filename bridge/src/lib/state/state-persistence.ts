import { AnvilAppState, AnvilFormState, AnvilComponentState } from './anvil-state-context';

/**
 * State Persistence System
 * 
 * Handles saving and restoring Anvil application state across page reloads.
 * Provides compression, encryption, selective persistence, and storage management.
 */

// Storage strategies
export type StorageStrategy = 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cookies' | 'url' | 'server';

// Persistence configuration
export interface PersistenceConfig {
    // Storage strategy
    strategy: StorageStrategy;

    // Storage key/namespace
    key: string;

    // What to persist
    include?: {
        forms?: string[] | 'all'; // Specific forms or all
        components?: string[] | 'all'; // Specific components or all
        serverData?: boolean;
        globalData?: boolean;
        user?: boolean;
        session?: boolean;
    };

    // What to exclude from persistence
    exclude?: {
        forms?: string[];
        components?: string[];
        properties?: string[]; // Component properties to exclude
    };

    // Compression and encryption
    compress?: boolean;
    encrypt?: boolean;
    encryptionKey?: string;

    // Expiration and versioning
    expirationMs?: number; // How long to keep persisted data
    version?: string; // For migration handling

    // Performance options
    debounceMs?: number; // Debounce saves
    maxSize?: number; // Maximum storage size in bytes

    // Selective persistence conditions
    condition?: (state: AnvilAppState) => boolean;

    // Transformation hooks
    beforeSave?: (state: AnvilAppState) => AnvilAppState;
    afterLoad?: (state: AnvilAppState) => AnvilAppState;
}

// Persisted state metadata
export interface PersistedStateMetadata {
    timestamp: number;
    version: string;
    checksum?: string;
    compressed: boolean;
    encrypted: boolean;
    size: number;
    expiresAt?: number;
}

// Persistence result
export interface PersistenceResult {
    success: boolean;
    error?: string;
    size?: number;
    compressed?: boolean;
    encrypted?: boolean;
    strategy: StorageStrategy;
}

// Storage interface for different strategies
interface StorageAdapter {
    save(key: string, data: string, metadata: PersistedStateMetadata): Promise<void>;
    load(key: string): Promise<{ data: string; metadata: PersistedStateMetadata } | null>;
    remove(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
    getSize(key: string): Promise<number>;
    clear(): Promise<void>;
}

// State persistence manager
export class StatePersistenceManager {
    private config: PersistenceConfig;
    private storageAdapter: StorageAdapter;
    private saveTimer?: NodeJS.Timeout;
    private cache = new Map<string, { state: AnvilAppState; timestamp: number }>();

    constructor(config: PersistenceConfig) {
        this.config = {
            compress: true,
            encrypt: false,
            expirationMs: 7 * 24 * 60 * 60 * 1000, // 7 days default
            version: '1.0.0',
            debounceMs: 1000,
            maxSize: 5 * 1024 * 1024, // 5MB default
            ...config
        };

        this.storageAdapter = this.createStorageAdapter(this.config.strategy);
    }

    /**
     * Save application state to persistent storage
     */
    async saveState(state: AnvilAppState): Promise<PersistenceResult> {
        try {
            // Check persistence condition
            if (this.config.condition && !this.config.condition(state)) {
                return { success: true, strategy: this.config.strategy };
            }

            // Apply debouncing
            if (this.config.debounceMs && this.config.debounceMs > 0) {
                if (this.saveTimer) {
                    clearTimeout(this.saveTimer);
                }

                return new Promise((resolve) => {
                    this.saveTimer = setTimeout(async () => {
                        const result = await this.performSave(state);
                        resolve(result);
                    }, this.config.debounceMs);
                });
            }

            return await this.performSave(state);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown save error';
            return {
                success: false,
                error: errorMessage,
                strategy: this.config.strategy
            };
        }
    }

    /**
     * Load application state from persistent storage
     */
    async loadState(): Promise<{ state: AnvilAppState | null; metadata?: PersistedStateMetadata }> {
        try {
            // Check cache first
            const cached = this.cache.get(this.config.key);
            if (cached && Date.now() - cached.timestamp < 60000) { // 1 minute cache
                return { state: cached.state };
            }

            const stored = await this.storageAdapter.load(this.config.key);
            if (!stored) {
                return { state: null };
            }

            // Check expiration
            if (stored.metadata.expiresAt && Date.now() > stored.metadata.expiresAt) {
                await this.removeState();
                return { state: null };
            }

            // Decompress and decrypt
            let stateData = stored.data;

            if (stored.metadata.compressed) {
                stateData = await this.decompress(stateData);
            }

            if (stored.metadata.encrypted) {
                stateData = await this.decrypt(stateData);
            }

            // Parse state
            const parsedState = JSON.parse(stateData) as AnvilAppState;

            // Apply transformation hook
            const finalState = this.config.afterLoad ? this.config.afterLoad(parsedState) : parsedState;

            // Update cache
            this.cache.set(this.config.key, { state: finalState, timestamp: Date.now() });

            return { state: finalState, metadata: stored.metadata };

        } catch (error) {
            console.error('Failed to load persisted state:', error);
            return { state: null };
        }
    }

    /**
     * Remove persisted state
     */
    async removeState(): Promise<void> {
        try {
            await this.storageAdapter.remove(this.config.key);
            this.cache.delete(this.config.key);
        } catch (error) {
            console.error('Failed to remove persisted state:', error);
        }
    }

    /**
     * Check if state exists in storage
     */
    async hasPersistedState(): Promise<boolean> {
        try {
            return await this.storageAdapter.exists(this.config.key);
        } catch (error) {
            return false;
        }
    }

    /**
     * Get size of persisted state
     */
    async getPersistedStateSize(): Promise<number> {
        try {
            return await this.storageAdapter.getSize(this.config.key);
        } catch (error) {
            return 0;
        }
    }

    /**
     * Clear all persisted data
     */
    async clearAll(): Promise<void> {
        try {
            await this.storageAdapter.clear();
            this.cache.clear();
        } catch (error) {
            console.error('Failed to clear persisted data:', error);
        }
    }

    /**
     * Update persistence configuration
     */
    updateConfig(updates: Partial<PersistenceConfig>): void {
        this.config = { ...this.config, ...updates };

        // Create new storage adapter if strategy changed
        if (updates.strategy) {
            this.storageAdapter = this.createStorageAdapter(updates.strategy);
        }
    }

    // Private methods

    private async performSave(state: AnvilAppState): Promise<PersistenceResult> {
        // Filter state based on include/exclude configuration
        const filteredState = this.filterState(state);

        // Apply transformation hook
        const transformedState = this.config.beforeSave ? this.config.beforeSave(filteredState) : filteredState;

        // Serialize state
        let stateData = JSON.stringify(transformedState);
        let compressed = false;
        let encrypted = false;

        // Compress if enabled
        if (this.config.compress) {
            stateData = await this.compress(stateData);
            compressed = true;
        }

        // Encrypt if enabled
        if (this.config.encrypt && this.config.encryptionKey) {
            stateData = await this.encrypt(stateData);
            encrypted = true;
        }

        // Check size limits
        const size = new Blob([stateData]).size;
        if (this.config.maxSize && size > this.config.maxSize) {
            return {
                success: false,
                error: `State size (${size} bytes) exceeds maximum (${this.config.maxSize} bytes)`,
                strategy: this.config.strategy
            };
        }

        // Create metadata
        const metadata: PersistedStateMetadata = {
            timestamp: Date.now(),
            version: this.config.version!,
            compressed,
            encrypted,
            size,
            expiresAt: this.config.expirationMs ? Date.now() + this.config.expirationMs : undefined,
            checksum: await this.calculateChecksum(stateData)
        };

        // Save to storage
        await this.storageAdapter.save(this.config.key, stateData, metadata);

        // Update cache
        this.cache.set(this.config.key, { state: transformedState, timestamp: Date.now() });

        return {
            success: true,
            size,
            compressed,
            encrypted,
            strategy: this.config.strategy
        };
    }

    private filterState(state: AnvilAppState): AnvilAppState {
        const filtered: AnvilAppState = {
            forms: {},
            globalData: state.globalData,
            user: state.user,
            session: state.session,
            currentForm: state.currentForm
        };

        // Filter forms
        const includeAllForms = this.config.include?.forms === 'all' || !this.config.include?.forms;
        const formsToInclude = includeAllForms ? Object.keys(state.forms) : (this.config.include?.forms || []);
        const formsToExclude = this.config.exclude?.forms || [];

        formsToInclude
            .filter(formName => !formsToExclude.includes(formName))
            .forEach(formName => {
                if (state.forms[formName]) {
                    filtered.forms[formName] = this.filterForm(state.forms[formName]);
                }
            });

        // Filter global data
        if (this.config.include?.globalData === false) {
            delete filtered.globalData;
        }

        // Filter user data
        if (this.config.include?.user === false) {
            delete filtered.user;
        }

        // Filter session data
        if (this.config.include?.session === false) {
            delete filtered.session;
        }

        return filtered;
    }

    private filterForm(form: AnvilFormState): AnvilFormState {
        const filtered: AnvilFormState = {
            ...form,
            components: {}
        };

        // Filter components
        const includeAllComponents = this.config.include?.components === 'all' || !this.config.include?.components;
        const componentsToInclude = includeAllComponents ?
            Object.keys(form.components) :
            (this.config.include?.components || []);
        const componentsToExclude = this.config.exclude?.components || [];

        componentsToInclude
            .filter(componentId => !componentsToExclude.includes(componentId))
            .forEach(componentId => {
                if (form.components[componentId]) {
                    filtered.components[componentId] = this.filterComponent(form.components[componentId]);
                }
            });

        // Filter server data
        if (this.config.include?.serverData === false) {
            delete filtered.serverData;
        }

        return filtered;
    }

    private filterComponent(component: AnvilComponentState): AnvilComponentState {
        const filtered: AnvilComponentState = {
            ...component,
            properties: {}
        };

        // Filter properties
        const propertiesToExclude = this.config.exclude?.properties || [];

        Object.entries(component.properties).forEach(([property, value]) => {
            if (!propertiesToExclude.includes(property)) {
                filtered.properties[property] = value;
            }
        });

        return filtered;
    }

    private async compress(data: string): Promise<string> {
        // Simple compression using built-in compression
        // In a real implementation, you might use a library like pako
        try {
            const compressed = await new Promise<string>((resolve, reject) => {
                const stream = new CompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();

                let result = '';

                const pump = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            resolve(btoa(result));
                            return;
                        }
                        result += new TextDecoder().decode(value);
                        pump();
                    }).catch(reject);
                };

                pump();
                writer.write(new TextEncoder().encode(data));
                writer.close();
            });

            return compressed;
        } catch (error) {
            // Fallback to base64 encoding if compression fails
            return btoa(data);
        }
    }

    private async decompress(data: string): Promise<string> {
        try {
            const decompressed = await new Promise<string>((resolve, reject) => {
                const stream = new DecompressionStream('gzip');
                const writer = stream.writable.getWriter();
                const reader = stream.readable.getReader();

                let result = '';

                const pump = () => {
                    reader.read().then(({ done, value }) => {
                        if (done) {
                            resolve(result);
                            return;
                        }
                        result += new TextDecoder().decode(value);
                        pump();
                    }).catch(reject);
                };

                pump();
                writer.write(new Uint8Array(atob(data).split('').map(c => c.charCodeAt(0))));
                writer.close();
            });

            return decompressed;
        } catch (error) {
            // Fallback to base64 decoding if decompression fails
            return atob(data);
        }
    }

    private async encrypt(data: string): Promise<string> {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key required for encryption');
        }

        // Simple encryption using Web Crypto API
        try {
            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(this.config.encryptionKey.padEnd(32, '0').substring(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );

            const iv = crypto.getRandomValues(new Uint8Array(12));
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv },
                key,
                new TextEncoder().encode(data)
            );

            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);

            return btoa(String.fromCharCode(...combined));
        } catch (error) {
            throw new Error('Encryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    private async decrypt(data: string): Promise<string> {
        if (!this.config.encryptionKey) {
            throw new Error('Encryption key required for decryption');
        }

        try {
            const combined = new Uint8Array(atob(data).split('').map(c => c.charCodeAt(0)));
            const iv = combined.slice(0, 12);
            const encrypted = combined.slice(12);

            const key = await crypto.subtle.importKey(
                'raw',
                new TextEncoder().encode(this.config.encryptionKey.padEnd(32, '0').substring(0, 32)),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );

            const decrypted = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                encrypted
            );

            return new TextDecoder().decode(decrypted);
        } catch (error) {
            throw new Error('Decryption failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
        }
    }

    private async calculateChecksum(data: string): Promise<string> {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    private createStorageAdapter(strategy: StorageStrategy): StorageAdapter {
        switch (strategy) {
            case 'localStorage':
                return new LocalStorageAdapter();
            case 'sessionStorage':
                return new SessionStorageAdapter();
            case 'indexedDB':
                return new IndexedDBAdapter();
            case 'cookies':
                return new CookiesAdapter();
            case 'url':
                return new URLAdapter();
            case 'server':
                return new ServerStorageAdapter();
            default:
                return new LocalStorageAdapter();
        }
    }
}

// Storage adapters

class LocalStorageAdapter implements StorageAdapter {
    async save(key: string, data: string, metadata: PersistedStateMetadata): Promise<void> {
        const wrapped = { data, metadata };
        localStorage.setItem(key, JSON.stringify(wrapped));
    }

    async load(key: string): Promise<{ data: string; metadata: PersistedStateMetadata } | null> {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }

    async remove(key: string): Promise<void> {
        localStorage.removeItem(key);
    }

    async exists(key: string): Promise<boolean> {
        return localStorage.getItem(key) !== null;
    }

    async getSize(key: string): Promise<number> {
        const item = localStorage.getItem(key);
        return item ? new Blob([item]).size : 0;
    }

    async clear(): Promise<void> {
        localStorage.clear();
    }
}

class SessionStorageAdapter implements StorageAdapter {
    async save(key: string, data: string, metadata: PersistedStateMetadata): Promise<void> {
        const wrapped = { data, metadata };
        sessionStorage.setItem(key, JSON.stringify(wrapped));
    }

    async load(key: string): Promise<{ data: string; metadata: PersistedStateMetadata } | null> {
        const item = sessionStorage.getItem(key);
        return item ? JSON.parse(item) : null;
    }

    async remove(key: string): Promise<void> {
        sessionStorage.removeItem(key);
    }

    async exists(key: string): Promise<boolean> {
        return sessionStorage.getItem(key) !== null;
    }

    async getSize(key: string): Promise<number> {
        const item = sessionStorage.getItem(key);
        return item ? new Blob([item]).size : 0;
    }

    async clear(): Promise<void> {
        sessionStorage.clear();
    }
}

class IndexedDBAdapter implements StorageAdapter {
    private dbName = 'AnvilStateDB';
    private storeName = 'state';
    private version = 1;

    async save(key: string, data: string, metadata: PersistedStateMetadata): Promise<void> {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        await new Promise<void>((resolve, reject) => {
            const request = store.put({ id: key, data, metadata });
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        db.close();
    }

    async load(key: string): Promise<{ data: string; metadata: PersistedStateMetadata } | null> {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);

        const result = await new Promise<any>((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        db.close();

        return result ? { data: result.data, metadata: result.metadata } : null;
    }

    async remove(key: string): Promise<void> {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        await new Promise<void>((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        db.close();
    }

    async exists(key: string): Promise<boolean> {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);

        const result = await new Promise<any>((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });

        db.close();

        return !!result;
    }

    async getSize(key: string): Promise<number> {
        const item = await this.load(key);
        return item ? new Blob([JSON.stringify(item)]).size : 0;
    }

    async clear(): Promise<void> {
        const db = await this.openDB();
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);

        await new Promise<void>((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });

        db.close();
    }

    private openDB(): Promise<IDBDatabase> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'id' });
                }
            };
        });
    }
}

class CookiesAdapter implements StorageAdapter {
    async save(key: string, data: string, metadata: PersistedStateMetadata): Promise<void> {
        const wrapped = JSON.stringify({ data, metadata });
        const expires = metadata.expiresAt ? new Date(metadata.expiresAt).toUTCString() : '';
        document.cookie = `${key}=${encodeURIComponent(wrapped)}; expires=${expires}; path=/; SameSite=Strict`;
    }

    async load(key: string): Promise<{ data: string; metadata: PersistedStateMetadata } | null> {
        const cookies = document.cookie.split(';');
        const cookie = cookies.find(c => c.trim().startsWith(`${key}=`));

        if (!cookie) return null;

        const value = decodeURIComponent(cookie.split('=')[1]);
        return JSON.parse(value);
    }

    async remove(key: string): Promise<void> {
        document.cookie = `${key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    }

    async exists(key: string): Promise<boolean> {
        return document.cookie.split(';').some(c => c.trim().startsWith(`${key}=`));
    }

    async getSize(key: string): Promise<number> {
        const item = await this.load(key);
        return item ? new Blob([JSON.stringify(item)]).size : 0;
    }

    async clear(): Promise<void> {
        // Clear all cookies (this is dangerous in a real app)
        document.cookie.split(';').forEach(cookie => {
            const name = cookie.split('=')[0].trim();
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
        });
    }
}

class URLAdapter implements StorageAdapter {
    async save(key: string, data: string, metadata: PersistedStateMetadata): Promise<void> {
        const wrapped = JSON.stringify({ data, metadata });
        const compressed = btoa(wrapped);

        const url = new URL(window.location.href);
        url.searchParams.set(key, compressed);

        // Update URL without page reload
        window.history.replaceState({}, '', url.toString());
    }

    async load(key: string): Promise<{ data: string; metadata: PersistedStateMetadata } | null> {
        const url = new URL(window.location.href);
        const compressed = url.searchParams.get(key);

        if (!compressed) return null;

        try {
            const wrapped = atob(compressed);
            return JSON.parse(wrapped);
        } catch (error) {
            return null;
        }
    }

    async remove(key: string): Promise<void> {
        const url = new URL(window.location.href);
        url.searchParams.delete(key);
        window.history.replaceState({}, '', url.toString());
    }

    async exists(key: string): Promise<boolean> {
        const url = new URL(window.location.href);
        return url.searchParams.has(key);
    }

    async getSize(key: string): Promise<number> {
        const item = await this.load(key);
        return item ? new Blob([JSON.stringify(item)]).size : 0;
    }

    async clear(): Promise<void> {
        const url = new URL(window.location.href);
        url.search = '';
        window.history.replaceState({}, '', url.toString());
    }
}

class ServerStorageAdapter implements StorageAdapter {
    private baseUrl: string;

    constructor(baseUrl: string = '/api/state') {
        this.baseUrl = baseUrl;
    }

    async save(key: string, data: string, metadata: PersistedStateMetadata): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${key}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, metadata })
        });

        if (!response.ok) {
            throw new Error(`Server save failed: ${response.statusText}`);
        }
    }

    async load(key: string): Promise<{ data: string; metadata: PersistedStateMetadata } | null> {
        try {
            const response = await fetch(`${this.baseUrl}/${key}`);

            if (response.status === 404) {
                return null;
            }

            if (!response.ok) {
                throw new Error(`Server load failed: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            return null;
        }
    }

    async remove(key: string): Promise<void> {
        const response = await fetch(`${this.baseUrl}/${key}`, {
            method: 'DELETE'
        });

        if (!response.ok && response.status !== 404) {
            throw new Error(`Server remove failed: ${response.statusText}`);
        }
    }

    async exists(key: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/${key}`, {
                method: 'HEAD'
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    async getSize(key: string): Promise<number> {
        try {
            const response = await fetch(`${this.baseUrl}/${key}`, {
                method: 'HEAD'
            });

            if (!response.ok) return 0;

            const contentLength = response.headers.get('Content-Length');
            return contentLength ? parseInt(contentLength, 10) : 0;
        } catch (error) {
            return 0;
        }
    }

    async clear(): Promise<void> {
        const response = await fetch(this.baseUrl, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Server clear failed: ${response.statusText}`);
        }
    }
}

// Utility functions for common persistence scenarios

export const PersistencePresets = {
    /**
     * Persist everything to localStorage with compression
     */
    everything: (key: string): PersistenceConfig => ({
        strategy: 'localStorage',
        key,
        include: {
            forms: 'all',
            components: 'all',
            serverData: true,
            globalData: true,
            user: true,
            session: true
        },
        compress: true,
        encrypt: false,
        expirationMs: 30 * 24 * 60 * 60 * 1000 // 30 days
    }),

    /**
     * Persist only form data for the current session
     */
    sessionOnly: (key: string): PersistenceConfig => ({
        strategy: 'sessionStorage',
        key,
        include: {
            forms: 'all',
            serverData: false,
            globalData: false,
            user: false,
            session: false
        },
        compress: true,
        encrypt: false
    }),

    /**
     * Persist user-specific data with encryption
     */
    userDataSecure: (key: string, encryptionKey: string): PersistenceConfig => ({
        strategy: 'indexedDB',
        key,
        include: {
            forms: 'all',
            serverData: true,
            globalData: true,
            user: true,
            session: false
        },
        compress: true,
        encrypt: true,
        encryptionKey,
        expirationMs: 7 * 24 * 60 * 60 * 1000 // 7 days
    }),

    /**
     * Minimal persistence for quick recovery
     */
    minimal: (key: string): PersistenceConfig => ({
        strategy: 'localStorage',
        key,
        include: {
            forms: 'all',
            serverData: false,
            globalData: false,
            user: false,
            session: false
        },
        exclude: {
            properties: ['internal', 'temp', 'computed']
        },
        compress: true,
        encrypt: false,
        expirationMs: 24 * 60 * 60 * 1000 // 1 day
    })
}; 