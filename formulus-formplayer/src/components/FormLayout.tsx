import React, { ReactNode, useCallback } from 'react';
import { Box, Paper } from '@mui/material';
import { Button } from '@ode/components/react-web';
import { useKeyboardScrollClamp } from '../hooks/useKeyboardScrollClamp';

/** Keeps a submit control in the DOM so mobile keyboards can trigger the primary action (Go / Send / →). */
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
   * (Go / Send / →) submit this action via a visually hidden submit control.
   */
  keyboardSubmitAction?: {
    onTrigger: () => void;
    disabled?: boolean;
  };

  /**
   * Optional ref callback merged with the internal keyboard scroll ref
   * (e.g. react-swipeable on the scroll area).
   */
  scrollRefMerge?: (el: HTMLDivElement | null) => void;

  /** Extra props spread onto the scroll area (e.g. swipe gesture handlers). */
  scrollHandlers?: Record<string, unknown>;
}

/**
 * FormLayout Component
 *
 * A robust, responsive layout component for forms that:
 * - Prevents navigation buttons from overlapping form content
 * - Keeps prev/next in normal flex flow at the bottom of the WebView so when the
 *   host app resizes the WebView for the keyboard (e.g. Android adjustResize), the
 *   bar stays at the bottom of the visible area without visualViewport math.
 * - Web content fills the WebView with height: 100% (not dvh) so keyboard inset
 *   is not double-counted when the host also shrinks the WebView.
 *
 * Layout Structure:
 * - Header area (sticky at top, optional)
 * - Scrollable content area (flexible, minHeight 0)
 * - Navigation bar (flex-shrink 0 at bottom of column — not position:fixed)
 */
const FormLayout: React.FC<FormLayoutProps> = ({
  children,
  previousButton,
  nextButton,
  header,
  showNavigation = true,
  keyboardSubmitAction,
  contentBottomPadding = 0,
  scrollRefMerge,
  scrollHandlers,
}) => {
  const scrollRef = useKeyboardScrollClamp<HTMLDivElement>();

  const mergedScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      scrollRef.current = el;
      scrollRefMerge?.(el);
    },
    [scrollRef, scrollRefMerge],
  );

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
      ref={mergedScrollRef}
      data-testid="formplayer-scroll-area"
      {...scrollHandlers}
      sx={theme => ({
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        backgroundColor: 'background.default',
        // Base breathing room + caller-provided extra so the last fields can
        // scroll clear of the nav bar / on-screen keyboard.
        paddingBottom: `calc(${theme.spacing(2)} + ${contentBottomPadding}px)`,
        overscrollBehavior: 'contain',
        position: 'relative',
      })}>
      {children}
    </Box>
  );

  const navigationBar =
    showNavigation && (previousButton || nextButton) ? (
      <Paper
        elevation={0}
        sx={theme => ({
          flexShrink: 0,
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
          borderTop: `1px solid ${theme.palette.divider}`,
          borderRadius: 0,
          boxShadow: 'none',
          boxSizing: 'border-box',
        })}>
        <Box
          sx={theme => ({
            display: 'flex',
            flexDirection: 'row',
            width: '100%',
            alignItems: 'stretch',
            gap: theme.spacing(1),
          })}>
          <Box
            sx={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'flex',
              alignItems: 'stretch',
            }}>
            {previousButton && (
              <Button
                variant="primary"
                onPress={previousButton.onClick}
                disabled={previousButton.disabled}
                size="medium"
                style={{ width: '100%', maxWidth: '100%' }}>
                {previousButton.label || 'Previous'}
              </Button>
            )}
          </Box>
          <Box
            sx={{
              flex: '1 1 0',
              minWidth: 0,
              display: 'flex',
              alignItems: 'stretch',
            }}>
            {nextButton && (
              <Button
                variant="primary"
                nativeType={keyboardSubmitAction ? 'submit' : 'button'}
                onPress={keyboardSubmitAction ? undefined : nextButton.onClick}
                disabled={nextButton.disabled}
                size="medium"
                className="formplayer-solid-primary"
                style={{ width: '100%', maxWidth: '100%' }}>
                {nextButton.label || 'Next'}
              </Button>
            )}
          </Box>
        </Box>
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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        width: '100%',
      }}>
      {scrollArea}
      {navigationBar}
    </Box>
  );

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
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
            paddingTop: `max(${theme.spacing(0.5)}, env(safe-area-inset-top, 0px))`,
            paddingRight: theme.spacing(1.5),
            paddingBottom: theme.spacing(0.5),
            paddingLeft: theme.spacing(1.5),
            overflow: 'visible',
            borderBottom: `1px solid ${theme.palette.divider}`,
            borderRadius: 0,
            boxShadow: 'none',
          })}>
          {header}
        </Box>
      )}

      {mainColumn}
    </Box>
  );
};

export default FormLayout;
