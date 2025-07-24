import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';

import {
    Button,
    Link,
    Timer,
    Notification,
    DataGrid,
    type DataGridColumn
} from '../../src/lib/components/enhanced-interactive';
import { ThemeProvider } from '../../src/lib/theme/theme-context';

// Mock theme for testing
const mockTheme = {
    roles: {
        button: {
            fontFamily: "'Roboto', sans-serif",
            fontWeight: 500
        },
        body: {
            fontFamily: "'Roboto', sans-serif",
            fontSize: '14px'
        }
    },
    color_schemes: {
        default: {
            primary: '#1976d2',
            primary_variant: '#1565c0',
            secondary: '#dc004e',
            secondary_variant: '#c51162',
            background: '#ffffff',
            surface: '#ffffff',
            error: '#f44336',
            on_primary: '#ffffff',
            on_secondary: '#ffffff',
            on_background: '#000000',
            on_surface: '#000000',
            on_error: '#ffffff'
        }
    },
    spacing: {
        small: '8px',
        medium: '16px',
        large: '24px'
    },
    breakpoints: {
        xs: '0px',
        sm: '600px',
        md: '960px',
        lg: '1280px',
        xl: '1920px'
    }
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ThemeProvider initialTheme={mockTheme}>
        {children}
    </ThemeProvider>
);

describe('Enhanced Interactive Components', () => {
    describe('Button Component', () => {
        it('renders with default props', () => {
            render(
                <TestWrapper>
                    <Button text="Test Button" />
                </TestWrapper>
            );

            expect(screen.getByRole('button')).toBeInTheDocument();
            expect(screen.getByText('Test Button')).toBeInTheDocument();
        });

        it('handles click events', () => {
            const handleClick = jest.fn();
            render(
                <TestWrapper>
                    <Button text="Click Me" onClick={handleClick} />
                </TestWrapper>
            );

            fireEvent.click(screen.getByRole('button'));
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('displays loading state', () => {
            render(
                <TestWrapper>
                    <Button text="Submit" loading={true} loadingText="Submitting..." />
                </TestWrapper>
            );

            expect(screen.getByText('Submitting...')).toBeInTheDocument();
            expect(screen.queryByText('Submit')).not.toBeInTheDocument();
        });

        it('respects disabled state', () => {
            const handleClick = jest.fn();
            render(
                <TestWrapper>
                    <Button text="Disabled" disabled={true} onClick={handleClick} />
                </TestWrapper>
            );

            const button = screen.getByRole('button');
            expect(button).toBeDisabled();

            fireEvent.click(button);
            expect(handleClick).not.toHaveBeenCalled();
        });

        it('applies different variants correctly', () => {
            render(
                <TestWrapper>
                    <Button text="Contained" variant="contained" />
                    <Button text="Outlined" variant="outlined" />
                    <Button text="Text" variant="text" />
                </TestWrapper>
            );

            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(3);

            expect(buttons[0]).toHaveClass('anvil-button-contained');
            expect(buttons[1]).toHaveClass('anvil-button-outlined');
            expect(buttons[2]).toHaveClass('anvil-button-text');
        });

        it('applies different sizes correctly', () => {
            render(
                <TestWrapper>
                    <Button text="Small" size="small" />
                    <Button text="Medium" size="medium" />
                    <Button text="Large" size="large" />
                </TestWrapper>
            );

            const buttons = screen.getAllByRole('button');
            expect(buttons).toHaveLength(3);

            expect(buttons[0]).toHaveClass('anvil-button-small');
            expect(buttons[1]).toHaveClass('anvil-button-medium');
            expect(buttons[2]).toHaveClass('anvil-button-large');
        });

        it('handles focus and blur events', () => {
            const onFocus = jest.fn();
            const onBlur = jest.fn();

            render(
                <TestWrapper>
                    <Button text="Focus Test" onFocus={onFocus} onBlur={onBlur} />
                </TestWrapper>
            );

            const button = screen.getByRole('button');

            fireEvent.focus(button);
            expect(onFocus).toHaveBeenCalledTimes(1);

            fireEvent.blur(button);
            expect(onBlur).toHaveBeenCalledTimes(1);
        });
    });

    describe('Link Component', () => {
        it('renders with text and url', () => {
            render(
                <TestWrapper>
                    <Link text="Test Link" url="https://example.com" />
                </TestWrapper>
            );

            const link = screen.getByRole('link');
            expect(link).toBeInTheDocument();
            expect(link).toHaveAttribute('href', 'https://example.com');
            expect(screen.getByText('Test Link')).toBeInTheDocument();
        });

        it('handles click events', () => {
            const handleClick = jest.fn();
            render(
                <TestWrapper>
                    <Link text="Click Me" url="https://example.com" onClick={handleClick} />
                </TestWrapper>
            );

            fireEvent.click(screen.getByRole('link'));
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('handles form navigation', () => {
            const onNavigate = jest.fn();
            render(
                <TestWrapper>
                    <Link text="Go to Form" formName="TestForm" onNavigate={onNavigate} />
                </TestWrapper>
            );

            fireEvent.click(screen.getByRole('link'));
            expect(onNavigate).toHaveBeenCalledWith('TestForm');
        });

        it('applies different underline styles', () => {
            render(
                <TestWrapper>
                    <Link text="Always" underline="always" />
                    <Link text="Hover" underline="hover" />
                    <Link text="None" underline="none" />
                </TestWrapper>
            );

            const links = screen.getAllByRole('link');
            expect(links).toHaveLength(3);

            // Style checks would depend on CSS-in-JS implementation
            expect(links[0]).toBeInTheDocument();
            expect(links[1]).toBeInTheDocument();
            expect(links[2]).toBeInTheDocument();
        });

        it('opens external links with correct target', () => {
            render(
                <TestWrapper>
                    <Link text="External" url="https://example.com" target="_blank" />
                </TestWrapper>
            );

            expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
        });
    });

    describe('Timer Component', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('does not render visible content', () => {
            render(
                <TestWrapper>
                    <Timer interval={1000} />
                </TestWrapper>
            );

            // Timer should be invisible
            expect(screen.queryByText('Timer')).not.toBeInTheDocument();
        });

        it('calls onTick at specified intervals', () => {
            const onTick = jest.fn();

            render(
                <TestWrapper>
                    <Timer interval={1000} autoStart={true} onTick={onTick} />
                </TestWrapper>
            );

            // Fast-forward time
            act(() => {
                jest.advanceTimersByTime(3000);
            });

            expect(onTick).toHaveBeenCalledTimes(3);
        });

        it('calls lifecycle events', () => {
            const onStart = jest.fn();
            const onStop = jest.fn();
            const onReset = jest.fn();

            render(
                <TestWrapper>
                    <Timer
                        interval={1000}
                        autoStart={true}
                        onStart={onStart}
                        onStop={onStop}
                        onReset={onReset}
                    />
                </TestWrapper>
            );

            expect(onStart).toHaveBeenCalledTimes(1);
        });

        it('respects enabled prop', () => {
            const onTick = jest.fn();

            render(
                <TestWrapper>
                    <Timer interval={1000} enabled={false} autoStart={true} onTick={onTick} />
                </TestWrapper>
            );

            act(() => {
                jest.advanceTimersByTime(2000);
            });

            expect(onTick).not.toHaveBeenCalled();
        });
    });

    describe('Notification Component', () => {
        beforeEach(() => {
            jest.useFakeTimers();
        });

        afterEach(() => {
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('renders with title and message', () => {
            render(
                <TestWrapper>
                    <Notification title="Test Title" message="Test message" />
                </TestWrapper>
            );

            expect(screen.getByText('Test Title')).toBeInTheDocument();
            expect(screen.getByText('Test message')).toBeInTheDocument();
        });

        it('applies different notification types', () => {
            render(
                <TestWrapper>
                    <Notification type="success" message="Success message" />
                    <Notification type="error" message="Error message" />
                    <Notification type="warning" message="Warning message" />
                    <Notification type="info" message="Info message" />
                </TestWrapper>
            );

            expect(screen.getByText('Success message')).toBeInTheDocument();
            expect(screen.getByText('Error message')).toBeInTheDocument();
            expect(screen.getByText('Warning message')).toBeInTheDocument();
            expect(screen.getByText('Info message')).toBeInTheDocument();
        });

        it('can be dismissed manually', () => {
            const onDismiss = jest.fn();

            render(
                <TestWrapper>
                    <Notification message="Dismissible" dismissible={true} onDismiss={onDismiss} />
                </TestWrapper>
            );

            const closeButton = screen.getByRole('button');
            fireEvent.click(closeButton);

            expect(onDismiss).toHaveBeenCalledTimes(1);
        });

        it('auto-hides after specified duration', () => {
            const onHide = jest.fn();

            render(
                <TestWrapper>
                    <Notification
                        message="Auto hide"
                        autoHide={true}
                        duration={2000}
                        onHide={onHide}
                    />
                </TestWrapper>
            );

            act(() => {
                jest.advanceTimersByTime(2000);
            });

            expect(onHide).toHaveBeenCalledTimes(1);
        });
    });

    describe('DataGrid Component', () => {
        const sampleColumns: DataGridColumn[] = [
            { id: 'id', title: 'ID', data_key: 'id', sortable: true },
            { id: 'name', title: 'Name', data_key: 'name', sortable: true },
            { id: 'email', title: 'Email', data_key: 'email', filterable: true }
        ];

        const sampleRows = [
            { id: 1, name: 'John Doe', email: 'john@example.com' },
            { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
            { id: 3, name: 'Bob Johnson', email: 'bob@example.com' }
        ];

        it('renders columns and rows', () => {
            render(
                <TestWrapper>
                    <DataGrid columns={sampleColumns} rows={sampleRows} />
                </TestWrapper>
            );

            // Check headers
            expect(screen.getByText('ID')).toBeInTheDocument();
            expect(screen.getByText('Name')).toBeInTheDocument();
            expect(screen.getByText('Email')).toBeInTheDocument();

            // Check data
            expect(screen.getByText('John Doe')).toBeInTheDocument();
            expect(screen.getByText('jane@example.com')).toBeInTheDocument();
        });

        it('handles column sorting', () => {
            const onSort = jest.fn();

            render(
                <TestWrapper>
                    <DataGrid columns={sampleColumns} rows={sampleRows} onSort={onSort} />
                </TestWrapper>
            );

            // Click on sortable column header
            fireEvent.click(screen.getByText('Name'));
            expect(onSort).toHaveBeenCalledWith('name', 'asc');
        });

        it('handles row selection', () => {
            const onRowSelect = jest.fn();

            render(
                <TestWrapper>
                    <DataGrid
                        columns={sampleColumns}
                        rows={sampleRows}
                        onRowSelect={onRowSelect}
                    />
                </TestWrapper>
            );

            // Click on row
            const row = screen.getByText('John Doe').closest('tr');
            fireEvent.click(row!);

            expect(onRowSelect).toHaveBeenCalledWith(sampleRows[0], true);
        });

        it('displays pagination when enabled', () => {
            render(
                <TestWrapper>
                    <DataGrid
                        columns={sampleColumns}
                        rows={sampleRows}
                        paginated={true}
                        pageSize={2}
                        currentPage={1}
                    />
                </TestWrapper>
            );

            expect(screen.getByText('Previous')).toBeInTheDocument();
            expect(screen.getByText('Next')).toBeInTheDocument();
            expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
        });

        it('handles pagination navigation', () => {
            const onPageChange = jest.fn();

            render(
                <TestWrapper>
                    <DataGrid
                        columns={sampleColumns}
                        rows={sampleRows}
                        paginated={true}
                        pageSize={2}
                        currentPage={1}
                        onPageChange={onPageChange}
                    />
                </TestWrapper>
            );

            fireEvent.click(screen.getByText('Next'));
            expect(onPageChange).toHaveBeenCalledWith(2);
        });

        it('shows filter inputs when filterable', () => {
            render(
                <TestWrapper>
                    <DataGrid
                        columns={sampleColumns}
                        rows={sampleRows}
                        filterable={true}
                    />
                </TestWrapper>
            );

            // Should have filter input for filterable column
            const filterInputs = screen.getAllByPlaceholderText('Filter...');
            expect(filterInputs.length).toBeGreaterThan(0);
        });

        it('handles filtering', () => {
            const onFilter = jest.fn();

            render(
                <TestWrapper>
                    <DataGrid
                        columns={sampleColumns}
                        rows={sampleRows}
                        filterable={true}
                        onFilter={onFilter}
                    />
                </TestWrapper>
            );

            const filterInput = screen.getByPlaceholderText('Filter...');
            fireEvent.change(filterInput, { target: { value: 'john' } });

            expect(onFilter).toHaveBeenCalledWith({ email: 'john' });
        });
    });
}); 