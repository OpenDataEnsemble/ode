import React from 'react';
import type { Preview } from '@storybook/react-vite';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from '../src/theme/theme';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: 'centered',
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ padding: 24, maxWidth: 640 }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
};

export default preview;
