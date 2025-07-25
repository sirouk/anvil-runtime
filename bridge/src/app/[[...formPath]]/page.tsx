'use client';

import React, { useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { AppContextProvider, useAppContext } from '@/lib/app-loader/app-context';
import { AnvilFormRenderer } from '@/components/anvil/AnvilFormRenderer';
import { AnvilConnectionInitializer } from '@/components/anvil/AnvilConnectionInitializer';
import { AppErrorHandler } from '@/lib/app-loader/app-error-handler';

/**
 * Universal App & Form Router
 * 
 * Handles both root route (/) and form routes (/FormName):
 * - / → Automatically discovers and renders user's cloned Anvil app
 * - /FormName → Renders specific form with navigation support
 * - Supports URL parameters for form data
 */

interface UniversalRouterProps {
    params: Promise<{ formPath?: string[] }>;
}

function UniversalAppRenderer() {
    const params = useParams();
    const searchParams = useSearchParams();
    const { state, isReady, hasError, setCurrentForm, appTitle, discoverApps } = useAppContext();

    // Extract form path from URL
    const formPath = Array.isArray(params.formPath) ? params.formPath : [];
    const requestedForm = formPath[0] || null; // null means root route

    // Update current form when URL changes (only for specific form routes)
    useEffect(() => {
        if (isReady && requestedForm && state.app?.forms.has(requestedForm)) {
            console.log(`🧭 Navigating to form: ${requestedForm}`);
            setCurrentForm(requestedForm);
        }
    }, [isReady, requestedForm, setCurrentForm, state.app]);

    // Auto-initialize connection when app is ready
    useEffect(() => {
        if (isReady && state.app) {
            console.log(`🚀 Auto-loading Anvil app: ${state.app.name}`);
        }
    }, [isReady, state.app]);

    // Show loading while discovering apps
    if (state.loadingState.isDiscovering) {
        return <LoadingUI message="Discovering Anvil applications..." />;
    }

    // Show error if no app found (beautiful fallback UI)
    if (hasError || !state.app) {
        return <ErrorFallbackUI error={state.loadingState.error} onRetry={discoverApps} />;
    }

    // Check if requested form exists (only for non-root routes)
    if (requestedForm && !state.app.forms.has(requestedForm)) {
        const availableForms = Array.from(state.app.forms.keys());

        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <div className="text-yellow-600 text-6xl mb-4">🤔</div>
                    <h2 className="text-xl font-bold text-yellow-800 mb-2">Form Not Found</h2>
                    <p className="text-yellow-700 mb-4">
                        The form <strong>"{requestedForm}"</strong> doesn't exist in this app.
                    </p>

                    {availableForms.length > 0 ? (
                        <div className="mb-4">
                            <p className="text-sm text-yellow-700 mb-2">Available forms:</p>
                            <div className="space-y-1">
                                {availableForms.map(formName => (
                                    <a
                                        key={formName}
                                        href={`/${formName}`}
                                        className="block bg-yellow-100 hover:bg-yellow-200 text-yellow-800 py-1 px-2 rounded text-sm transition-colors"
                                    >
                                        {formName}
                                    </a>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-yellow-600 mb-4">No forms available in this app.</p>
                    )}

                    <a
                        href="/"
                        className="bg-yellow-600 hover:bg-yellow-700 text-white font-medium py-2 px-4 rounded transition-colors"
                    >
                        Go to Main App
                    </a>
                </div>
            </div>
        );
    }

    // Determine which form to render
    const formToRender = requestedForm || state.currentForm || state.app.startupForm;

    return (
        <div className="anvil-universal-app">
            {/* Initialize connection */}
            <AnvilConnectionInitializer />

            {/* Set page title */}
            <title>
                {formToRender ? `${formToRender} - ${appTitle}` : appTitle}
            </title>

            {/* URL parameters as metadata */}
            <div style={{ display: 'none' }} data-anvil-route={`/${formPath.join('/')}`}>
                {Array.from(searchParams.entries()).map(([key, value]) => (
                    <div key={key} data-param={key} data-value={value} />
                ))}
            </div>

            {/* Render the requested form */}
            <AnvilFormRenderer
                app={state.app}
                formName={formToRender}
            />
        </div>
    );
}

/**
 * Loading UI Component
 */
function LoadingUI({ message }: { message: string }) {
    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
            <div className="text-center">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {message}
                </h2>
                <p className="text-gray-600 dark:text-gray-300">
                    Please wait while we set up your Anvil application...
                </p>
            </div>
        </div>
    );
}

/**
 * Error Fallback UI Component
 */
function ErrorFallbackUI({ error, onRetry }: { error: string | null; onRetry: () => void }) {
    const errorObj = error ? AppErrorHandler.createFallbackError(error) : AppErrorHandler.createFallbackError('No Anvil applications found');
    const userMessage = AppErrorHandler.getUserMessage(errorObj);
    const suggestions = AppErrorHandler.getRecoverySuggestions(errorObj);

    return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                <div className="text-center mb-6">
                    <div className="w-20 h-20 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        No Anvil App Found
                    </h1>
                    <p className="text-gray-600 dark:text-gray-300 mb-6">
                        {userMessage}
                    </p>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        🛠️ Quick Setup
                    </h3>
                    <ol className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
                        <li className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">1</span>
                            <span>Run the installation script: <code className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">./install-demo.sh</code></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">2</span>
                            <span>Choose option 2 and paste your SSH clone URL from Anvil Editor</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">3</span>
                            <span>Refresh this page to see your app running automatically</span>
                        </li>
                    </ol>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 mb-6">
                    <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💡 Troubleshooting</h4>
                    <ul className="space-y-1 text-sm text-blue-800 dark:text-blue-200">
                        {suggestions.map((suggestion, index) => (
                            <li key={index} className="flex items-start gap-2">
                                <span>•</span>
                                <span>{suggestion}</span>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={onRetry}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
                    >
                        🔄 Try Again
                    </button>
                    <a
                        href="http://localhost:3030"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-lg text-center transition-colors"
                    >
                        🌐 Open Native Anvil (Port 3030)
                    </a>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600 text-center">
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                        <strong>Anvil-NextJS Universal Bridge</strong> - Bringing zero-configuration deployment to Anvil apps
                    </p>
                </div>
            </div>
        </div>
    );
}

/**
 * Universal page component with app context
 */
export default function UniversalPage({ params }: UniversalRouterProps) {
    return (
        <AppContextProvider autoDiscover={true}>
            <UniversalAppRenderer />
        </AppContextProvider>
    );
} 