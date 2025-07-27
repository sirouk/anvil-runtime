/**
 * Anvil Event Bridge
 * 
 * Bridges React component events to Anvil server Python event handlers
 * via WebSocket communication
 */

import { AnvilClient } from '../protocol/anvil-client';
import { getGlobalAnvilClient } from '../protocol/anvil-client';

export interface AnvilEventContext {
    componentType: string;
    componentName?: string;
    formName?: string;
    eventType: string;
    eventData?: any;
}

export class AnvilEventBridge {
    private client: AnvilClient;

    constructor(client?: AnvilClient) {
        this.client = client || getGlobalAnvilClient();
    }

    /**
     * Create an event handler that sends events to the Anvil server
     */
    createEventHandler(context: AnvilEventContext) {
        return async (eventData?: any) => {
            try {
                console.log(`🎯 Sending ${context.eventType} event for ${context.componentType}:`, context);

                // Send event to Anvil server
                await this.client.sendMessage({
                    type: 'COMPONENT_EVENT',
                    payload: {
                        componentType: context.componentType,
                        componentName: context.componentName,
                        formName: context.formName,
                        eventType: context.eventType,
                        eventData: eventData || {},
                        timestamp: Date.now()
                    }
                });

                console.log(`✅ ${context.eventType} event sent successfully`);
            } catch (error) {
                console.error(`❌ Failed to send ${context.eventType} event:`, error);
            }
        };
    }

    /**
     * Create a click handler for buttons
     */
    createClickHandler(componentName?: string, formName?: string) {
        return this.createEventHandler({
            componentType: 'Button',
            componentName,
            formName,
            eventType: 'click'
        });
    }

    /**
     * Create a change handler for form inputs
     */
    createChangeHandler(componentName?: string, formName?: string) {
        return this.createEventHandler({
            componentType: 'Input',
            componentName,
            formName,
            eventType: 'change'
        });
    }

    /**
     * Create a submit handler for forms
     */
    createSubmitHandler(formName?: string) {
        return this.createEventHandler({
            componentType: 'Form',
            formName,
            eventType: 'submit'
        });
    }
}

// Global event bridge instance
let globalEventBridge: AnvilEventBridge | null = null;

/**
 * Get or create global event bridge instance
 */
export function getGlobalEventBridge(): AnvilEventBridge {
    if (!globalEventBridge) {
        globalEventBridge = new AnvilEventBridge();
    }
    return globalEventBridge;
}

/**
 * Reset global event bridge (useful for testing)
 */
export function resetGlobalEventBridge(): void {
    globalEventBridge = null;
}

/**
 * Create a server-bound event handler
 * This is the main function components should use to create event handlers
 */
export function createServerEventHandler(
    eventType: string,
    componentType: string,
    componentName?: string,
    formName?: string
) {
    const bridge = getGlobalEventBridge();
    return bridge.createEventHandler({
        componentType,
        componentName,
        formName,
        eventType
    });
} 