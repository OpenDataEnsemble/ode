// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import type { ControlProps } from '@jsonforms/core';
import { ChoiceControl, MultiChoiceControl } from './material-wrappers';

const theme = createTheme();

afterEach(() => cleanup());

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);

const enumSchema = { type: 'string', title: 'Color', enum: ['r', 'g'] };

describe('ChoiceControl (single-select)', () => {
  it('radio: selecting an option calls handleChange with the value', () => {
    const handleChange = vi.fn();
    renderWithTheme(
      <ChoiceControl
        {...({
          data: undefined,
          path: 'color',
          handleChange,
          schema: enumSchema,
          uischema: { type: 'Control', options: { display: 'radio' } },
          enabled: true,
        } as unknown as ControlProps)}
      />,
    );
    fireEvent.click(screen.getByText('g'));
    expect(handleChange).toHaveBeenCalledWith('color', 'g');
  });

  it('radio: tapping the selected option clears it (undefined)', () => {
    const handleChange = vi.fn();
    renderWithTheme(
      <ChoiceControl
        {...({
          data: 'r',
          path: 'color',
          handleChange,
          schema: enumSchema,
          uischema: { type: 'Control', options: { display: 'radio' } },
          enabled: true,
        } as unknown as ControlProps)}
      />,
    );
    fireEvent.click(screen.getByText('r'));
    expect(handleChange).toHaveBeenCalledWith('color', undefined);
  });

  it('buttons: tapping the selected button clears it (undefined)', () => {
    const handleChange = vi.fn();
    renderWithTheme(
      <ChoiceControl
        {...({
          data: 'r',
          path: 'color',
          handleChange,
          schema: enumSchema,
          uischema: { type: 'Control', options: { display: 'buttons' } },
          enabled: true,
        } as unknown as ControlProps)}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'r' }));
    expect(handleChange).toHaveBeenCalledWith('color', undefined);
  });
});

describe('MultiChoiceControl (multi-select)', () => {
  const arraySchema = {
    type: 'array',
    title: 'Tags',
    items: {
      oneOf: [
        { const: 'x', title: 'X' },
        { const: 'y', title: 'Y' },
      ],
    },
  };
  const options = [
    { label: 'X', value: 'x' },
    { label: 'Y', value: 'y' },
  ];

  it('checkboxes: toggling an unselected option adds it', () => {
    const addItem = vi.fn();
    const removeItem = vi.fn();
    const props = {
      data: [] as string[],
      options,
      addItem,
      removeItem,
      path: 'tags',
      schema: arraySchema,
      uischema: { type: 'Control', options: { display: 'checkboxes' } },
      enabled: true,
    };
    renderWithTheme(<MultiChoiceControl {...(props as any)} />);
    fireEvent.click(screen.getByText('X'));
    expect(addItem).toHaveBeenCalledWith('tags', 'x');
    expect(removeItem).not.toHaveBeenCalled();
  });

  it('checkboxes: toggling a selected option removes it', () => {
    const addItem = vi.fn();
    const removeItem = vi.fn();
    const props = {
      data: ['x'],
      options,
      addItem,
      removeItem,
      path: 'tags',
      schema: arraySchema,
      uischema: { type: 'Control', options: { display: 'checkboxes' } },
      enabled: true,
    };
    renderWithTheme(<MultiChoiceControl {...(props as any)} />);
    fireEvent.click(screen.getByText('X'));
    expect(removeItem).toHaveBeenCalledWith('tags', 'x');
  });
});
