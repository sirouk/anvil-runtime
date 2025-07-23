import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
    HtmlPanel,
    GridPanel,
    ColumnPanel,
    LinearPanel,
    FlowPanel,
    XYPanel,
    withGridPosition,
    withXYPosition
} from '../../src/lib/components/enhanced-layouts';
import { ThemeProvider } from '../../src/lib/theme/theme-context';

// Mock the useTheme hook
jest.mock('../../src/lib/theme/theme-context', () => ({
    ...jest.requireActual('../../src/lib/theme/theme-context'),
    useTheme: () => ({
        name: 'test',
        config: {},
        activeColorScheme: 'primary',
        roles: {
            card: {
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                padding: '16px'
            }
        },
        colors: {},
        spacing: {
            small: '8px',
            medium: '16px',
            large: '24px'
        },
        breakpoints: {}
    })
}));

describe('Enhanced Layout Components', () => {
    describe('HtmlPanel', () => {
        it('should render with HTML content', () => {
            render(
                <HtmlPanel html="<h1>Test Content</h1>" />
            );

            const element = screen.getByText('Test Content');
            expect(element.tagName).toBe('H1');
        });

        it('should render children when no HTML provided', () => {
            render(
                <HtmlPanel>
                    <span>Child Content</span>
                </HtmlPanel>
            );

            expect(screen.getByText('Child Content')).toBeInTheDocument();
        });

        it('should apply layout props correctly', () => {
            const { container } = render(
                <HtmlPanel
                    width={300}
                    height="200px"
                    margin="10px"
                    padding={20}
                    spacingAbove="large"
                    spacingBelow="small"
                >
                    Content
                </HtmlPanel>
            );

            const panel = container.firstChild as HTMLElement;
            expect(panel).toHaveStyle({
                width: '300px',
                height: '200px',
                margin: '24px 10px 8px 10px',
                padding: '20px'
            });
        });

        it('should apply role styles', () => {
            const { container } = render(
                <HtmlPanel role="card">
                    Card Content
                </HtmlPanel>
            );

            const panel = container.firstChild as HTMLElement;
            expect(panel).toHaveClass('anvil-role-card');
            expect(panel).toHaveStyle({
                backgroundColor: '#ffffff',
                borderRadius: '8px',
                padding: '16px'
            });
        });

        it('should handle visibility prop', () => {
            const { rerender } = render(
                <HtmlPanel visible={false}>Hidden Content</HtmlPanel>
            );

            expect(screen.queryByText('Hidden Content')).not.toBeInTheDocument();

            rerender(<HtmlPanel visible={true}>Visible Content</HtmlPanel>);
            expect(screen.getByText('Visible Content')).toBeInTheDocument();
        });

        it('should render theme template with slots', () => {
            render(
                <HtmlPanel
                    theme="standard"
                    slots={{
                        title: <h1>Title</h1>,
                        'nav-right': <nav>Navigation</nav>,
                        'left-nav': <aside>Sidebar</aside>
                    }}
                >
                    Main Content
                </HtmlPanel>
            );

            expect(screen.getByText('Title')).toBeInTheDocument();
            expect(screen.getByText('Navigation')).toBeInTheDocument();
            expect(screen.getByText('Sidebar')).toBeInTheDocument();
            expect(screen.getByText('Main Content')).toBeInTheDocument();
        });
    });

    describe('GridPanel', () => {
        it('should render with default 12 columns', () => {
            const { container } = render(
                <GridPanel>
                    <div>Item 1</div>
                    <div>Item 2</div>
                </GridPanel>
            );

            const grid = container.firstChild as HTMLElement;
            expect(grid).toHaveStyle({
                display: 'grid',
                gridTemplateColumns: 'repeat(12, 1fr)'
            });
        });

        it('should apply custom columns and rows', () => {
            const { container } = render(
                <GridPanel columns={3} rows={2} gap="20px">
                    <div>Cell</div>
                </GridPanel>
            );

            const grid = container.firstChild as HTMLElement;
            expect(grid).toHaveStyle({
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridTemplateRows: 'repeat(2, auto)',
                gap: '20px'
            });
        });

        it('should apply grid position to children', () => {
            const { container } = render(
                <GridPanel>
                    <div {...{ gridPosition: { row: 'A', colSm: 2, widthSm: 8 } } as any}>
                        Grid Item
                    </div>
                </GridPanel>
            );

            const gridItem = screen.getByText('Grid Item');
            expect(gridItem).toHaveClass('col-sm-2 width-sm-8');
            expect(gridItem).toHaveStyle({ gridRow: 'A' });
        });
    });

    describe('ColumnPanel', () => {
        it('should render as vertical flex container', () => {
            const { container } = render(
                <ColumnPanel>
                    <div>Item 1</div>
                    <div>Item 2</div>
                </ColumnPanel>
            );

            const column = container.firstChild as HTMLElement;
            expect(column).toHaveStyle({
                display: 'flex',
                flexDirection: 'column'
            });
        });

        it('should apply spacing and alignment', () => {
            const { container } = render(
                <ColumnPanel spacing="large" align="center" justify="between">
                    <div>Item</div>
                </ColumnPanel>
            );

            const column = container.firstChild as HTMLElement;
            expect(column).toHaveStyle({
                gap: '24px',
                alignItems: 'center',
                justifyContent: 'space-between'
            });
        });
    });

    describe('LinearPanel', () => {
        it('should render vertical by default', () => {
            const { container } = render(
                <LinearPanel>
                    <div>Item</div>
                </LinearPanel>
            );

            const panel = container.firstChild as HTMLElement;
            expect(panel).toHaveClass('anvil-linear-vertical');
            expect(panel).toHaveStyle({ flexDirection: 'column' });
        });

        it('should render horizontal when specified', () => {
            const { container } = render(
                <LinearPanel orientation="horizontal">
                    <div>Item</div>
                </LinearPanel>
            );

            const panel = container.firstChild as HTMLElement;
            expect(panel).toHaveClass('anvil-linear-horizontal');
            expect(panel).toHaveStyle({ flexDirection: 'row' });
        });
    });

    describe('FlowPanel', () => {
        it('should render with flex wrap', () => {
            const { container } = render(
                <FlowPanel>
                    <div>Item</div>
                </FlowPanel>
            );

            const panel = container.firstChild as HTMLElement;
            expect(panel).toHaveStyle({
                display: 'flex',
                flexWrap: 'wrap'
            });
        });

        it('should handle wrap options', () => {
            const { container } = render(
                <FlowPanel wrap="wrap-reverse" direction="column">
                    <div>Item</div>
                </FlowPanel>
            );

            const panel = container.firstChild as HTMLElement;
            expect(panel).toHaveStyle({
                flexWrap: 'wrap-reverse',
                flexDirection: 'column'
            });
        });
    });

    describe('XYPanel', () => {
        it('should render as relative positioned container', () => {
            const { container } = render(
                <XYPanel>
                    <div>Content</div>
                </XYPanel>
            );

            const panel = container.firstChild as HTMLElement;
            expect(panel).toHaveStyle({
                position: 'relative',
                overflow: 'hidden'
            });
        });

        it('should apply absolute positioning to children with position prop', () => {
            render(
                <XYPanel>
                    <div {...{ position: { x: 100, y: 50, width: 200, height: 150 } } as any}>
                        Positioned Item
                    </div>
                </XYPanel>
            );

            const item = screen.getByText('Positioned Item');
            expect(item).toHaveStyle({
                position: 'absolute',
                left: '100px',
                top: '50px',
                width: '200px',
                height: '150px'
            });
        });

        it('should handle anchor-based positioning', () => {
            render(
                <XYPanel>
                    <div {...{ position: { anchor: 'center', width: 100, height: 100 } } as any}>
                        Centered
                    </div>
                </XYPanel>
            );

            const item = screen.getByText('Centered');
            expect(item).toHaveStyle({
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '100px',
                height: '100px'
            });
        });

        it('should handle different anchor positions', () => {
            const anchors = [
                { anchor: 'top-left', expected: { top: 0, left: 0 } },
                { anchor: 'top-right', expected: { top: 0, right: 0 } },
                { anchor: 'bottom-left', expected: { bottom: 0, left: 0 } },
                { anchor: 'bottom-right', expected: { bottom: 0, right: 0 } }
            ];

            anchors.forEach(({ anchor, expected }) => {
                const { container } = render(
                    <XYPanel>
                        <div {...{ position: { anchor: anchor as any } } as any}>Item</div>
                    </XYPanel>
                );

                const item = container.querySelector('.anvil-xy-panel > div') as HTMLElement;
                Object.entries(expected).forEach(([prop, value]) => {
                    expect(item).toHaveStyle({ [prop]: value });
                });
            });
        });
    });

    describe('Helper Functions', () => {
        it('withGridPosition should pass through props', () => {
            const TestComponent: React.FC<{ text: string }> = ({ text }) => <div>{text}</div>;
            const WrappedComponent = withGridPosition(TestComponent);

            render(
                <WrappedComponent
                    text="Test"
                    gridPosition={{ row: 'A', colSm: 4 }}
                />
            );

            expect(screen.getByText('Test')).toBeInTheDocument();
        });

        it('withXYPosition should pass through props', () => {
            const TestComponent: React.FC<{ label: string }> = ({ label }) => <span>{label}</span>;
            const WrappedComponent = withXYPosition(TestComponent);

            render(
                <WrappedComponent
                    label="Positioned"
                    position={{ x: 0, y: 0 }}
                />
            );

            expect(screen.getByText('Positioned')).toBeInTheDocument();
        });
    });

    describe('Responsive Behavior', () => {
        it('should generate responsive grid classes', () => {
            const { container } = render(
                <GridPanel>
                    <div {...{
                        gridPosition: {
                            colXs: 12,
                            colSm: 6,
                            colMd: 4,
                            colLg: 3,
                            colXl: 2
                        }
                    } as any}>
                        Responsive Item
                    </div>
                </GridPanel>
            );

            const item = screen.getByText('Responsive Item');
            expect(item).toHaveClass('col-xs-12 col-sm-6 col-md-4 col-lg-3 col-xl-2');
        });
    });
}); 