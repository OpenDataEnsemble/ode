import React, { ReactNode, useState, useEffect } from 'react';
import { Box, Paper, Stack } from '@mui/material';
import { Button } from '@ode/components/react-web';
import { tokens } from '../theme/tokens-adapter';

const parsePx = (value: string): number =>
  parseInt(String(value).replace('px', ''), 10);
const spacing5 = parsePx(tokens.spacing?.[5] ?? '20px');

interface FormLayoutProps {
  /**
   * The main form content to display
   */
  children: ReactNode;

  /**
   * Previous button configuration
   */
  previousButton?: {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
  };

  /**
   * Next button configuration
   */
  nextButton?: {
    label?: string;
    onClick: () => void;
    disabled?: boolean;
  };

  /**
   * Optional header content (e.g., progress bar)
   */
  header?: ReactNode;

  /**
   * Additional padding at the bottom of content area (in pixels)
   * Default: 6 * spacing[5] to ensure content is never hidden behind navigation
   */
  contentBottomPadding?: number;

  /**
   * Whether to show navigation buttons
   * Default: true
   */
  showNavigation?: boolean;
}

/**
 * FormLayout Component
 *
 * A robust, responsive layout component for forms that:
 * - Prevents navigation buttons from overlapping form content
 * - Handles mobile keyboard appearance correctly
 * - Ensures all form fields are scrollable and accessible
 * - Uses dynamic viewport height (100dvh) for proper mobile support
 *
 * Layout Structure:
 * - Header area (sticky at top, optional)
 * - Scrollable content area (flexible, with bottom padding)
 * - Navigation bar (sticky at bottom, non-overlapping)
 */
const FormLayout: React.FC<FormLayoutProps> = ({
  children,
  previousButton,
  nextButton,
  header,
  showNavigation = true,
}) => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [initialViewportHeight] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    if (window.visualViewport) {
      return window.visualViewport.height;
    }
    return window.innerHeight;
  });

  useEffect(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      const viewport = window.visualViewport;

      const handleViewportChange = () => {
        if (!viewport) return;

        const heightDifference = initialViewportHeight - viewport.height;
        const keyboardThreshold = initialViewportHeight * 0.15; // 15% of screen
        setIsKeyboardVisible(heightDifference > keyboardThreshold);
      };

      viewport.addEventListener('resize', handleViewportChange);
      viewport.addEventListener('scroll', handleViewportChange);
      handleViewportChange();

      return () => {
        viewport.removeEventListener('resize', handleViewportChange);
        viewport.removeEventListener('scroll', handleViewportChange);
      };
    } else {
      // Fallback for browsers without Visual Viewport API
      const initialHeight = window.innerHeight;
      const handleResize = () => {
        const currentHeight = window.innerHeight;
        setIsKeyboardVisible(currentHeight < initialHeight * 0.85);
      };

      window.addEventListener('resize', handleResize);
      handleResize();

      return () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }, []);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100dvh',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        WebkitOverflowScrolling: 'touch',
      }}>
      {header && (
        <Box
          sx={theme => ({
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: 'background.default',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            width: '100%',
            overflow: 'hidden',
            borderBottom: `1px solid ${theme.palette.divider}`,
          })}>
          {header}
        </Box>
      )}

      <Box
        sx={theme => ({
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingBottom:
            showNavigation &&
            (previousButton || nextButton) &&
            !isKeyboardVisible
              ? {
                  xs: `calc(${theme.spacing(11)} + env(safe-area-inset-bottom, 0px))`,
                  sm: `calc(${theme.spacing(12)} + env(safe-area-inset-bottom, 0px))`,
                  md: `calc(${theme.spacing(13)} + env(safe-area-inset-bottom, 0px))`,
                }
              : theme.spacing(4),
          overscrollBehavior: 'contain',
          position: 'relative',
        })}>
        {children}
      </Box>

      {showNavigation &&
        (previousButton || nextButton) &&
        !isKeyboardVisible && (
          <Paper
            elevation={0}
            sx={theme => ({
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: theme.zIndex.appBar,
              width: '100%',
              padding: {
                xs: theme.spacing(1, 1.5),
                sm: theme.spacing(1.5, 2),
                md: theme.spacing(1.5, 2.5),
              },
              paddingBottom: {
                xs: `calc(${theme.spacing(1)} + env(safe-area-inset-bottom, 0px))`,
                sm: `calc(${theme.spacing(1.5)} + env(safe-area-inset-bottom, 0px))`,
                md: `calc(${theme.spacing(1.5)} + env(safe-area-inset-bottom, 0px))`,
              },
              backgroundColor: 'background.default',
              borderTop: 'none',
              borderColor: 'transparent',
              boxShadow: 'none',
              transition:
                'opacity 0.2s ease-in-out, transform 0.2s ease-in-out',
              boxSizing: 'border-box',
            })}>
            <Stack
              direction="row"
              spacing={2}
              justifyContent="center"
              sx={{
                '& > *': {
                  flex: { xs: 1, sm: '0 1 auto' },
                  minWidth: {
                    xs: 'auto',
                    sm: `${spacing5 * 6}px`,
                    md: `${spacing5 * 7}px`,
                  },
                  maxWidth: { md: `${spacing5 * 10}px` },
                },
              }}>
              {previousButton && (
                <Button
                  variant="primary"
                  onPress={previousButton.onClick}
                  disabled={previousButton.disabled}
                  size="medium">
                  {previousButton.label || 'Previous'}
                </Button>
              )}
              {nextButton && (
                <Button
                  variant="primary"
                  onPress={nextButton.onClick}
                  disabled={nextButton.disabled}
                  size="medium"
                  className="button-reverse-primary">
                  {nextButton.label || 'Next'}
                </Button>
              )}
            </Stack>
          </Paper>
        )}
    </Box>
  );
};

export default FormLayout;
