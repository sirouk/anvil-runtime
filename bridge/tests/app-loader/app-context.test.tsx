/**
 * App Context Provider Test Suite
 * 
 * Tests for the AppContextProvider that manages global app state
 */

import React from 'react';
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { render, screen, waitFor, act } from '@testing-library/react';
import {
    AppContextProvider,
    useAppContext
} from '../../src/lib/app-loader/app-context';
import { AppDiscoveryService } from '../../src/lib/app-loader/app-discovery';

// Mock the dependencies
jest.mock('../../src/lib/app-loader/app-discovery');
jest.mock('next/navigation', () => ({
    useRouter: () => ({
        push: jest.fn(),
        replace: jest.fn(),
        back: jest.fn()
    })
}));

const mockAppDiscoveryService = AppDiscoveryService as jest.Mocked<typeof AppDiscoveryService>;

// Test component to access context
const TestComponent: React.FC = () => {
    const context = useAppContext();

    return (
        <div>
            <div data-testid="state-ready">{context.isReady.toString()}</div>
            <div data-testid="state-error">{context.hasError.toString()}</div>
            <div data-testid="app-name">{context.state.app?.name || 'no-app'}</div>
            <div data-testid="app-title">{context.appTitle}</div>
            <button
                data-testid="discover-apps"
                onClick={() => context.discoverApps()}
            >
                Discover Apps
            </button>
        </div>
    );
};

describe('AppContextProvider Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    describe('Basic Provider Functionality', () => {
        test('should provide initial state', () => {
            render(
                <AppContextProvider autoDiscover={false}>
                    <TestComponent />
                </AppContextProvider>
            );

            const readyElement = screen.getByTestId('state-ready');
            const errorElement = screen.getByTestId('state-error');
            const appElement = screen.getByTestId('app-name');
            const titleElement = screen.getByTestId('app-title');

            expect(readyElement.textContent).toBe('false');
            expect(errorElement.textContent).toBe('false');
            expect(appElement.textContent).toBe('no-app');
            expect(titleElement.textContent).toBe('Anvil Bridge App');
        });

        test('should provide context methods', () => {
            render(
                <AppContextProvider autoDiscover={false}>
                    <TestComponent />
                </AppContextProvider>
            );

            const discoverButton = screen.getByTestId('discover-apps');
            expect(discoverButton).toBeDefined();
            expect(discoverButton.textContent).toBe('Discover Apps');
        });
    });

    describe('Auto-Discovery', () => {
        test('should auto-discover apps when autoDiscover is true', async () => {
            const mockApp = {
                name: 'TestApp',
                path: '/test/path',
                config: {
                    name: 'TestApp',
                    package_name: 'test.app',
                    dependencies: [],
                    services: [],
                    allow_embedding: true,
                    runtime_options: { version: '3.0' },
                    metadata: { title: 'Test App' }
                },
                forms: new Map([
                    ['MainForm', {
                        components: [],
                        container: { type: 'ColumnPanel' },
                        is_package: false
                    } as any]
                ]),
                errors: [],
                startupForm: 'MainForm'
            };

            mockAppDiscoveryService.discoverApps.mockResolvedValue({
                apps: [mockApp],
                primaryApp: mockApp,
                errors: []
            });

            render(
                <AppContextProvider autoDiscover={true}>
                    <TestComponent />
                </AppContextProvider>
            );

            // Wait for discovery to complete
            await waitFor(() => {
                const readyElement = screen.getByTestId('state-ready');
                expect(readyElement.textContent).toBe('true');
            });

            const appElement = screen.getByTestId('app-name');
            const titleElement = screen.getByTestId('app-title');
            expect(appElement.textContent).toBe('TestApp');
            expect(titleElement.textContent).toBe('Test App');
        });

        test('should handle discovery errors', async () => {
            mockAppDiscoveryService.discoverApps.mockResolvedValue({
                apps: [],
                errors: ['No apps found'],
                primaryApp: undefined
            });

            render(
                <AppContextProvider autoDiscover={true}>
                    <TestComponent />
                </AppContextProvider>
            );

            await waitFor(() => {
                const errorElement = screen.getByTestId('state-error');
                expect(errorElement.textContent).toBe('true');
            });
        });
    });

    describe('Manual Operations', () => {
        test('should manually discover apps', async () => {
            const mockApp = {
                name: 'ManualApp',
                path: '/manual/path',
                config: {
                    name: 'ManualApp',
                    package_name: 'manual.app',
                    dependencies: [],
                    services: [],
                    allow_embedding: true,
                    runtime_options: { version: '3.0' },
                    metadata: { title: 'Manual App' }
                },
                forms: new Map([
                    ['Form1', {
                        components: [],
                        container: { type: 'ColumnPanel' },
                        is_package: false
                    } as any]
                ]),
                errors: [],
                startupForm: 'Form1'
            };

            mockAppDiscoveryService.discoverApps.mockResolvedValue({
                apps: [mockApp],
                primaryApp: mockApp,
                errors: []
            });

            render(
                <AppContextProvider autoDiscover={false}>
                    <TestComponent />
                </AppContextProvider>
            );

            // Initially no app
            const appElement = screen.getByTestId('app-name');
            expect(appElement.textContent).toBe('no-app');

            // Trigger manual discovery
            await act(async () => {
                screen.getByTestId('discover-apps').click();
            });

            await waitFor(() => {
                const appElement = screen.getByTestId('app-name');
                expect(appElement.textContent).toBe('ManualApp');
            });
        });
    });

    describe('Error Handling', () => {
        test('should handle context access outside provider', () => {
            // Mock console.error to avoid test output noise
            const originalError = console.error;
            console.error = jest.fn();

            expect(() => {
                render(<TestComponent />);
            }).toThrow('useAppContext must be used within an AppContextProvider');

            console.error = originalError;
        });

        test('should handle discovery service failures', async () => {
            mockAppDiscoveryService.discoverApps.mockRejectedValue(new Error('Service failure'));

            render(
                <AppContextProvider autoDiscover={true}>
                    <TestComponent />
                </AppContextProvider>
            );

            await waitFor(() => {
                const errorElement = screen.getByTestId('state-error');
                expect(errorElement.textContent).toBe('true');
            });
        });
    });
}); 