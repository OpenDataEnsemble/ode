import React, { ReactNode, useState, useEffect } from 'react';
import { Box, Paper, Stack, Button } from '@mui/material';

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
   * Default: 120px to ensure content is never hidden behind navigation
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
  contentBottomPadding = 120,
  showNavigation = true,
}) => {
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.visualViewport) {
      const viewport = window.visualViewport;

      const handleViewportChange = () => {
        if (!viewport) return;

        const heightDifference = window.innerHeight - viewport.height;
        const keyboardThreshold = 150;
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
      const handleResize = () => {
        const currentHeight = window.innerHeight;
        const initialHeight = window.screen.height;
        setIsKeyboardVisible(currentHeight < initialHeight * 0.75);
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
      }}
    >
      {header && (
        <Box
          sx={{
            flexShrink: 0,
            position: 'sticky',
            top: 0,
            zIndex: 100,
            backgroundColor: 'background.default',
            paddingTop: 'env(safe-area-inset-top, 0px)',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            width: '100%',
            overflow: 'hidden',
          }}
        >
          {header}
        </Box>
      )}

      <Box
        sx={(theme) => ({
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          paddingBottom:
            showNavigation && (previousButton || nextButton) && !isKeyboardVisible
              ? {
                  xs: `calc(${theme.spacing(11)} + env(safe-area-inset-bottom, 0px))`,
                  sm: `calc(${theme.spacing(12)} + env(safe-area-inset-bottom, 0px))`,
                  md: `calc(${theme.spacing(13)} + env(safe-area-inset-bottom, 0px))`,
                }
              : theme.spacing(15),
          overscrollBehavior: 'contain',
          position: 'relative',
        })}
      >
        {children}
      </Box>

      {showNavigation && (previousButton || nextButton) && !isKeyboardVisible && (
        <Paper
          elevation={4}
          sx={(theme) => ({
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: theme.zIndex.appBar,
            width: '100%',
            padding: {
              xs: theme.spacing(1.5, 2),
              sm: theme.spacing(2, 3),
              md: theme.spacing(2.5, 4),
            },
            paddingBottom: {
              xs: `calc(${theme.spacing(1.5)} + env(safe-area-inset-bottom, 0px))`,
              sm: `calc(${theme.spacing(2)} + env(safe-area-inset-bottom, 0px))`,
              md: `calc(${theme.spacing(2.5)} + env(safe-area-inset-bottom, 0px))`,
            },
            backgroundColor: 'background.paper',
            borderTop: '1px solid',
            borderColor: 'divider',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out',
            boxSizing: 'border-box',
          })}
        >
          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            sx={{
              '& > *': {
                flex: { xs: 1, sm: '0 1 auto' },
                minWidth: { xs: 'auto', sm: '120px', md: '140px' },
                maxWidth: { md: '200px' },
              },
            }}
          >
            {previousButton && (
              <Button
                variant="outlined"
                onClick={previousButton.onClick}
                disabled={previousButton.disabled}
                fullWidth={false}
                sx={{
                  minHeight: { xs: '48px', sm: '48px', md: '52px' },
                  fontSize: { xs: '0.875rem', sm: '0.875rem', md: '0.9375rem' },
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                  },
                }}
              >
                {previousButton.label || 'Previous'}
              </Button>
            )}
            {nextButton && (
              <Button
                variant="contained"
                onClick={nextButton.onClick}
                disabled={nextButton.disabled}
                fullWidth={false}
                sx={{
                  minHeight: { xs: '48px', sm: '48px', md: '52px' },
                  fontSize: { xs: '0.875rem', sm: '0.875rem', md: '0.9375rem' },
                  fontWeight: 600,
                  boxShadow: 2,
                  '&:hover': {
                    boxShadow: 4,
                  },
                }}
              >
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
