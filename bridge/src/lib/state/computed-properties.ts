import { AnvilStateValue, AnvilComputedProperty } from './anvil-state-context';

/**
 * Computed Properties System
 * 
 * Manages computed properties that automatically recalculate when their dependencies change.
 * Provides dependency tracking, caching, and optimization for derived state values.
 */

// Computed property function signature
export type ComputedFunction<T = AnvilStateValue> = (dependencies: Record<string, AnvilStateValue>) => T;

// Dependency specification
export interface DependencySpec {
    componentId: string;
    property: string;
    alias?: string; // Optional alias for the dependency in the compute function
}

// Enhanced computed property with caching and optimization
export interface EnhancedComputedProperty<T = AnvilStateValue> extends Omit<AnvilComputedProperty, 'compute'> {
    // Enhanced dependency specification
    dependencySpecs: DependencySpec[];

    // Computed function (replaces the base 'compute' property)
    computeFn: ComputedFunction<T>;

    // Keep legacy compute for compatibility
    compute: ComputedFunction<T>;

    // Caching options
    cache?: boolean;
    cacheTimeout?: number; // Cache expiration in milliseconds

    // Optimization options
    debounceMs?: number;
    throttleMs?: number;

    // Conditions
    condition?: () => boolean; // Only compute when condition is true

    // Lifecycle hooks
    onComputeStart?: () => void;
    onComputeComplete?: (value: T) => void;
    onComputeError?: (error: Error) => void;

    // Metadata
    description?: string;
    category?: string;

    // Internal state
    _lastComputed?: number;
    _cachedValue?: T;
    _isComputing?: boolean;
}

// Dependency graph node
interface DependencyNode {
    id: string; // componentId.property
    dependents: Set<string>; // computed properties that depend on this
    dependencies: Set<string>; // what this depends on (for computed properties)
    computedProperty?: EnhancedComputedProperty;
}

// Computed property change event
export interface ComputedPropertyEvent {
    type: 'computed' | 'dependency-changed' | 'cache-hit' | 'cache-miss' | 'error';
    componentId: string;
    property: string;
    value?: AnvilStateValue;
    oldValue?: AnvilStateValue;
    dependencies?: Record<string, AnvilStateValue>;
    error?: Error;
    executionTime?: number;
    fromCache?: boolean;
    timestamp: number;
}

// Computed properties manager
export class ComputedPropertiesManager {
    private computedProperties = new Map<string, EnhancedComputedProperty>();
    private dependencyGraph = new Map<string, DependencyNode>();
    private debounceTimers = new Map<string, NodeJS.Timeout>();
    private throttleTimers = new Map<string, NodeJS.Timeout>();
    private eventListeners: ((event: ComputedPropertyEvent) => void)[] = [];
    private getStateValue: (componentId: string, property: string) => AnvilStateValue;
    private setStateValue: (componentId: string, property: string, value: AnvilStateValue) => void;

    constructor(
        getStateValue: (componentId: string, property: string) => AnvilStateValue,
        setStateValue: (componentId: string, property: string, value: AnvilStateValue) => void
    ) {
        this.getStateValue = getStateValue;
        this.setStateValue = setStateValue;
    }

    /**
     * Register a computed property
     */
    registerComputedProperty(computed: EnhancedComputedProperty): void {
        const key = this.getPropertyKey(computed.componentId, computed.property);

        // Remove existing computed property
        if (this.computedProperties.has(key)) {
            this.unregisterComputedProperty(computed.componentId, computed.property);
        }

        // Store computed property
        this.computedProperties.set(key, computed);

        // Build dependency graph
        this.buildDependencyGraph(computed);

        // Initial computation
        this.computeProperty(computed.componentId, computed.property);

        this.emitEvent({
            type: 'computed',
            componentId: computed.componentId,
            property: computed.property,
            timestamp: Date.now()
        });
    }

    /**
     * Unregister a computed property
     */
    unregisterComputedProperty(componentId: string, property: string): void {
        const key = this.getPropertyKey(componentId, property);
        const computed = this.computedProperties.get(key);

        if (!computed) return;

        // Clear timers
        const debounceTimer = this.debounceTimers.get(key);
        if (debounceTimer) {
            clearTimeout(debounceTimer);
            this.debounceTimers.delete(key);
        }

        const throttleTimer = this.throttleTimers.get(key);
        if (throttleTimer) {
            clearTimeout(throttleTimer);
            this.throttleTimers.delete(key);
        }

        // Remove from dependency graph
        this.removeDependencyNode(key);

        // Remove computed property
        this.computedProperties.delete(key);
    }

    /**
     * Handle dependency change (called when a property that other properties depend on changes)
     */
    handleDependencyChange(componentId: string, property: string, newValue: AnvilStateValue): void {
        const dependencyKey = this.getPropertyKey(componentId, property);
        const dependencyNode = this.dependencyGraph.get(dependencyKey);

        if (!dependencyNode) return;

        // Find all computed properties that depend on this property
        dependencyNode.dependents.forEach(computedKey => {
            const [computedComponentId, computedProperty] = computedKey.split('.');
            this.scheduleComputation(computedComponentId, computedProperty);
        });

        this.emitEvent({
            type: 'dependency-changed',
            componentId,
            property,
            value: newValue,
            timestamp: Date.now()
        });
    }

    /**
     * Get computed property value
     */
    getComputedValue(componentId: string, property: string): AnvilStateValue | undefined {
        const key = this.getPropertyKey(componentId, property);
        const computed = this.computedProperties.get(key);

        if (!computed) return undefined;

        // Check cache
        if (computed.cache && computed._cachedValue !== undefined) {
            const cacheAge = Date.now() - (computed._lastComputed || 0);
            const cacheTimeout = computed.cacheTimeout || 5000; // 5 second default

            if (cacheAge < cacheTimeout) {
                this.emitEvent({
                    type: 'cache-hit',
                    componentId,
                    property,
                    value: computed._cachedValue,
                    fromCache: true,
                    timestamp: Date.now()
                });
                return computed._cachedValue;
            }
        }

        // Compute new value
        return this.computeProperty(componentId, property);
    }

    /**
     * Force recomputation of a property
     */
    forceRecompute(componentId: string, property: string): AnvilStateValue | undefined {
        const key = this.getPropertyKey(componentId, property);
        const computed = this.computedProperties.get(key);

        if (!computed) return undefined;

        // Clear cache
        computed._cachedValue = undefined;
        computed._lastComputed = undefined;

        return this.computeProperty(componentId, property);
    }

    /**
     * Get all computed properties for a component
     */
    getComponentComputedProperties(componentId: string): EnhancedComputedProperty[] {
        return Array.from(this.computedProperties.values()).filter(
            computed => computed.componentId === componentId
        );
    }

    /**
     * Clear all caches
     */
    clearAllCaches(): void {
        this.computedProperties.forEach(computed => {
            computed._cachedValue = undefined;
            computed._lastComputed = undefined;
        });
    }

    /**
     * Get dependency graph for debugging
     */
    getDependencyGraph(): Map<string, DependencyNode> {
        return new Map(this.dependencyGraph);
    }

    /**
     * Add event listener
     */
    addEventListener(listener: (event: ComputedPropertyEvent) => void): () => void {
        this.eventListeners.push(listener);
        return () => {
            this.eventListeners = this.eventListeners.filter(l => l !== listener);
        };
    }

    // Private methods

    private getPropertyKey(componentId: string, property: string): string {
        return `${componentId}.${property}`;
    }

    private buildDependencyGraph(computed: EnhancedComputedProperty): void {
        const computedKey = this.getPropertyKey(computed.componentId, computed.property);

        // Create or get computed property node
        let computedNode = this.dependencyGraph.get(computedKey);
        if (!computedNode) {
            computedNode = {
                id: computedKey,
                dependents: new Set(),
                dependencies: new Set(),
                computedProperty: computed
            };
            this.dependencyGraph.set(computedKey, computedNode);
        } else {
            computedNode.computedProperty = computed;
        }

        // Process dependencies
        computed.dependencySpecs.forEach(dep => {
            const depKey = this.getPropertyKey(dep.componentId, dep.property);

            // Add to computed property's dependencies
            computedNode!.dependencies.add(depKey);

            // Create or get dependency node
            let depNode = this.dependencyGraph.get(depKey);
            if (!depNode) {
                depNode = {
                    id: depKey,
                    dependents: new Set(),
                    dependencies: new Set()
                };
                this.dependencyGraph.set(depKey, depNode);
            }

            // Add computed property as dependent
            depNode.dependents.add(computedKey);
        });
    }

    private removeDependencyNode(key: string): void {
        const node = this.dependencyGraph.get(key);
        if (!node) return;

        // Remove this node from its dependencies' dependents lists
        node.dependencies.forEach(depKey => {
            const depNode = this.dependencyGraph.get(depKey);
            if (depNode) {
                depNode.dependents.delete(key);
            }
        });

        // Remove this node from its dependents' dependencies lists
        node.dependents.forEach(depKey => {
            const depNode = this.dependencyGraph.get(depKey);
            if (depNode) {
                depNode.dependencies.delete(key);
            }
        });

        // Remove the node itself
        this.dependencyGraph.delete(key);
    }

    private scheduleComputation(componentId: string, property: string): void {
        const key = this.getPropertyKey(componentId, property);
        const computed = this.computedProperties.get(key);

        if (!computed) return;

        // Handle debouncing
        if (computed.debounceMs && computed.debounceMs > 0) {
            const existingTimer = this.debounceTimers.get(key);
            if (existingTimer) {
                clearTimeout(existingTimer);
            }

            const timer = setTimeout(() => {
                this.computeProperty(componentId, property);
                this.debounceTimers.delete(key);
            }, computed.debounceMs);

            this.debounceTimers.set(key, timer);
            return;
        }

        // Handle throttling
        if (computed.throttleMs && computed.throttleMs > 0) {
            const existingTimer = this.throttleTimers.get(key);
            if (existingTimer) {
                return; // Already scheduled
            }

            const timer = setTimeout(() => {
                this.computeProperty(componentId, property);
                this.throttleTimers.delete(key);
            }, computed.throttleMs);

            this.throttleTimers.set(key, timer);
            return;
        }

        // Immediate computation
        this.computeProperty(componentId, property);
    }

    private computeProperty(componentId: string, property: string): AnvilStateValue | undefined {
        const key = this.getPropertyKey(componentId, property);
        const computed = this.computedProperties.get(key);

        if (!computed) return undefined;

        // Check condition
        if (computed.condition && !computed.condition()) {
            return computed._cachedValue;
        }

        // Prevent circular computation
        if (computed._isComputing) {
            console.warn(`Circular dependency detected in computed property ${key}`);
            return computed._cachedValue;
        }

        const startTime = Date.now();
        computed._isComputing = true;

        try {
            // Call lifecycle hook
            if (computed.onComputeStart) {
                computed.onComputeStart();
            }

            // Gather dependency values
            const dependencies: Record<string, AnvilStateValue> = {};

            computed.dependencySpecs.forEach(dep => {
                const value = this.getStateValue(dep.componentId, dep.property);
                const key = dep.alias || `${dep.componentId}.${dep.property}`;
                dependencies[key] = value;
            });

            // Compute new value
            const oldValue = computed._cachedValue;
            const newValue = computed.computeFn(dependencies);
            const executionTime = Date.now() - startTime;

            // Update cache
            if (computed.cache) {
                computed._cachedValue = newValue;
                computed._lastComputed = Date.now();
            }

            // Update state
            this.setStateValue(componentId, property, newValue);

            // Call lifecycle hook
            if (computed.onComputeComplete) {
                computed.onComputeComplete(newValue);
            }

            this.emitEvent({
                type: 'computed',
                componentId,
                property,
                value: newValue,
                oldValue,
                dependencies,
                executionTime,
                fromCache: false,
                timestamp: Date.now()
            });

            return newValue;

        } catch (error) {
            const err = error instanceof Error ? error : new Error('Unknown computation error');

            // Call error hook
            if (computed.onComputeError) {
                computed.onComputeError(err);
            }

            this.emitEvent({
                type: 'error',
                componentId,
                property,
                error: err,
                timestamp: Date.now()
            });

            console.error(`Error computing property ${key}:`, err);
            return computed._cachedValue;

        } finally {
            computed._isComputing = false;
        }
    }

    private emitEvent(event: ComputedPropertyEvent): void {
        this.eventListeners.forEach(listener => {
            try {
                listener(event);
            } catch (error) {
                console.error('Error in computed property event listener:', error);
            }
        });
    }
}

// Common computed property factories
export const ComputedPropertyFactories = {
    /**
     * Create a sum computed property
     */
    sum: (componentId: string, property: string, dependencies: DependencySpec[]): EnhancedComputedProperty<number> => {
        const computeFn = (deps: Record<string, AnvilStateValue>): number => {
            return Object.values(deps).reduce((sum: number, value) => {
                const num = typeof value === 'number' ? value : Number(value) || 0;
                return sum + num;
            }, 0);
        };

        return {
            componentId,
            property,
            dependencies: [], // Legacy format
            dependencySpecs: dependencies,
            computeFn,
            compute: computeFn, // For compatibility
            cache: true,
            description: `Sum of ${dependencies.map(d => `${d.componentId}.${d.property}`).join(', ')}`
        };
    },

    /**
     * Create a concatenation computed property
     */
    concat: (componentId: string, property: string, dependencies: DependencySpec[], separator: string = ' '): EnhancedComputedProperty<string> => {
        const computeFn = (deps: Record<string, AnvilStateValue>): string => {
            return Object.values(deps)
                .filter(value => value !== null && value !== undefined && value !== '')
                .map(value => String(value))
                .join(separator);
        };

        return {
            componentId,
            property,
            dependencies: [], // Legacy format
            dependencySpecs: dependencies,
            computeFn,
            compute: computeFn, // For compatibility
            cache: true,
            description: `Concatenation of ${dependencies.map(d => `${d.componentId}.${d.property}`).join(', ')}`
        };
    },

    /**
     * Create a conditional computed property
     */
    conditional: <T = AnvilStateValue>(
        componentId: string,
        property: string,
        conditionDep: DependencySpec,
        trueDep: DependencySpec,
        falseDep: DependencySpec
    ): EnhancedComputedProperty<T> => ({
        componentId,
        property,
        dependencies: [], // Legacy format
        dependencySpecs: [conditionDep, trueDep, falseDep],
        computeFn: (deps) => {
            const condition = deps[conditionDep.alias || `${conditionDep.componentId}.${conditionDep.property}`];
            const trueValue = deps[trueDep.alias || `${trueDep.componentId}.${trueDep.property}`];
            const falseValue = deps[falseDep.alias || `${falseDep.componentId}.${falseDep.property}`];

            return condition ? trueValue : falseValue;
        },
        cache: true,
        description: `Conditional: ${conditionDep.componentId}.${conditionDep.property} ? ${trueDep.componentId}.${trueDep.property} : ${falseDep.componentId}.${falseDep.property}`
    }),

    /**
     * Create a format computed property
     */
    format: (componentId: string, property: string, template: string, dependencies: DependencySpec[]): EnhancedComputedProperty<string> => ({
        componentId,
        property,
        dependencies: [], // Legacy format
        dependencySpecs: dependencies,
        computeFn: (deps) => {
            let result = template;
            dependencies.forEach((dep, index) => {
                const key = dep.alias || `${dep.componentId}.${dep.property}`;
                const value = deps[key];
                const placeholder = `{${index}}`;
                result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), String(value || ''));
            });
            return result;
        },
        cache: true,
        description: `Format template: ${template}`
    }),

    /**
     * Create a validation computed property
     */
    isValid: (componentId: string, property: string, dependencies: DependencySpec[], validators: Record<string, (value: any) => boolean>): EnhancedComputedProperty<boolean> => ({
        componentId,
        property,
        dependencies: [], // Legacy format
        dependencySpecs: dependencies,
        computeFn: (deps) => {
            return dependencies.every(dep => {
                const key = dep.alias || `${dep.componentId}.${dep.property}`;
                const value = deps[key];
                const validator = validators[key];
                return validator ? validator(value) : true;
            });
        },
        cache: true,
        debounceMs: 300, // Debounce validation for better UX
        description: 'Validation status'
    })
}; 