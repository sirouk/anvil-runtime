import { AnvilStateValue, AnvilDataBinding } from './anvil-state-context';

/**
 * Data Binding Utilities
 * 
 * Provides utilities for managing data synchronization between Anvil components
 * and server-side data, including transformation, validation, and conflict resolution.
 */

// Data binding direction types
export type BindingDirection = 'one-way' | 'two-way' | 'server-to-client' | 'client-to-server';

// Binding transformation functions
export type BindingTransformer<TClient = any, TServer = any> = {
    toServer?: (clientValue: TClient) => TServer;
    toClient?: (serverValue: TServer) => TClient;
};

// Binding validation function
export type BindingValidator<T = any> = (value: T) => string | null;

// Binding conflict resolution strategy
export type ConflictResolution =
    | 'client-wins'      // Client value takes precedence
    | 'server-wins'      // Server value takes precedence
    | 'merge'           // Attempt to merge values
    | 'prompt-user'     // Ask user to resolve conflict
    | 'timestamp'       // Most recent change wins
    | 'custom';         // Use custom resolution function

// Enhanced data binding configuration
export interface EnhancedDataBinding<TClient = any, TServer = any> extends Omit<AnvilDataBinding, 'direction'> {
    // Enhanced direction options
    direction: BindingDirection;

    // Type-safe transformers
    transformer?: BindingTransformer<TClient, TServer>;

    // Validation for both directions
    clientValidation?: BindingValidator<TClient>;
    serverValidation?: BindingValidator<TServer>;

    // Conflict resolution
    conflictResolution?: ConflictResolution;
    customResolver?: (clientValue: TClient, serverValue: TServer, timestamp: { client: number, server: number }) => TClient | TServer;

    // Debouncing
    debounceMs?: number;

    // Conditions for when binding should be active
    condition?: () => boolean;

    // Custom equality check
    isEqual?: (a: any, b: any) => boolean;

    // Metadata
    description?: string;
    category?: string;
}

// Binding synchronization status
export interface BindingSyncStatus {
    componentId: string;
    property: string;
    lastClientChange: number;
    lastServerChange: number;
    lastSync: number;
    isDirty: boolean;
    isConflicted: boolean;
    error?: string;
    pendingValue?: any;
}

// Data binding manager class
export class DataBindingManager {
    private bindings = new Map<string, EnhancedDataBinding>();
    private syncStatuses = new Map<string, BindingSyncStatus>();
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    private eventListeners: ((event: BindingSyncEvent) => void)[] = [];

    /**
     * Register a data binding
     */
    registerBinding(binding: EnhancedDataBinding): void {
        const key = this.getBindingKey(binding.componentId, binding.property);

        // Clean up existing binding
        if (this.bindings.has(key)) {
            this.unregisterBinding(binding.componentId, binding.property);
        }

        this.bindings.set(key, binding);
        this.syncStatuses.set(key, {
            componentId: binding.componentId,
            property: binding.property,
            lastClientChange: 0,
            lastServerChange: 0,
            lastSync: 0,
            isDirty: false,
            isConflicted: false
        });

        this.emitEvent({
            type: 'binding-registered',
            componentId: binding.componentId,
            property: binding.property,
            binding,
            timestamp: Date.now()
        });
    }

    /**
     * Unregister a data binding
     */
    unregisterBinding(componentId: string, property: string): void {
        const key = this.getBindingKey(componentId, property);

        // Clear debounce timer
        const timer = this.debounceTimers.get(key);
        if (timer) {
            clearTimeout(timer);
            this.debounceTimers.delete(key);
        }

        this.bindings.delete(key);
        this.syncStatuses.delete(key);

        this.emitEvent({
            type: 'binding-unregistered',
            componentId,
            property,
            timestamp: Date.now()
        });
    }

    /**
     * Sync client value to server
     */
    async syncClientToServer(
        componentId: string,
        property: string,
        clientValue: any,
        serverData: Record<string, any>
    ): Promise<{ success: boolean; error?: string; newServerValue?: any }> {
        const key = this.getBindingKey(componentId, property);
        const binding = this.bindings.get(key);
        const status = this.syncStatuses.get(key);

        if (!binding || !status) {
            return { success: false, error: 'Binding not found' };
        }

        // Check if binding is active
        if (binding.condition && !binding.condition()) {
            return { success: true }; // Skip sync if condition not met
        }

        // Check direction
        if (binding.direction === 'server-to-client') {
            return { success: true }; // Skip client-to-server for one-way server bindings
        }

        try {
            // Validate client value
            if (binding.clientValidation) {
                const validationError = binding.clientValidation(clientValue);
                if (validationError) {
                    status.error = validationError;
                    return { success: false, error: validationError };
                }
            }

            // Transform client value to server format
            let serverValue = clientValue;
            if (binding.transformer?.toServer) {
                serverValue = binding.transformer.toServer(clientValue);
            }

            // Validate server value
            if (binding.serverValidation) {
                const validationError = binding.serverValidation(serverValue);
                if (validationError) {
                    status.error = validationError;
                    return { success: false, error: validationError };
                }
            }

            // Check for conflicts
            const currentServerValue = this.getNestedValue(serverData, binding.serverPath);
            if (currentServerValue !== undefined && status.lastServerChange > status.lastClientChange) {
                // Potential conflict
                const resolution = await this.resolveConflict(
                    binding,
                    clientValue,
                    currentServerValue,
                    { client: status.lastClientChange, server: status.lastServerChange }
                );

                if (resolution.isConflicted) {
                    status.isConflicted = true;
                    this.emitEvent({
                        type: 'conflict-detected',
                        componentId,
                        property,
                        clientValue,
                        serverValue: currentServerValue,
                        timestamp: Date.now()
                    });
                    return { success: false, error: 'Conflict detected' };
                }

                serverValue = resolution.resolvedValue;
            }

            // Update server data
            this.setNestedValue(serverData, binding.serverPath, serverValue);

            // Update sync status
            status.lastSync = Date.now();
            status.isDirty = false;
            status.isConflicted = false;
            status.error = undefined;

            this.emitEvent({
                type: 'client-to-server-sync',
                componentId,
                property,
                clientValue,
                serverValue,
                timestamp: Date.now()
            });

            return { success: true, newServerValue: serverValue };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
            status.error = errorMessage;
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Sync server value to client
     */
    async syncServerToClient(
        componentId: string,
        property: string,
        serverData: Record<string, any>
    ): Promise<{ success: boolean; error?: string; newClientValue?: any }> {
        const key = this.getBindingKey(componentId, property);
        const binding = this.bindings.get(key);
        const status = this.syncStatuses.get(key);

        if (!binding || !status) {
            return { success: false, error: 'Binding not found' };
        }

        // Check if binding is active
        if (binding.condition && !binding.condition()) {
            return { success: true }; // Skip sync if condition not met
        }

        // Check direction
        if (binding.direction === 'client-to-server') {
            return { success: true }; // Skip server-to-client for one-way client bindings
        }

        try {
            // Get server value
            const serverValue = this.getNestedValue(serverData, binding.serverPath);
            if (serverValue === undefined) {
                return { success: true }; // No server value to sync
            }

            // Validate server value
            if (binding.serverValidation) {
                const validationError = binding.serverValidation(serverValue);
                if (validationError) {
                    status.error = validationError;
                    return { success: false, error: validationError };
                }
            }

            // Transform server value to client format
            let clientValue = serverValue;
            if (binding.transformer?.toClient) {
                clientValue = binding.transformer.toClient(serverValue);
            }

            // Validate client value
            if (binding.clientValidation) {
                const validationError = binding.clientValidation(clientValue);
                if (validationError) {
                    status.error = validationError;
                    return { success: false, error: validationError };
                }
            }

            // Update sync status
            status.lastServerChange = Date.now();
            status.lastSync = Date.now();
            status.error = undefined;

            this.emitEvent({
                type: 'server-to-client-sync',
                componentId,
                property,
                serverValue,
                clientValue,
                timestamp: Date.now()
            });

            return { success: true, newClientValue: clientValue };

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown sync error';
            status.error = errorMessage;
            return { success: false, error: errorMessage };
        }
    }

    /**
     * Handle client property change with debouncing
     */
    handleClientChange(
        componentId: string,
        property: string,
        newValue: any,
        serverData: Record<string, any>
    ): void {
        const key = this.getBindingKey(componentId, property);
        const binding = this.bindings.get(key);
        const status = this.syncStatuses.get(key);

        if (!binding || !status) return;

        // Update client change timestamp
        status.lastClientChange = Date.now();
        status.isDirty = true;

        // Handle debouncing
        if (binding.debounceMs && binding.debounceMs > 0) {
            // Clear existing timer
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            // Set new timer
            const timer = setTimeout(() => {
                this.syncClientToServer(componentId, property, newValue, serverData);
                this.debounceTimers.delete(key);
            }, binding.debounceMs);

            this.debounceTimers.set(key, timer);
        } else {
            // Immediate sync
            this.syncClientToServer(componentId, property, newValue, serverData);
        }
    }

    /**
     * Get all bindings for a component
     */
    getComponentBindings(componentId: string): EnhancedDataBinding[] {
        return Array.from(this.bindings.values()).filter(
            binding => binding.componentId === componentId
        );
    }

    /**
     * Get sync status for a binding
     */
    getSyncStatus(componentId: string, property: string): BindingSyncStatus | undefined {
        const key = this.getBindingKey(componentId, property);
        return this.syncStatuses.get(key);
    }

    /**
     * Get all sync statuses
     */
    getAllSyncStatuses(): BindingSyncStatus[] {
        return Array.from(this.syncStatuses.values());
    }

    /**
     * Force sync all bindings for a component
     */
    async forceSyncComponent(componentId: string, serverData: Record<string, any>): Promise<void> {
        const bindings = this.getComponentBindings(componentId);

        for (const binding of bindings) {
            if (binding.direction === 'two-way' || binding.direction === 'server-to-client') {
                await this.syncServerToClient(componentId, binding.property, serverData);
            }
        }
    }

    /**
     * Clear all dirty states
     */
    markAllClean(): void {
        this.syncStatuses.forEach(status => {
            status.isDirty = false;
            status.isConflicted = false;
            status.error = undefined;
        });
    }

    /**
     * Add event listener
     */
    addEventListener(listener: (event: BindingSyncEvent) => void): () => void {
        this.eventListeners.push(listener);
        return () => {
            this.eventListeners = this.eventListeners.filter(l => l !== listener);
        };
    }

    // Private helper methods
    private getBindingKey(componentId: string, property: string): string {
        return `${componentId}.${property}`;
    }

    private getNestedValue(obj: any, path: string): any {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    private setNestedValue(obj: any, path: string, value: any): void {
        const keys = path.split('.');
        const lastKey = keys.pop()!;

        const target = keys.reduce((current, key) => {
            if (current[key] === undefined) {
                current[key] = {};
            }
            return current[key];
        }, obj);

        target[lastKey] = value;
    }

    private async resolveConflict(
        binding: EnhancedDataBinding,
        clientValue: any,
        serverValue: any,
        timestamps: { client: number; server: number }
    ): Promise<{ isConflicted: boolean; resolvedValue: any }> {
        const strategy = binding.conflictResolution || 'timestamp';

        switch (strategy) {
            case 'client-wins':
                return { isConflicted: false, resolvedValue: clientValue };

            case 'server-wins':
                return { isConflicted: false, resolvedValue: serverValue };

            case 'timestamp':
                const resolvedValue = timestamps.client > timestamps.server ? clientValue : serverValue;
                return { isConflicted: false, resolvedValue };

            case 'merge':
                // Simple merge for objects, client wins for primitives
                if (typeof clientValue === 'object' && typeof serverValue === 'object') {
                    const merged = { ...serverValue, ...clientValue };
                    return { isConflicted: false, resolvedValue: merged };
                }
                return { isConflicted: false, resolvedValue: clientValue };

            case 'custom':
                if (binding.customResolver) {
                    const resolved = binding.customResolver(clientValue, serverValue, timestamps);
                    return { isConflicted: false, resolvedValue: resolved };
                }
            // Fall through to prompt-user if no custom resolver

            case 'prompt-user':
            default:
                return { isConflicted: true, resolvedValue: clientValue };
        }
    }

    private emitEvent(event: BindingSyncEvent): void {
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in binding event listener:', error);
            }
        });
    }
}

// Event types for data binding
export interface BindingSyncEvent {
    type: 'binding-registered' | 'binding-unregistered' | 'client-to-server-sync' | 'server-to-client-sync' | 'conflict-detected' | 'sync-error';
    componentId: string;
    property: string;
    clientValue?: any;
    serverValue?: any;
    binding?: EnhancedDataBinding;
    error?: string;
    timestamp: number;
}

// Common data transformers
export const CommonTransformers = {
    // String transformations
    uppercase: {
        toServer: (value: string) => value?.toUpperCase(),
        toClient: (value: string) => value?.toLowerCase()
    } as BindingTransformer<string, string>,

    // Number transformations
    percentage: {
        toServer: (value: number) => value / 100,
        toClient: (value: number) => value * 100
    } as BindingTransformer<number, number>,

    // Date transformations
    dateToISOString: {
        toServer: (value: Date) => value?.toISOString(),
        toClient: (value: string) => value ? new Date(value) : null
    } as BindingTransformer<Date, string>,

    // Array transformations
    csvToArray: {
        toServer: (value: string[]) => value?.join(','),
        toClient: (value: string) => value?.split(',').filter(Boolean) || []
    } as BindingTransformer<string[], string>,

    // Currency transformations
    centsToDollars: {
        toServer: (value: number) => Math.round(value * 100),
        toClient: (value: number) => value / 100
    } as BindingTransformer<number, number>
};

// Common validators
export const CommonValidators = {
    required: (value: any): string | null => {
        return (value === null || value === undefined || value === '') ? 'This field is required' : null;
    },

    email: (value: string): string | null => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return value && !emailRegex.test(value) ? 'Please enter a valid email address' : null;
    },

    minLength: (min: number) => (value: string): string | null => {
        return value && value.length < min ? `Must be at least ${min} characters` : null;
    },

    maxLength: (max: number) => (value: string): string | null => {
        return value && value.length > max ? `Must be no more than ${max} characters` : null;
    },

    numeric: (value: any): string | null => {
        return value !== null && value !== undefined && isNaN(Number(value)) ? 'Must be a number' : null;
    },

    range: (min: number, max: number) => (value: number): string | null => {
        const num = Number(value);
        if (isNaN(num)) return 'Must be a number';
        if (num < min || num > max) return `Must be between ${min} and ${max}`;
        return null;
    }
};

// Create singleton instance
export const dataBindingManager = new DataBindingManager(); 