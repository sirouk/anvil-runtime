/**
 * Anvil Event System
 * 
 * Comprehensive event handling system for Anvil components
 * Supports custom events, event propagation, bubbling, and lifecycle events
 */

export interface AnvilEvent {
    type: string;
    target: AnvilComponent | null;
    currentTarget: AnvilComponent | null;
    timestamp: number;
    bubbles: boolean;
    cancelable: boolean;
    defaultPrevented: boolean;
    stopPropagation: boolean;
    stopImmediatePropagation: boolean;
    data?: any;
    originalEvent?: Event;
}

export interface AnvilComponent {
    id: string;
    type: string;
    parent?: AnvilComponent;
    children: AnvilComponent[];
    eventListeners: Map<string, AnvilEventListener[]>;
    properties: Record<string, any>;
    mounted: boolean;
}

export interface AnvilEventListener {
    type: string;
    handler: (event: AnvilEvent) => void | Promise<void>;
    options: AnvilEventListenerOptions;
    id: string;
}

export interface AnvilEventListenerOptions {
    once?: boolean;
    capture?: boolean;
    passive?: boolean;
    priority?: number; // Higher numbers = higher priority
}

export interface ComponentEventConfig {
    componentType: string;
    events: {
        [eventType: string]: {
            bubbles?: boolean;
            cancelable?: boolean;
            defaultAction?: (event: AnvilEvent) => void;
        };
    };
}

/**
 * Core Event System Manager
 */
export class AnvilEventSystem {
    private components: Map<string, AnvilComponent> = new Map();
    private globalEventListeners: Map<string, AnvilEventListener[]> = new Map();
    private eventConfigs: Map<string, ComponentEventConfig> = new Map();
    private eventQueue: AnvilEvent[] = [];
    private processing: boolean = false;

    /**
     * Register a component in the event system
     */
    registerComponent(component: AnvilComponent): void {
        this.components.set(component.id, component);

        // Emit component mounted event
        if (component.mounted) {
            this.emitEvent({
                type: 'component:mounted',
                target: component,
                currentTarget: component,
                timestamp: Date.now(),
                bubbles: false,
                cancelable: false,
                defaultPrevented: false,
                stopPropagation: false,
                stopImmediatePropagation: false
            });
        }
    }

    /**
     * Unregister a component from the event system
     */
    unregisterComponent(componentId: string): void {
        const component = this.components.get(componentId);
        if (component) {
            // Emit component unmounting event
            this.emitEvent({
                type: 'component:unmounting',
                target: component,
                currentTarget: component,
                timestamp: Date.now(),
                bubbles: false,
                cancelable: false,
                defaultPrevented: false,
                stopPropagation: false,
                stopImmediatePropagation: false
            });

            // Clean up event listeners
            component.eventListeners.clear();
            this.components.delete(componentId);
        }
    }

    /**
     * Register event configuration for a component type
     */
    registerEventConfig(config: ComponentEventConfig): void {
        this.eventConfigs.set(config.componentType, config);
    }

    /**
     * Add event listener to a component
     */
    addEventListener(
        componentId: string,
        eventType: string,
        handler: (event: AnvilEvent) => void | Promise<void>,
        options: AnvilEventListenerOptions = {}
    ): string {
        const component = this.components.get(componentId);
        if (!component) {
            throw new Error(`Component ${componentId} not found`);
        }

        const listenerId = this.generateListenerId();
        const listener: AnvilEventListener = {
            type: eventType,
            handler,
            options: {
                once: false,
                capture: false,
                passive: false,
                priority: 0,
                ...options
            },
            id: listenerId
        };

        if (!component.eventListeners.has(eventType)) {
            component.eventListeners.set(eventType, []);
        }

        const listeners = component.eventListeners.get(eventType)!;
        listeners.push(listener);

        // Sort by priority (higher first)
        listeners.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

        return listenerId;
    }

    /**
     * Remove event listener from a component
     */
    removeEventListener(componentId: string, listenerId: string): boolean {
        const component = this.components.get(componentId);
        if (!component) {
            return false;
        }

        for (const [eventType, listeners] of component.eventListeners) {
            const index = listeners.findIndex(l => l.id === listenerId);
            if (index !== -1) {
                listeners.splice(index, 1);
                if (listeners.length === 0) {
                    component.eventListeners.delete(eventType);
                }
                return true;
            }
        }

        return false;
    }

    /**
     * Add global event listener
     */
    addGlobalEventListener(
        eventType: string,
        handler: (event: AnvilEvent) => void | Promise<void>,
        options: AnvilEventListenerOptions = {}
    ): string {
        const listenerId = this.generateListenerId();
        const listener: AnvilEventListener = {
            type: eventType,
            handler,
            options: {
                once: false,
                capture: false,
                passive: false,
                priority: 0,
                ...options
            },
            id: listenerId
        };

        if (!this.globalEventListeners.has(eventType)) {
            this.globalEventListeners.set(eventType, []);
        }

        const listeners = this.globalEventListeners.get(eventType)!;
        listeners.push(listener);
        listeners.sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0));

        return listenerId;
    }

    /**
     * Remove global event listener
     */
    removeGlobalEventListener(listenerId: string): boolean {
        for (const [eventType, listeners] of this.globalEventListeners) {
            const index = listeners.findIndex(l => l.id === listenerId);
            if (index !== -1) {
                listeners.splice(index, 1);
                if (listeners.length === 0) {
                    this.globalEventListeners.delete(eventType);
                }
                return true;
            }
        }
        return false;
    }

    /**
     * Emit an event
     */
    async emitEvent(event: Partial<AnvilEvent> & { type: string; target: AnvilComponent }): Promise<void> {
        const fullEvent: AnvilEvent = {
            currentTarget: event.target,
            timestamp: Date.now(),
            bubbles: true,
            cancelable: true,
            defaultPrevented: false,
            stopPropagation: false,
            stopImmediatePropagation: false,
            ...event
        };

        // Check if we should use default bubbling behavior from config
        const config = this.eventConfigs.get(event.target.type);
        if (config && config.events[event.type]) {
            const eventConfig = config.events[event.type];
            if (eventConfig.bubbles !== undefined) {
                fullEvent.bubbles = eventConfig.bubbles;
            }
            if (eventConfig.cancelable !== undefined) {
                fullEvent.cancelable = eventConfig.cancelable;
            }
        }

        // Add to event queue
        this.eventQueue.push(fullEvent);

        // Process queue if not already processing
        if (!this.processing) {
            await this.processEventQueue();
        }
    }

    /**
     * Process the event queue
     */
    private async processEventQueue(): Promise<void> {
        this.processing = true;

        while (this.eventQueue.length > 0) {
            const event = this.eventQueue.shift()!;
            await this.processEvent(event);
        }

        this.processing = false;
    }

    /**
     * Process a single event
     */
    private async processEvent(event: AnvilEvent): Promise<void> {
        // Phase 1: Capture phase (from root to target)
        if (event.target) {
            const capturePath = this.getEventPath(event.target).reverse();

            for (const component of capturePath) {
                if (component === event.target) break; // Don't process target in capture phase

                event.currentTarget = component;
                await this.executeEventHandlers(component, event, true); // capture = true

                if (event.stopPropagation || event.stopImmediatePropagation) {
                    return;
                }
            }
        }

        // Phase 2: Target phase
        if (event.target) {
            event.currentTarget = event.target;
            await this.executeEventHandlers(event.target, event, false);

            if (event.stopPropagation || event.stopImmediatePropagation) {
                return;
            }
        }

        // Phase 3: Bubble phase (from target to root)
        if (event.bubbles && event.target) {
            const bubblePath = this.getEventPath(event.target);

            for (const component of bubblePath) {
                if (component === event.target) continue; // Already processed in target phase

                event.currentTarget = component;
                await this.executeEventHandlers(component, event, false);

                if (event.stopPropagation || event.stopImmediatePropagation) {
                    return;
                }
            }
        }

        // Phase 4: Global event handlers
        await this.executeGlobalEventHandlers(event);

        // Phase 5: Default action
        if (!event.defaultPrevented) {
            await this.executeDefaultAction(event);
        }
    }

    /**
     * Execute event handlers for a component
     */
    private async executeEventHandlers(
        component: AnvilComponent,
        event: AnvilEvent,
        capture: boolean
    ): Promise<void> {
        const listeners = component.eventListeners.get(event.type);
        if (!listeners) return;

        for (const listener of listeners) {
            // Check capture phase
            if (capture && !listener.options.capture) continue;
            if (!capture && listener.options.capture) continue;

            try {
                await listener.handler(event);

                // Remove if once option is set
                if (listener.options.once) {
                    this.removeEventListener(component.id, listener.id);
                }
            } catch (error) {
                console.error('Error in event handler:', error);

                // Emit error event
                this.emitEvent({
                    type: 'error',
                    target: component,
                    data: { error, originalEvent: event }
                });
            }

            if (event.stopImmediatePropagation) {
                break;
            }
        }
    }

    /**
     * Execute global event handlers
     */
    private async executeGlobalEventHandlers(event: AnvilEvent): Promise<void> {
        const listeners = this.globalEventListeners.get(event.type);
        if (!listeners) return;

        for (const listener of listeners) {
            try {
                await listener.handler(event);

                // Remove if once option is set
                if (listener.options.once) {
                    this.removeGlobalEventListener(listener.id);
                }
            } catch (error) {
                console.error('Error in global event handler:', error);
            }

            if (event.stopImmediatePropagation) {
                break;
            }
        }
    }

    /**
     * Execute default action for an event
     */
    private async executeDefaultAction(event: AnvilEvent): Promise<void> {
        if (!event.target) return;

        const config = this.eventConfigs.get(event.target.type);
        if (config && config.events[event.type] && config.events[event.type].defaultAction) {
            try {
                await config.events[event.type].defaultAction!(event);
            } catch (error) {
                console.error('Error in default action:', error);
            }
        }
    }

    /**
     * Get the event propagation path for a component
     */
    private getEventPath(component: AnvilComponent): AnvilComponent[] {
        const path: AnvilComponent[] = [];
        let current: AnvilComponent | undefined = component.parent;

        while (current) {
            path.push(current);
            current = current.parent;
        }

        return path;
    }

    /**
     * Generate a unique listener ID
     */
    private generateListenerId(): string {
        return `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Create a component event emitter function
     */
    createEmitter(componentId: string) {
        return async (eventType: string, data?: any, options?: Partial<Pick<AnvilEvent, 'bubbles' | 'cancelable'>>) => {
            const component = this.components.get(componentId);
            if (!component) {
                throw new Error(`Component ${componentId} not found`);
            }

            await this.emitEvent({
                type: eventType,
                target: component,
                data,
                ...options
            });
        };
    }

    /**
     * Get component by ID
     */
    getComponent(componentId: string): AnvilComponent | null {
        return this.components.get(componentId) || null;
    }

    /**
     * Get all components of a specific type
     */
    getComponentsByType(componentType: string): AnvilComponent[] {
        return Array.from(this.components.values()).filter(c => c.type === componentType);
    }

    /**
     * Clear all event listeners for a component
     */
    clearEventListeners(componentId: string): void {
        const component = this.components.get(componentId);
        if (component) {
            component.eventListeners.clear();
        }
    }

    /**
     * Get event statistics
     */
    getEventStats(): {
        components: number;
        globalListeners: number;
        totalListeners: number;
        queuedEvents: number;
    } {
        let totalListeners = 0;
        for (const component of this.components.values()) {
            for (const listeners of component.eventListeners.values()) {
                totalListeners += listeners.length;
            }
        }

        let globalListeners = 0;
        for (const listeners of this.globalEventListeners.values()) {
            globalListeners += listeners.length;
        }

        return {
            components: this.components.size,
            globalListeners,
            totalListeners,
            queuedEvents: this.eventQueue.length
        };
    }
}

// Global event system instance
let globalEventSystem: AnvilEventSystem | null = null;

/**
 * Initialize the global event system
 */
export function initializeEventSystem(): AnvilEventSystem {
    if (!globalEventSystem) {
        globalEventSystem = new AnvilEventSystem();
    }
    return globalEventSystem;
}

/**
 * Get the global event system
 */
export function getEventSystem(): AnvilEventSystem {
    if (!globalEventSystem) {
        globalEventSystem = initializeEventSystem();
    }
    return globalEventSystem;
}

/**
 * Utility function to create a component
 */
export function createComponent(
    id: string,
    type: string,
    properties: Record<string, any> = {},
    parent?: AnvilComponent
): AnvilComponent {
    const component: AnvilComponent = {
        id,
        type,
        parent,
        children: [],
        eventListeners: new Map(),
        properties,
        mounted: false
    };

    if (parent) {
        parent.children.push(component);
    }

    return component;
}

/**
 * Utility function to mount a component
 */
export function mountComponent(component: AnvilComponent): void {
    component.mounted = true;
    getEventSystem().registerComponent(component);
}

/**
 * Utility function to unmount a component
 */
export function unmountComponent(component: AnvilComponent): void {
    component.mounted = false;
    getEventSystem().unregisterComponent(component.id);

    // Recursively unmount children
    for (const child of component.children) {
        unmountComponent(child);
    }
}

/**
 * Event handler utilities
 */
export const EventUtils = {
    /**
     * Stop event propagation
     */
    stopPropagation: (event: AnvilEvent) => {
        event.stopPropagation = true;
    },

    /**
     * Stop immediate propagation
     */
    stopImmediatePropagation: (event: AnvilEvent) => {
        event.stopImmediatePropagation = true;
        event.stopPropagation = true;
    },

    /**
     * Prevent default action
     */
    preventDefault: (event: AnvilEvent) => {
        if (event.cancelable) {
            event.defaultPrevented = true;
        }
    },

    /**
     * Check if event is from a specific component type
     */
    isEventFromComponentType: (event: AnvilEvent, componentType: string): boolean => {
        return event.target?.type === componentType;
    },

    /**
     * Get event data with type safety
     */
    getEventData: <T = any>(event: AnvilEvent): T | null => {
        return event.data || null;
    }
};

// Pre-configured event configurations for common Anvil components
export const StandardEventConfigs: ComponentEventConfig[] = [
    {
        componentType: 'Button',
        events: {
            'click': { bubbles: true, cancelable: true },
            'focus': { bubbles: false, cancelable: false },
            'blur': { bubbles: false, cancelable: false }
        }
    },
    {
        componentType: 'TextBox',
        events: {
            'change': { bubbles: true, cancelable: true },
            'input': { bubbles: true, cancelable: false },
            'focus': { bubbles: false, cancelable: false },
            'blur': { bubbles: false, cancelable: false }
        }
    },
    {
        componentType: 'DataGrid',
        events: {
            'row_click': { bubbles: true, cancelable: true },
            'cell_click': { bubbles: true, cancelable: true },
            'selection_changed': { bubbles: true, cancelable: false }
        }
    },
    {
        componentType: 'Form',
        events: {
            'show': { bubbles: false, cancelable: false },
            'hide': { bubbles: false, cancelable: false },
            'refreshing_data_bindings': { bubbles: false, cancelable: true }
        }
    }
]; 