'use client';

import React, { useMemo } from 'react';
import { ComponentFactory } from '@/lib/components/component-factory';
import type { DiscoveredApp } from '@/lib/app-loader/app-discovery';
import type { AnvilComponent } from '@/types/anvil-protocol';
import { AppErrorHandler } from '@/lib/app-loader/app-error-handler';

/**
 * Anvil Form Renderer
 * 
 * Renders Anvil forms using the existing component factory system.
 * Applies theme from the app and handles form lifecycle.
 */

interface AnvilFormRendererProps {
    app: DiscoveredApp;
    formName?: string;
}

export function AnvilFormRenderer({ app, formName }: AnvilFormRendererProps) {
    // Determine which form to render
    const targetFormName = formName || app.startupForm || app.forms.keys().next().value;
    const formTemplate = targetFormName ? app.forms.get(targetFormName) : null;

    // Create component factory instance
    const componentFactory = useMemo(() => {
        return new ComponentFactory({
            debug: process.env.NODE_ENV === 'development',
            validateComponents: true
        });
    }, []);

    // Render error if no form found
    if (!targetFormName || !formTemplate) {
        const error = AppErrorHandler.handleFormError(
            new Error('Form not found'),
            targetFormName,
            app.name
        );

        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <div className="text-red-600 text-6xl mb-4">⚠️</div>
                    <h2 className="text-xl font-bold text-red-800 mb-2">Form Not Found</h2>
                    <p className="text-red-700 mb-4">
                        {AppErrorHandler.getUserMessage(error)}
                    </p>
                    <div className="text-sm text-red-600">
                        <p><strong>App:</strong> {app.name}</p>
                        <p><strong>Requested Form:</strong> {targetFormName || 'None'}</p>
                        <p><strong>Available Forms:</strong> {Array.from(app.forms.keys()).join(', ') || 'None'}</p>
                    </div>
                </div>
            </div>
        );
    }

    try {
        // Convert AnvilContainer to AnvilComponent format for the factory
        const containerAsComponent: AnvilComponent = {
            type: formTemplate.container.type,
            name: `${targetFormName}_container`,
            properties: formTemplate.container.properties,
            layout_properties: {},
            components: formTemplate.components
        };

        // Create the form component using the factory
        const formComponent = componentFactory.createComponent(containerAsComponent);

        if (!formComponent) {
            throw new Error('Failed to create form component');
        }

        return (
            <div className="anvil-form-container">
                {/* App metadata */}
                <div style={{ display: 'none' }} data-anvil-app={app.name} data-anvil-form={targetFormName} />

                {/* App title */}
                <title>{app.config.metadata?.title || app.config.name}</title>

                {/* Render the form */}
                <div className="anvil-form-content w-full min-h-screen">
                    {formComponent}
                </div>
            </div>
        );

    } catch (error) {
        const formError = AppErrorHandler.handleFormError(error, targetFormName, app.name);

        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                    <div className="text-red-600 text-6xl mb-4">💥</div>
                    <h2 className="text-xl font-bold text-red-800 mb-2">Rendering Error</h2>
                    <p className="text-red-700 mb-4">
                        {AppErrorHandler.getUserMessage(formError)}
                    </p>
                    <details className="text-left text-sm text-red-600">
                        <summary className="cursor-pointer font-medium mb-2">Technical Details</summary>
                        <pre className="bg-red-100 p-2 rounded text-xs overflow-auto">
                            {error instanceof Error ? error.stack : String(error)}
                        </pre>
                    </details>
                </div>
            </div>
        );
    }
}

export default AnvilFormRenderer; 