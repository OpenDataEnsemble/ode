import React from 'react';
import type { Preview } from '@storybook/react-vite';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { theme } from '../src/theme/theme';
import FormulusClient from '../src/services/FormulusInterface';

/** Ensure each story's `window.getFormulus` mock is picked up (singleton cache). */
function ClearFormulusBridgeCache({ children }: { children: React.ReactNode }) {
  FormulusClient.clearCachedFormulusApi();
  return <>{children}</>;
}

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
    Story => (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div style={{ padding: 24, maxWidth: 640 }}>
          <ClearFormulusBridgeCache>
            <Story />
          </ClearFormulusBridgeCache>
        </div>
      </ThemeProvider>
    ),
  ],
};

export default preview;
