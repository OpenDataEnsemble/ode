import React, { ReactNode, useState, useEffect, useCallback } from 'react';
import { Box, Paper, Stack } from '@mui/material';
import { Button } from '@ode/components/react-web';
import { tokens } from '../theme/tokens-adapter';

const parsePx = (value: string): number =>
  parseInt(String(value).replace('px', ''), 10);
const spacing5 = parsePx(tokens.spacing?.[5] ?? '20px');

/** Keeps a submit control in the DOM for IME Go/Send when the visible bar is hidden (e.g. keyboard open). */
const visuallyHiddenSubmitStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  border: 0,
};

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

  /**
   * When set, wraps the scroll area and nav in a `<form>` so mobile keyboards
   * (Go / Send / ->) submit this action. A visually hidden submit stays in the
   * DOM when the bottom bar is hidden (e.g. while the keyboard is open).
   */
  keyboardSubmitAction?: {
    onTrigger: () => void;
    disabled?: boolean;
  };
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
  keyboardSubmitAction,
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
    // initialViewportHeight is intentionally read only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFormSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!keyboardSubmitAction || keyboardSubmitAction.disabled) return;
      keyboardSubmitAction.onTrigger();
    },
    [keyboardSubmitAction],
  );

  const scrollArea = (
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
  );

  const navigationBar =
    showNavigation &&
    (previousButton || nextButton) &&
    !isKeyboardVisible ? (
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
          transition: 'opacity 0.2s ease-in-out, transform 0.2s ease-in-out',
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
              nativeType={keyboardSubmitAction ? 'submit' : 'button'}
              onPress={keyboardSubmitAction ? undefined : nextButton.onClick}
              disabled={nextButton.disabled}
              size="medium"
              className="button-reverse-primary">
              {nextButton.label || 'Next'}
            </Button>
          )}
        </Stack>
      </Paper>
    ) : null;

  const mainColumn = keyboardSubmitAction ? (
    <form
      onSubmit={handleFormSubmit}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
        margin: 0,
        position: 'relative',
      }}>
      {scrollArea}
      <button
        type="submit"
        aria-hidden={true}
        tabIndex={-1}
        disabled={Boolean(keyboardSubmitAction.disabled)}
        style={visuallyHiddenSubmitStyle}
      />
      {navigationBar}
    </form>
  ) : (
    <>
      {scrollArea}
      {navigationBar}
    </>
  );

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
            width: '100%',
            boxSizing: 'border-box',
            backgroundColor: 'background.default',
            paddingTop: `max(${theme.spacing(2)}, env(safe-area-inset-top, 0px))`,
            paddingRight: theme.spacing(2),
            paddingBottom: theme.spacing(2),
            paddingLeft: theme.spacing(2),
            overflow: 'visible',
            borderBottom: `1px solid ${theme.palette.divider}`,
            borderRadius: 0,
            boxShadow: 'none',
            minHeight: 82,
          })}>
          {header}
        </Box>
      )}

      {mainColumn}
    </Box>
  );
};

export default FormLayout;
