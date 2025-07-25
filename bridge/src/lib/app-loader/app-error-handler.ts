/**
 * App Error Handler
 * 
 * Centralized error handling for the app loading system with graceful fallbacks
 * when no app is found, corrupted YAML, or parsing fails.
 */

export interface AppError {
    type: 'DISCOVERY_ERROR' | 'PARSING_ERROR' | 'LOADING_ERROR' | 'FORM_ERROR' | 'CONNECTION_ERROR';
    message: string;
    details?: string;
    appName?: string;
    formName?: string;
    cause?: Error;
}

export interface ErrorRecoveryOptions {
    showFallbackUI?: boolean;
    redirectToDemo?: boolean;
    retryable?: boolean;
    autoRetry?: boolean;
    retryDelay?: number;
    maxRetries?: number;
}

export class AppErrorHandler {
    private static retryCount = new Map<string, number>();
    private static readonly MAX_RETRIES = 3;
    private static readonly RETRY_DELAY = 2000;

    /**
     * Handle app discovery errors
     */
    static handleDiscoveryError(error: any, options: ErrorRecoveryOptions = {}): AppError {
        const appError: AppError = {
            type: 'DISCOVERY_ERROR',
            message: 'Failed to discover Anvil applications',
            details: this.extractErrorMessage(error),
            cause: error instanceof Error ? error : undefined
        };

        console.error('🚨 App Discovery Error:', appError);

        // Apply recovery options
        this.applyRecoveryOptions(appError, {
            showFallbackUI: true,
            retryable: true,
            autoRetry: false,
            ...options
        });

        return appError;
    }

    /**
     * Handle YAML parsing errors
     */
    static handleParsingError(error: any, appName?: string, fileName?: string): AppError {
        const appError: AppError = {
            type: 'PARSING_ERROR',
            message: `Failed to parse Anvil app${appName ? ` '${appName}'` : ''}`,
            details: fileName
                ? `Error in ${fileName}: ${this.extractErrorMessage(error)}`
                : this.extractErrorMessage(error),
            appName,
            cause: error instanceof Error ? error : undefined
        };

        console.error('🚨 YAML Parsing Error:', appError);

        return appError;
    }

    /**
     * Handle app loading errors
     */
    static handleLoadingError(error: any, appName?: string): AppError {
        const appError: AppError = {
            type: 'LOADING_ERROR',
            message: `Failed to load Anvil app${appName ? ` '${appName}'` : ''}`,
            details: this.extractErrorMessage(error),
            appName,
            cause: error instanceof Error ? error : undefined
        };

        console.error('🚨 App Loading Error:', appError);

        return appError;
    }

    /**
     * Handle form rendering errors
     */
    static handleFormError(error: any, formName?: string, appName?: string): AppError {
        const appError: AppError = {
            type: 'FORM_ERROR',
            message: `Failed to render form${formName ? ` '${formName}'` : ''}`,
            details: this.extractErrorMessage(error),
            appName,
            formName,
            cause: error instanceof Error ? error : undefined
        };

        console.error('🚨 Form Rendering Error:', appError);

        return appError;
    }

    /**
     * Handle connection errors
     */
    static handleConnectionError(error: any): AppError {
        const appError: AppError = {
            type: 'CONNECTION_ERROR',
            message: 'Failed to connect to Anvil server',
            details: this.extractErrorMessage(error),
            cause: error instanceof Error ? error : undefined
        };

        console.error('🚨 Anvil Connection Error:', appError);

        // Connection errors are often retryable
        this.applyRecoveryOptions(appError, {
            retryable: true,
            autoRetry: true,
            retryDelay: 5000,
            maxRetries: 5
        });

        return appError;
    }

    /**
     * Create fallback UI error
     */
    static createFallbackError(reason: string): AppError {
        return {
            type: 'DISCOVERY_ERROR',
            message: 'No Anvil applications available',
            details: reason
        };
    }

    /**
     * Extract meaningful error message from various error types
     */
    private static extractErrorMessage(error: any): string {
        if (typeof error === 'string') {
            return error;
        }

        if (error instanceof Error) {
            return error.message;
        }

        if (error?.message) {
            return error.message;
        }

        if (error?.toString) {
            return error.toString();
        }

        return 'Unknown error occurred';
    }

    /**
     * Apply recovery options to an error
     */
    private static applyRecoveryOptions(error: AppError, options: ErrorRecoveryOptions): void {
        if (options.retryable && options.autoRetry) {
            const retryKey = `${error.type}_${error.appName || 'global'}`;
            const currentRetries = this.retryCount.get(retryKey) || 0;
            const maxRetries = options.maxRetries || this.MAX_RETRIES;

            if (currentRetries < maxRetries) {
                this.retryCount.set(retryKey, currentRetries + 1);
                const delay = options.retryDelay || this.RETRY_DELAY;

                console.log(`🔄 Auto-retry ${currentRetries + 1}/${maxRetries} for ${error.type} in ${delay}ms`);

                setTimeout(() => {
                    // Trigger retry through event or callback mechanism
                    this.triggerRetry(error, options);
                }, delay);
            } else {
                console.warn(`⚠️ Max retries (${maxRetries}) exceeded for ${error.type}`);
                this.retryCount.delete(retryKey);
            }
        }
    }

    /**
     * Trigger retry mechanism (to be implemented based on context)
     */
    private static triggerRetry(error: AppError, options: ErrorRecoveryOptions): void {
        // This would be implemented to trigger the appropriate retry action
        // For now, just log the retry attempt
        console.log('🔄 Triggering retry for:', error.type);
    }

    /**
     * Reset retry count for a specific error type
     */
    static resetRetryCount(errorType: string, identifier?: string): void {
        const retryKey = `${errorType}_${identifier || 'global'}`;
        this.retryCount.delete(retryKey);
    }

    /**
     * Check if an error is retryable
     */
    static isRetryable(error: AppError): boolean {
        switch (error.type) {
            case 'CONNECTION_ERROR':
                return true;
            case 'DISCOVERY_ERROR':
                return !error.details?.includes('not found'); // Don't retry if directory doesn't exist
            case 'LOADING_ERROR':
                return true;
            case 'PARSING_ERROR':
                return false; // YAML errors usually need manual fixing
            case 'FORM_ERROR':
                return false; // Form errors usually indicate code issues
            default:
                return false;
        }
    }

    /**
     * Generate user-friendly error message
     */
    static getUserMessage(error: AppError): string {
        switch (error.type) {
            case 'DISCOVERY_ERROR':
                if (error.details?.includes('not found')) {
                    return 'No Anvil applications found. Please run the installation script to set up your app.';
                }
                return 'Unable to find Anvil applications. Please check your setup.';

            case 'PARSING_ERROR':
                return `There's an issue with your app configuration${error.appName ? ` in '${error.appName}'` : ''}. Please check the YAML files for syntax errors.`;

            case 'LOADING_ERROR':
                return `Failed to load your Anvil app${error.appName ? ` '${error.appName}'` : ''}. Please try refreshing the page.`;

            case 'FORM_ERROR':
                return `Unable to display the form${error.formName ? ` '${error.formName}'` : ''}. There may be an issue with the form configuration.`;

            case 'CONNECTION_ERROR':
                return 'Unable to connect to the Anvil server. Please ensure the server is running on port 3030.';

            default:
                return 'An unexpected error occurred. Please try refreshing the page.';
        }
    }

    /**
     * Generate recovery suggestions
     */
    static getRecoverySuggestions(error: AppError): string[] {
        const suggestions: string[] = [];

        switch (error.type) {
            case 'DISCOVERY_ERROR':
                suggestions.push('Run ./install-demo.sh to set up an Anvil app');
                suggestions.push('Check that anvil-testing directory exists');
                suggestions.push('Verify your app was cloned correctly');
                break;

            case 'PARSING_ERROR':
                suggestions.push('Check YAML file syntax');
                suggestions.push('Verify all required files exist');
                suggestions.push('Re-clone your app from Anvil if needed');
                break;

            case 'LOADING_ERROR':
                suggestions.push('Refresh the page');
                suggestions.push('Check browser console for details');
                suggestions.push('Restart the NextJS server');
                break;

            case 'FORM_ERROR':
                suggestions.push('Check the form configuration');
                suggestions.push('Verify all components are properly defined');
                suggestions.push('Try navigating to a different form');
                break;

            case 'CONNECTION_ERROR':
                suggestions.push('Start the Anvil server: anvil-app-server --app YourApp --port 3030');
                suggestions.push('Check that port 3030 is not blocked');
                suggestions.push('Verify the Anvil server is running correctly');
                break;
        }

        return suggestions;
    }
}

// Export utility functions
export function createAppError(type: AppError['type'], message: string, details?: string): AppError {
    return { type, message, details };
}

export function isAppError(obj: any): obj is AppError {
    return obj && typeof obj === 'object' && 'type' in obj && 'message' in obj;
}

export default AppErrorHandler; 