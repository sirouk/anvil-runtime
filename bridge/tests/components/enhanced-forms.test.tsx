import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import {
    TextBox,
    TextArea,
    RadioButton,
    DropDown,
    NumberBox,
    DatePicker
} from '../../src/lib/components/enhanced-forms';
import { ThemeProvider } from '../../src/lib/theme/theme-context';

// Helper to wrap components with ThemeProvider
const renderWithTheme = (component: React.ReactElement) => {
    return render(
        <ThemeProvider>
            {component}
        </ThemeProvider>
    );
};

describe('Enhanced Form Components', () => {
    describe('TextBox', () => {
        it('should render with initial text', () => {
            renderWithTheme(<TextBox text="Hello World" />);
            const input = screen.getByDisplayValue('Hello World');
            expect(input).toBeInTheDocument();
        });

        it('should handle value prop as well as text', () => {
            renderWithTheme(<TextBox value="Value prop" />);
            const input = screen.getByDisplayValue('Value prop');
            expect(input).toBeInTheDocument();
        });

        it('should call onChange when text changes', async () => {
            const onChange = jest.fn();
            renderWithTheme(<TextBox onChange={onChange} />);

            const input = screen.getByRole('textbox');
            await userEvent.type(input, 'New text');

            expect(onChange).toHaveBeenCalledWith('N');
            expect(onChange).toHaveBeenLastCalledWith('New text');
        });

        it('should handle onPressedEnter event', async () => {
            const onPressedEnter = jest.fn();
            renderWithTheme(<TextBox onPressedEnter={onPressedEnter} />);

            const input = screen.getByRole('textbox');
            fireEvent.keyDown(input, { key: 'Enter' });

            expect(onPressedEnter).toHaveBeenCalled();
        });

        it('should support password type', () => {
            const { container } = renderWithTheme(<TextBox type="password" />);
            const input = container.querySelector('input[type="password"]') as HTMLInputElement;
            expect(input).toBeInTheDocument();
            expect(input.type).toBe('password');
        });

        it('should show error state and message', () => {
            renderWithTheme(<TextBox error={true} errorText="Invalid input" />);
            expect(screen.getByText('Invalid input')).toBeInTheDocument();
        });

        it('should validate on blur', async () => {
            const validate = jest.fn((value) => value.length < 3 ? 'Too short' : null);
            renderWithTheme(<TextBox validate={validate} />);

            const input = screen.getByRole('textbox');
            await userEvent.type(input, 'Hi');
            fireEvent.blur(input);

            await waitFor(() => {
                expect(screen.getByText('Too short')).toBeInTheDocument();
            });
        });

        it('should handle required validation', async () => {
            renderWithTheme(<TextBox required />);

            const input = screen.getByRole('textbox');
            fireEvent.focus(input);
            fireEvent.blur(input);

            await waitFor(() => {
                expect(screen.getByText('This field is required')).toBeInTheDocument();
            });
        });

        it('should support multiline mode', () => {
            renderWithTheme(<TextBox multiline rows={5} />);
            const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
            expect(textarea.tagName).toBe('TEXTAREA');
            expect(textarea.rows).toBe(5);
        });

        it('should handle disabled state', () => {
            renderWithTheme(<TextBox enabled={false} />);
            const input = screen.getByRole('textbox');
            expect(input).toBeDisabled();
        });

        it('should handle readOnly state', () => {
            renderWithTheme(<TextBox readOnly />);
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.readOnly).toBe(true);
        });

        it('should select text on focus when selectOnFocus is true', async () => {
            renderWithTheme(<TextBox text="Select me" selectOnFocus />);
            const input = screen.getByRole('textbox') as HTMLInputElement;

            await userEvent.click(input);

            // Note: jsdom doesn't fully support selection, so we can't test the actual selection
            expect(document.activeElement).toBe(input);
        });
    });

    describe('TextArea', () => {
        it('should render as multiline TextBox', () => {
            renderWithTheme(<TextArea />);
            const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
            expect(textarea.tagName).toBe('TEXTAREA');
        });

        it('should auto-resize based on content', async () => {
            const { rerender } = renderWithTheme(<TextArea minRows={2} maxRows={5} />);
            const textarea = screen.getByRole('textbox');

            // Initial render
            expect(textarea).toHaveAttribute('rows', '2');

            // Note: Auto-resize testing is limited in jsdom environment
            // In a real browser, this would adjust rows based on content
        });

        it('should respect minRows and maxRows', () => {
            renderWithTheme(<TextArea minRows={3} maxRows={10} />);
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveAttribute('rows', '3');
        });

        it('should disable auto-resize when autoResize is false', () => {
            renderWithTheme(<TextArea autoResize={false} rows={4} />);
            const textarea = screen.getByRole('textbox');
            expect(textarea).toHaveAttribute('rows', '4');
        });
    });

    describe('RadioButton', () => {
        it('should render with text label', () => {
            renderWithTheme(<RadioButton text="Option 1" />);
            expect(screen.getByText('Option 1')).toBeInTheDocument();
        });

        it('should handle checked state', () => {
            renderWithTheme(<RadioButton checked={true} />);
            const radio = screen.getByRole('radio') as HTMLInputElement;
            expect(radio.checked).toBe(true);
        });

        it('should call onChange when clicked', async () => {
            const onChange = jest.fn();
            renderWithTheme(<RadioButton text="Click me" onChange={onChange} />);

            const label = screen.getByText('Click me');
            await userEvent.click(label);

            expect(onChange).toHaveBeenCalledWith(true);
        });

        it('should work with group name', () => {
            const { container } = renderWithTheme(
                <>
                    <RadioButton groupName="test-group" value="1" />
                    <RadioButton groupName="test-group" value="2" />
                </>
            );

            const radios = container.querySelectorAll('input[name="test-group"]');
            expect(radios).toHaveLength(2);
        });

        it('should handle disabled state', () => {
            renderWithTheme(<RadioButton enabled={false} />);
            const radio = screen.getByRole('radio');
            expect(radio).toBeDisabled();
        });

        it('should show error state', () => {
            renderWithTheme(<RadioButton error={true} errorText="Please select an option" />);
            expect(screen.getByText('Please select an option')).toBeInTheDocument();
        });
    });

    describe('DropDown', () => {
        const options = [
            { value: '1', label: 'Option 1' },
            { value: '2', label: 'Option 2' },
            { value: '3', label: 'Option 3', disabled: true }
        ];

        it('should render with options', () => {
            renderWithTheme(<DropDown items={options} />);

            expect(screen.getByText('Option 1')).toBeInTheDocument();
            expect(screen.getByText('Option 2')).toBeInTheDocument();
            expect(screen.getByText('Option 3')).toBeInTheDocument();
        });

        it('should render with string array items', () => {
            renderWithTheme(<DropDown items={['Apple', 'Banana', 'Cherry']} />);

            expect(screen.getByText('Apple')).toBeInTheDocument();
            expect(screen.getByText('Banana')).toBeInTheDocument();
            expect(screen.getByText('Cherry')).toBeInTheDocument();
        });

        it('should show placeholder when includeBlank is true', () => {
            renderWithTheme(<DropDown items={options} placeholder="Choose one" />);
            expect(screen.getByText('Choose one')).toBeInTheDocument();
        });

        it('should handle selectedValue', () => {
            renderWithTheme(<DropDown items={options} selectedValue="2" />);
            const select = screen.getByRole('combobox') as HTMLSelectElement;
            expect(select.value).toBe('2');
        });

        it('should call onChange when selection changes', async () => {
            const onChange = jest.fn();
            renderWithTheme(<DropDown items={options} onChange={onChange} />);

            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: '2' } });

            expect(onChange).toHaveBeenCalledWith('2');
        });

        it('should handle null value when blank is selected', async () => {
            const onChange = jest.fn();
            renderWithTheme(<DropDown items={options} selectedValue="1" onChange={onChange} />);

            const select = screen.getByRole('combobox');
            fireEvent.change(select, { target: { value: '' } });

            expect(onChange).toHaveBeenCalledWith(null);
        });

        it('should disable specific options', () => {
            renderWithTheme(<DropDown items={options} />);
            const disabledOption = screen.getByText('Option 3').closest('option');
            expect(disabledOption).toBeDisabled();
        });

        it('should handle disabled state', () => {
            renderWithTheme(<DropDown items={options} enabled={false} />);
            const select = screen.getByRole('combobox');
            expect(select).toBeDisabled();
        });
    });

    describe('NumberBox', () => {
        it('should render with numeric value', () => {
            renderWithTheme(<NumberBox value={42} />);
            const input = screen.getByDisplayValue('42');
            expect(input).toBeInTheDocument();
        });

        it('should format with decimal places', () => {
            renderWithTheme(<NumberBox value={42.5} decimalPlaces={2} />);
            const input = screen.getByDisplayValue('42.50');
            expect(input).toBeInTheDocument();
        });

        it('should format with thousands separator', () => {
            renderWithTheme(<NumberBox value={1234567} thousandsSeparator />);
            const input = screen.getByDisplayValue('1,234,567');
            expect(input).toBeInTheDocument();
        });

        it('should format with prefix and suffix', () => {
            renderWithTheme(<NumberBox value={99.99} prefix="$" suffix=" USD" />);
            const input = screen.getByDisplayValue('$99.99 USD');
            expect(input).toBeInTheDocument();
        });

        it('should validate min and max constraints', async () => {
            const onChange = jest.fn();
            renderWithTheme(<NumberBox min={0} max={100} onChange={onChange} />);

            const input = screen.getByRole('textbox');

            // Type value below min
            await userEvent.clear(input);
            await userEvent.type(input, '-10');
            fireEvent.blur(input);

            expect(onChange).toHaveBeenLastCalledWith(0); // Constrained to min

            // Type value above max
            await userEvent.clear(input);
            await userEvent.type(input, '150');
            fireEvent.blur(input);

            expect(onChange).toHaveBeenLastCalledWith(100); // Constrained to max
        });

        it('should parse formatted input correctly', async () => {
            const onChange = jest.fn();
            renderWithTheme(<NumberBox prefix="$" thousandsSeparator onChange={onChange} />);

            const input = screen.getByRole('textbox');

            // Clear and type raw number value (simulating focus behavior)
            await userEvent.clear(input);
            await userEvent.type(input, '1234.56');
            fireEvent.blur(input);

            // The last call should be with the parsed number
            expect(onChange).toHaveBeenLastCalledWith(1234.56);
        });

        it('should handle null value', () => {
            renderWithTheme(<NumberBox value={null} />);
            const input = screen.getByRole('textbox') as HTMLInputElement;
            expect(input.value).toBe('');
        });

        it('should show raw value on focus', async () => {
            renderWithTheme(<NumberBox value={1234.5} prefix="$" thousandsSeparator />);
            const input = screen.getByRole('textbox') as HTMLInputElement;

            expect(input.value).toBe('$1,234.5');

            fireEvent.focus(input);
            expect(input.value).toBe('1234.5');
        });
    });

    describe('DatePicker', () => {
        it('should render with date value', () => {
            const date = new Date('2024-01-15');
            renderWithTheme(<DatePicker date={date} />);
            const input = screen.getByDisplayValue('2024-01-15');
            expect(input).toBeInTheDocument();
        });

        it('should accept string date', () => {
            renderWithTheme(<DatePicker date="2024-01-15" />);
            const input = screen.getByDisplayValue('2024-01-15');
            expect(input).toBeInTheDocument();
        });

        it('should call onChange with Date object', async () => {
            const onChange = jest.fn();
            const { container } = renderWithTheme(<DatePicker onChange={onChange} />);

            const input = container.querySelector('input[type="date"]') as HTMLInputElement;
            fireEvent.change(input, { target: { value: '2024-01-20' } });

            expect(onChange).toHaveBeenCalled();
            const calledDate = onChange.mock.calls[0][0];
            expect(calledDate).toBeInstanceOf(Date);
            expect(calledDate.toISOString().split('T')[0]).toBe('2024-01-20');
        });

        it('should handle null date', () => {
            const { container } = renderWithTheme(<DatePicker date={null} />);
            const input = container.querySelector('input[type="date"]') as HTMLInputElement;
            expect(input.value).toBe('');
        });

        it('should enforce min and max dates', () => {
            const { container } = renderWithTheme(
                <DatePicker
                    minDate="2024-01-01"
                    maxDate="2024-12-31"
                />
            );

            const input = container.querySelector('input[type="date"]') as HTMLInputElement;
            expect(input.min).toBe('2024-01-01');
            expect(input.max).toBe('2024-12-31');
        });

        it('should handle disabled state', () => {
            const { container } = renderWithTheme(<DatePicker enabled={false} />);
            const input = container.querySelector('input[type="date"]') as HTMLInputElement;
            expect(input).toBeDisabled();
        });

        it('should show error state', () => {
            renderWithTheme(<DatePicker error={true} errorText="Invalid date" />);
            expect(screen.getByText('Invalid date')).toBeInTheDocument();
        });
    });

    describe('Common Form Features', () => {
        it('should respect visibility prop', () => {
            const { container } = renderWithTheme(<TextBox visible={false} />);
            expect(container.firstChild).toBeNull();
        });

        it('should apply layout props', () => {
            const { container } = renderWithTheme(
                <TextBox
                    width={300}
                    margin="10px"
                    padding={20}
                    spacingAbove="large"
                    spacingBelow="small"
                />
            );

            const input = screen.getByRole('textbox');
            expect(input).toHaveStyle({
                width: '300px',
                padding: '20px'
            });
            // Margin is modified by spacing props, so check the container has correct classes
            const inputContainer = container.querySelector('.anvil-textbox-container');
            expect(inputContainer).toBeInTheDocument();
        });

        it('should apply role styles from theme', () => {
            const { container } = renderWithTheme(
                <TextBox role="input" />
            );

            const inputContainer = container.querySelector('.anvil-role-input');
            expect(inputContainer).toBeInTheDocument();
        });

        it('should show tooltip on hover', () => {
            renderWithTheme(<TextBox tooltip="This is a helpful tip" />);
            const input = screen.getByRole('textbox');
            expect(input).toHaveAttribute('title', 'This is a helpful tip');
        });
    });
}); 