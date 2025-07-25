'use client';

import React from 'react';
import { AppContextProvider, useAppContext } from '@/lib/app-loader/app-context';
import { AnvilFormRenderer } from './AnvilFormRenderer';
import { AnvilConnectionInitializer } from './AnvilConnectionInitializer';
import { ThemeProvider } from '@/lib/theme/theme-context';

/**
 * Simple Anvil Form Component
 * 
 * Drop this anywhere in your NextJS app to render an Anvil form:
 * 
 * @example
 * ```tsx
 * // Render the primary/startup form
 * <AnvilForm />
 * 
 * // Render a specific form
 * <AnvilForm form="ContactForm" />
 * 
 * // With custom title
 * <AnvilForm form="Dashboard" title="My Dashboard" />
 * 
 * // Multiple forms on same page
 * <AnvilForm form="Header" />
 * <AnvilForm form="MainContent" />
 * <AnvilForm form="Footer" />
 * ```
 */

interface AnvilFormProps {
    /**
     * The name of the form to render. 
     * If not specified, renders the app's startup form.
     */
    form?: string;

    /**
     * Optional title for the page/section
     */
    title?: string;

    /**
     * CSS class name for the container
     */
    className?: string;

    /**
     * Inline styles for the container
     */
    style?: React.CSSProperties;
}

/**
 * Internal form component that uses the app context
 */
function AnvilFormInner({ form, title, className, style }: AnvilFormProps) {
    const { state, isReady, hasError } = useAppContext();

    // Show loading state
    if (!isReady) {
        return (
            <div className={`anvil-form-loading ${className || ''}`} style={style}>
                <div className="anvil-loading-spinner"></div>
                <p>Loading form...</p>
            </div>
        );
    }

    // Show error state
    if (hasError || !state.app) {
        return (
            <div className={`anvil-form-error ${className || ''}`} style={style}>
                <p>⚠️ Failed to load Anvil app</p>
                <small>{state.loadingState.error || 'No app found'}</small>
            </div>
        );
    }

    // Determine which form to render
    const formToRender = form || state.app.startupForm || Array.from(state.app.forms.keys())[0];

    // Check if form exists
    if (form && !state.app.forms.has(form)) {
        return (
            <div className={`anvil-form-error ${className || ''}`} style={style}>
                <p>⚠️ Form not found: {form}</p>
                <small>Available forms: {Array.from(state.app.forms.keys()).join(', ')}</small>
            </div>
        );
    }

    return (
        <div className={`anvil-form-container ${className || ''}`} style={style}>
            {title && <h2 className="anvil-form-title">{title}</h2>}

            {/* Initialize connection to Anvil server */}
            <AnvilConnectionInitializer />

            {/* Render the form with theme */}
            <ThemeProvider>
                <AnvilFormRenderer
                    app={state.app}
                    formName={formToRender}
                />
            </ThemeProvider>
        </div>
    );
}

/**
 * AnvilForm - Simple component to render any Anvil form
 * 
 * This is the main export that developers use. It wraps everything
 * in the necessary providers for a seamless experience.
 */
export function AnvilForm(props: AnvilFormProps) {
    return (
        <AppContextProvider autoDiscover={true}>
            <AnvilFormInner {...props} />
        </AppContextProvider>
    );
}

/**
 * AnvilFormStatic - For when you already have AppContextProvider
 * 
 * Use this version if you're already inside an AppContextProvider
 * to avoid nesting providers.
 */
export function AnvilFormStatic(props: AnvilFormProps) {
    return <AnvilFormInner {...props} />;
} 