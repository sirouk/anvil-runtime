/**
 * App Discovery Service
 * 
 * Automatically discovers and loads Anvil applications from the anvil-testing directory.
 * Uses the existing AnvilYamlParser to parse discovered apps.
 */

import { AnvilYamlParser } from '../parsers/anvil-yaml-parser';
import type { AnvilAppConfig, AnvilFormTemplate, AnvilTheme } from '../../types/anvil-protocol';

export interface DiscoveredApp {
    name: string;
    path: string;
    config: AnvilAppConfig;
    forms: Map<string, AnvilFormTemplate>;
    theme?: AnvilTheme;
    errors: Array<{ file: string; message: string }>;
    startupForm?: string;
}

export interface AppDiscoveryResult {
    apps: DiscoveredApp[];
    primaryApp?: DiscoveredApp;
    errors: string[];
}

export class AppDiscoveryService {
    private static readonly ANVIL_TESTING_DIR = '../anvil-testing';
    private static readonly REQUIRED_FILES = ['anvil.yaml'];

    /**
     * Discover all Anvil applications in the testing directory
     */
    static async discoverApps(): Promise<AppDiscoveryResult> {
        // Only run on server side
        if (typeof window !== 'undefined') {
            return {
                apps: [],
                errors: ['App discovery only available on server side'],
                primaryApp: undefined
            };
        }

        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            const testingPath = path.resolve(process.cwd(), this.ANVIL_TESTING_DIR);
            const result: AppDiscoveryResult = {
                apps: [],
                errors: []
            };

            // Check if testing directory exists
            try {
                await fs.access(testingPath);
            } catch (error) {
                result.errors.push(`Testing directory not found: ${testingPath}`);
                return result;
            }

            // Read directory contents
            const entries = await fs.readdir(testingPath, { withFileTypes: true });
            const appDirectories = entries.filter(entry => entry.isDirectory());

            // Load each potential app directory
            for (const dir of appDirectories) {
                const app = await this.loadApp(dir.name, path.join(testingPath, dir.name));
                if (app) {
                    result.apps.push(app);
                }
            }

            // Select primary app
            result.primaryApp = this.selectPrimaryApp(result.apps);

            console.log(`🔍 App Discovery: Found ${result.apps.length} apps, primary: ${result.primaryApp?.name || 'none'}`);

            return result;

        } catch (error: any) {
            return {
                apps: [],
                errors: [`Failed to discover apps: ${error.message}`],
                primaryApp: undefined
            };
        }
    }

    /**
     * Load a single app from a directory
     */
    private static async loadApp(name: string, appPath: string): Promise<DiscoveredApp | null> {
        // Only run on server side
        if (typeof window !== 'undefined') {
            return null;
        }

        try {
            const fs = await import('fs/promises');
            const path = await import('path');

            // Verify required files exist
            const anvilYamlPath = path.join(appPath, 'anvil.yaml');
            try {
                await fs.access(anvilYamlPath);
            } catch (error) {
                console.log(`⚠️ Skipping ${name}: No anvil.yaml found`);
                return null;
            }

            // Parse the app using existing parser
            const appData = await AnvilYamlParser.parseAnvilApp(appPath);

            if (!appData.config) {
                console.log(`⚠️ Skipping ${name}: Failed to parse anvil.yaml`);
                return null;
            }

            // Determine startup form
            const startupForm = this.determineStartupForm(appData.config, appData.forms);

            const discoveredApp: DiscoveredApp = {
                name,
                path: appPath,
                config: appData.config,
                forms: appData.forms,
                theme: appData.theme,
                errors: appData.errors || [],
                startupForm
            };

            console.log(`✅ Loaded app: ${name} with ${appData.forms.size} forms`);
            return discoveredApp;

        } catch (error: any) {
            console.error(`❌ Failed to load app ${name}:`, error);
            return null;
        }
    }

    /**
     * Determine the startup form for an app
     */
    private static determineStartupForm(config: AnvilAppConfig, forms: Map<string, AnvilFormTemplate>): string | undefined {
        // Check anvil.yaml for explicit startup form
        if (config.startup_form) {
            return config.startup_form;
        }

        // Check for startup property (alternative format)
        if (config.startup) {
            return config.startup;
        }

        // Look for common main form names
        const commonMainForms = ['Main', 'main', 'Home', 'home', 'Index', 'index'];
        for (const formName of commonMainForms) {
            if (forms.has(formName)) {
                return formName;
            }
        }

        // Use first available form
        const firstForm = forms.keys().next().value;
        if (firstForm) {
            console.warn(`No startup form specified for app, using first form: ${firstForm}`);
            return firstForm;
        }

        return undefined;
    }

    /**
     * Select the primary app from discovered apps
     */
    private static selectPrimaryApp(apps: DiscoveredApp[]): DiscoveredApp | undefined {
        if (apps.length === 0) {
            return undefined;
        }

        // If only one app, use it
        if (apps.length === 1) {
            return apps[0];
        }

        // Prefer apps with fewer errors
        const sortedByErrors = apps.sort((a, b) => a.errors.length - b.errors.length);

        // Among apps with same error count, prefer ones with explicit startup forms
        const minErrors = sortedByErrors[0].errors.length;
        const appsWithMinErrors = sortedByErrors.filter(app => app.errors.length === minErrors);

        const appWithStartup = appsWithMinErrors.find(app => app.startupForm);
        if (appWithStartup) {
            return appWithStartup;
        }

        // Return first app with minimum errors
        return appsWithMinErrors[0];
    }

    /**
     * Get the currently deployed app (single app discovery for simple cases)
     */
    static async getCurrentApp(): Promise<DiscoveredApp | null> {
        const result = await this.discoverApps();

        if (result.errors.length > 0) {
            console.warn('App discovery warnings:', result.errors);
        }

        return result.primaryApp || null;
    }

    /**
     * Check if any apps are available
     */
    static async hasApps(): Promise<boolean> {
        try {
            const result = await this.discoverApps();
            return result.apps.length > 0;
        } catch (error) {
            console.error('Failed to check for apps:', error);
            return false;
        }
    }
}

// Export utility functions
export { AppDiscoveryService as default }; 