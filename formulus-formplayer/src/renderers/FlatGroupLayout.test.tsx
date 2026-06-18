// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CardGroupShell } from './FlatGroupLayout';

const theme = createTheme();

afterEach(() => cleanup());

describe('CardGroupShell', () => {
  it('renders group title and children', () => {
    render(
      <ThemeProvider theme={theme}>
        <CardGroupShell label="Sticker / amostra">
          <div data-testid="child">Field</div>
        </CardGroupShell>
      </ThemeProvider>,
    );
    expect(screen.getByText('Sticker / amostra')).toBeInTheDocument();
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
