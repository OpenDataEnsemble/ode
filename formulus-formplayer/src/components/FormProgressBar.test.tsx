// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import FormProgressBar from './FormProgressBar';

const theme = createTheme();

afterEach(() => cleanup());

const renderBar = (
  props: Partial<React.ComponentProps<typeof FormProgressBar>> = {},
) =>
  render(
    <ThemeProvider theme={theme}>
      <FormProgressBar
        currentPage={0}
        totalScreens={3}
        mode="screens"
        onNavigatePrevious={vi.fn()}
        onNavigateNext={vi.fn()}
        {...props}
      />
    </ThemeProvider>,
  );

describe('FormProgressBar header navigation', () => {
  it('shows both chevrons on multi-page forms', () => {
    renderBar();
    expect(screen.getByLabelText('Previous screen')).toBeInTheDocument();
    expect(screen.getByLabelText('Next screen')).toBeInTheDocument();
  });

  it('disables previous chevron on first page', () => {
    renderBar({
      currentPage: 0,
      canNavigatePrevious: false,
      canNavigateNext: true,
    });
    expect(screen.getByLabelText('Previous screen')).toBeDisabled();
    expect(screen.getByLabelText('Next screen')).not.toBeDisabled();
  });

  it('disables next chevron on last page', () => {
    renderBar({
      currentPage: 2,
      canNavigatePrevious: true,
      canNavigateNext: false,
    });
    expect(screen.getByLabelText('Previous screen')).not.toBeDisabled();
    expect(screen.getByLabelText('Next screen')).toBeDisabled();
  });

  it('hides chevrons when only one screen', () => {
    renderBar({ totalScreens: 1 });
    expect(screen.queryByLabelText('Previous screen')).toBeNull();
    expect(screen.queryByLabelText('Next screen')).toBeNull();
  });

  it('calls navigation callbacks when enabled', () => {
    const onNavigatePrevious = vi.fn();
    const onNavigateNext = vi.fn();
    renderBar({
      currentPage: 1,
      canNavigatePrevious: true,
      canNavigateNext: true,
      onNavigatePrevious,
      onNavigateNext,
    });
    screen.getByLabelText('Previous screen').click();
    screen.getByLabelText('Next screen').click();
    expect(onNavigatePrevious).toHaveBeenCalledTimes(1);
    expect(onNavigateNext).toHaveBeenCalledTimes(1);
  });
});
