import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider } from '../../src/lib/theme/theme-context';
import {
    Label,
    AnvilImage,
    Plot,
    RichText,
    FileLoader
} from '../../src/lib/components/enhanced-display-media';

// Helper to wrap components with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
    return render(
        <ThemeProvider>
            {component}
        </ThemeProvider>
    );
};

describe('Enhanced Display and Media Components', () => {
    describe('Label', () => {
        it('should render with basic text', () => {
            renderWithTheme(<Label text="Hello World" />);
            expect(screen.getByText('Hello World')).toBeInTheDocument();
        });

        it('should apply text formatting', () => {
            const { container } = renderWithTheme(
                <Label
                    text="Bold Italic Underlined"
                    bold={true}
                    italic={true}
                    underline={true}
                />
            );
            // Check the outer span which has the styling applied
            const labelContainer = container.firstElementChild as HTMLElement;
            expect(labelContainer).toHaveStyle({
                fontWeight: 'bold',
                fontStyle: 'italic',
                textDecoration: 'underline'
            });
        });

        it('should handle click events', () => {
            const handleClick = jest.fn();
            renderWithTheme(<Label text="Clickable" onClick={handleClick} />);
            fireEvent.click(screen.getByText('Clickable'));
            expect(handleClick).toHaveBeenCalledTimes(1);
        });

        it('should handle visibility prop', () => {
            renderWithTheme(<Label text="Hidden" visible={false} />);
            expect(screen.queryByText('Hidden')).not.toBeInTheDocument();
        });

        it('should show tooltip', () => {
            const { container } = renderWithTheme(<Label text="Tooltip Test" tooltip="This is a tooltip" />);
            // The tooltip is applied to the outer container element
            const parentElement = container.firstElementChild as HTMLElement;
            expect(parentElement).toHaveAttribute('title', 'This is a tooltip');
        });
    });

    describe('AnvilImage', () => {
        it('should render with string source', () => {
            renderWithTheme(<AnvilImage source="test-image.jpg" alt="Test Image" />);
            const img = screen.getByAltText('Test Image');
            expect(img).toBeInTheDocument();
            expect(img).toHaveAttribute('src', 'test-image.jpg');
        });

        it('should show placeholder when no source', () => {
            renderWithTheme(<AnvilImage alt="No Image" />);
            expect(screen.getByText('No image')).toBeInTheDocument();
        });

        it('should handle load event', () => {
            const handleLoad = jest.fn();
            const { container } = renderWithTheme(<AnvilImage source="test.jpg" onLoad={handleLoad} />);
            const img = container.querySelector('img');
            expect(img).not.toBeNull();
            fireEvent.load(img!);
            expect(handleLoad).toHaveBeenCalledTimes(1);
        });

        it('should handle visibility prop', () => {
            renderWithTheme(<AnvilImage source="test.jpg" visible={false} />);
            expect(screen.queryByRole('img')).not.toBeInTheDocument();
        });
    });

    describe('Plot', () => {
        it('should render loading state initially', () => {
            renderWithTheme(<Plot data={[]} />);
            expect(screen.getByText('Loading plot...')).toBeInTheDocument();
        });

        it('should handle visibility prop', () => {
            renderWithTheme(<Plot data={[]} visible={false} />);
            expect(screen.queryByText('Loading plot...')).not.toBeInTheDocument();
        });

        it('should apply custom dimensions', () => {
            renderWithTheme(<Plot data={[]} width={600} height={300} />);
            const container = screen.getByText('Loading plot...');
            expect(container).toHaveStyle({
                width: '600px',
                height: '300px'
            });
        });
    });

    describe('RichText', () => {
        it('should render with initial content', () => {
            renderWithTheme(<RichText content="<p>Rich text content</p>" />);
            expect(screen.getByText('Rich text content')).toBeInTheDocument();
        });

        it('should render formatting buttons when enabled', () => {
            renderWithTheme(<RichText enabled={true} />);
            expect(screen.getByText('B')).toBeInTheDocument();
            expect(screen.getByText('I')).toBeInTheDocument();
            expect(screen.getByText('U')).toBeInTheDocument();
        });

        it('should not render formatting buttons when disabled', () => {
            renderWithTheme(<RichText enabled={false} />);
            expect(screen.queryByText('B')).not.toBeInTheDocument();
        });

        it('should handle visibility prop', () => {
            renderWithTheme(<RichText visible={false} />);
            expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
        });
    });

    describe('FileLoader', () => {
        it('should render with placeholder text', () => {
            renderWithTheme(<FileLoader placeholder="Drop files here" />);
            expect(screen.getByText('Drop files here')).toBeInTheDocument();
        });

        it('should show selected file name', () => {
            const file = new File(['content'], 'test.txt', { type: 'text/plain' });
            renderWithTheme(<FileLoader file={file} />);
            expect(screen.getByText('test.txt')).toBeInTheDocument();
        });

        it('should handle click to open file dialog', () => {
            const mockClick = jest.fn();
            HTMLInputElement.prototype.click = mockClick;

            renderWithTheme(<FileLoader />);
            fireEvent.click(screen.getByText('Click to choose file or drag file here'));
            expect(mockClick).toHaveBeenCalledTimes(1);
        });

        it('should handle visibility prop', () => {
            renderWithTheme(<FileLoader visible={false} />);
            expect(screen.queryByText('Click to choose file or drag file here')).not.toBeInTheDocument();
        });
    });

    describe('Common Features', () => {
        it('should all support basic rendering', () => {
            const { container } = renderWithTheme(
                <div>
                    <Label text="Label" />
                    <AnvilImage source="test.jpg" />
                    <Plot data={[]} />
                    <RichText />
                    <FileLoader />
                </div>
            );

            // All components should be rendered (basic smoke test)
            expect(screen.getByText('Label')).toBeInTheDocument();
            expect(container.querySelector('img')).toBeInTheDocument();
            expect(screen.getByText('Loading plot...')).toBeInTheDocument();
            expect(container.querySelector('[contenteditable="true"]')).toBeInTheDocument();
            expect(screen.getByText('Click to choose file or drag file here')).toBeInTheDocument();
        });
    });
}); 