import React, {
  useCallback,
  useState,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import { createPortal } from 'react-dom';
import {
  JsonFormsDispatch,
  withJsonFormsControlProps,
  useJsonForms,
} from '@jsonforms/react';
import {
  ControlElement,
  ControlProps,
  createAjv,
  rankWith,
  uiTypeIs,
  RankedTester,
  JsonSchema7,
} from '@jsonforms/core';
import { useSwipeable } from 'react-swipeable';
import { Box, Typography, useTheme } from '@mui/material';
import { Button } from '@ode/components/react-web';
import { FormContext, useFormContext } from '../App';
import { primaryKeyboardEnterKeyHint } from '../utils/keyboardEnterKeyHint';
import { draftService } from '../services/DraftService';
import FormProgressBar from '../components/FormProgressBar';
import FormLayout from '../components/FormLayout';
import {
  FormDensityContext,
  type LabelLayout,
} from '../context/FormDensityContext';
import {
  collectVisibleControlsInSubtree,
  pageIsVisibleInSwipe,
  visiblePageIndicesFromLayouts,
} from './swipeLayoutVisibility';
import {
  findAutoFocusPropertyPath,
  focusFieldInContainer,
  focusFirstEnabledTextInput,
} from '../utils/autofocusHelpers';
import { navigateToFirstBlockingError } from '../utils/validationNavigation';
import { formatBlockingErrorSummary } from '../utils/errorPageNavigation';
import { useOdeT } from '../i18n/useOdeT';

// ---------------------------------------------------------------------------
// Testers
// ---------------------------------------------------------------------------

interface SwipeLayoutProps extends ControlProps {
  currentPage: number;
  onPageChange: (page: number) => void;
}

export const swipeLayoutTester: RankedTester = rankWith(
  3,
  uiTypeIs('SwipeLayout'),
);

const isGroupElement = (uischema: any): boolean => {
  return uischema && uischema.type === 'Group';
};

export const groupAsSwipeLayoutTester: RankedTester = rankWith(
  2,
  isGroupElement,
);

// ---------------------------------------------------------------------------
// SwipeLayoutRenderer
// ---------------------------------------------------------------------------

// Match ConfirmModal – solid card, no semi-transparent overlay
const CONFIRM_CARD_RADIUS = 0.7;
const CONFIRM_BORDER_WIDTH = 1;
const CONFIRM_CARD_PADDING = 16;

const SwipeLayoutRenderer = ({
  schema,
  uischema,
  data,
  handleChange,
  path,
  renderers,
  cells,
  enabled,
  visible,
  currentPage,
  onPageChange,
}: SwipeLayoutProps) => {
  const theme = useTheme();
  const [isNavigating, setIsNavigating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<number | null>(
    null,
  );
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const { core, config } = useJsonForms();
  const t = useOdeT();
  const parentFormContext = useFormContext();
  const { formInitData } = parentFormContext;

  const fallbackAjv = useMemo(() => createAjv(), []);
  const ajv = core?.ajv ?? fallbackAjv;

  const uiType = (uischema as any).type;
  const isExplicitSwipeLayout = uiType === 'SwipeLayout';

  const layouts = useMemo(() => {
    return isExplicitSwipeLayout
      ? (uischema as any).elements || []
      : [uischema];
  }, [uischema, isExplicitSwipeLayout]);

  const { swipeOptions, nextButtonLabelOption, finalizeButtonLabelOption } =
    useMemo(() => {
      const raw = (uischema as any)?.options ?? {};
      const nextRaw = raw.nextButtonLabel;
      const finRaw = raw.finalizeButtonLabel;
      return {
        swipeOptions: raw,
        nextButtonLabelOption:
          typeof nextRaw === 'string' && nextRaw.trim() !== ''
            ? nextRaw
            : undefined,
        finalizeButtonLabelOption:
          typeof finRaw === 'string' && finRaw.trim() !== ''
            ? finRaw
            : undefined,
      };
    }, [uischema]);

  const autoFocusFirstInput = swipeOptions.autoFocusFirstInput === true;
  const labelLayout: LabelLayout =
    swipeOptions.labelLayout === 'stacked' ? 'stacked' : 'inline';
  const showInnerTitle = swipeOptions.showInnerTitle === true;
  const skipFinalize = Boolean(
    (formInitData as { skipFinalize?: boolean } | null)?.skipFinalize,
  );

  const swipeScreenRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled || !swipeScreenRef.current) return;
      const pageUi = layouts[currentPage];
      const propPath = findAutoFocusPropertyPath(pageUi);
      if (propPath && focusFieldInContainer(swipeScreenRef.current, propPath)) {
        return;
      }
      if (autoFocusFirstInput) {
        focusFirstEnabledTextInput(swipeScreenRef.current);
      }
    }, 150);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentPage, autoFocusFirstInput, layouts]);

  if (typeof handleChange !== 'function') {
    console.warn(
      "Property 'handleChange'<function>  was not supplied to SwipeLayoutRenderer",
    );
    handleChange = () => {};
  }

  // ----- Visibility-aware navigation helpers -----

  /** Indices of pages that are currently visible given the form data. */
  const visiblePageIndices = useMemo(() => {
    return visiblePageIndicesFromLayouts(
      layouts,
      data,
      path ?? '',
      ajv,
      config,
    );
  }, [layouts, data, path, ajv, config]);

  /** Next visible page after `currentPage`, or null. */
  const nextVisiblePage = useMemo((): number | null => {
    for (const idx of visiblePageIndices) {
      if (idx > currentPage) return idx;
    }
    return null;
  }, [visiblePageIndices, currentPage]);

  /** Previous visible page before `currentPage`, or null. */
  const prevVisiblePage = useMemo((): number | null => {
    for (let i = visiblePageIndices.length - 1; i >= 0; i--) {
      if (visiblePageIndices[i] < currentPage) return visiblePageIndices[i];
    }
    return null;
  }, [visiblePageIndices, currentPage]);

  /** Position of `currentPage` among visible pages (for the progress bar). */
  const visiblePosition = useMemo(() => {
    const idx = visiblePageIndices.indexOf(currentPage);
    if (idx >= 0) return idx;
    // Fallback: count visible pages that precede the current one
    return visiblePageIndices.filter((i: number) => i < currentPage).length;
  }, [visiblePageIndices, currentPage]);

  const totalVisibleScreens = visiblePageIndices.length;

  // Auto-skip: if the current page becomes hidden (e.g. data changed on a
  // prior page), jump to the nearest visible page.
  useEffect(() => {
    if (layouts.length === 0) return;
    if (
      pageIsVisibleInSwipe(layouts[currentPage], data, path ?? '', ajv, config)
    ) {
      return;
    }

    // Prefer advancing forward, fall back to going backward
    const next = visiblePageIndices.find((i: number) => i > currentPage);
    if (next !== undefined) {
      onPageChange(next);
      return;
    }
    const prev = [...visiblePageIndices].reverse().find(i => i < currentPage);
    if (prev !== undefined) {
      onPageChange(prev);
    }
  }, [
    currentPage,
    data,
    layouts,
    visiblePageIndices,
    onPageChange,
    path,
    ajv,
    config,
  ]);

  // ----- Required-field validation -----

  const getMissingRequiredFieldsOnPage = useCallback((): string[] => {
    if (!core?.schema || !data || !layouts[currentPage]) return [];

    const currentPageElement = layouts[currentPage];
    const fullSchema = core.schema;
    const errors = core.errors || [];
    const missingFields: string[] = [];

    const getFieldSchema = (fieldPath: string): any => {
      const pathParts = fieldPath.replace(/^#\/properties\//, '').split('/');
      let currentSchema = fullSchema;
      for (const part of pathParts) {
        if (currentSchema?.properties?.[part]) {
          currentSchema = currentSchema.properties[part];
        } else {
          return null;
        }
      }
      return currentSchema;
    };

    const isEmpty = (value: any): boolean => {
      if (value === null || value === undefined || value === '') return true;
      if (Array.isArray(value) && value.length === 0) return true;
      if (
        typeof value === 'object' &&
        !Array.isArray(value) &&
        Object.keys(value).length === 0
      )
        return true;
      return false;
    };

    const pageControls = collectVisibleControlsInSubtree(
      currentPageElement,
      data,
      path ?? '',
      ajv,
      config,
    );

    pageControls.forEach(control => {
      const c = control as ControlElement;
      if (!c.scope) return;

      const fieldPath = c.scope;
      const fieldSchema = getFieldSchema(fieldPath);
      if (!fieldSchema) return;

      const pathParts = fieldPath.replace(/^#\/properties\//, '').split('/');
      let fieldValue = data;
      for (const part of pathParts) {
        if (fieldValue && typeof fieldValue === 'object') {
          fieldValue = fieldValue[part];
        } else {
          fieldValue = undefined;
          break;
        }
      }

      const parentPath = pathParts.slice(0, -1);
      const fieldName = pathParts[pathParts.length - 1];
      let parentSchema: any = fullSchema;

      for (const part of parentPath) {
        if (parentSchema?.properties?.[part]) {
          parentSchema = parentSchema.properties[part];
        } else {
          parentSchema = undefined;
          break;
        }
      }

      const isRequired = parentSchema?.required?.includes(fieldName);

      if (isRequired && isEmpty(fieldValue)) {
        const hasError = errors.some((error: any) => {
          const errorPath = error.instancePath || error.path;
          return (
            errorPath &&
            fieldPath.includes(errorPath.replace(/^\//, '').replace(/\//g, '/'))
          );
        });

        if (!hasError) {
          const label = fieldSchema.title || fieldName;
          if (!missingFields.includes(label)) {
            missingFields.push(label);
          }
        }
      }
    });

    return missingFields;
  }, [core, data, layouts, currentPage, path, ajv, config]);

  // ----- Navigation -----

  const performNavigation = useCallback(
    (newPage: number) => {
      if (isNavigating) return;

      setIsNavigating(true);
      onPageChange(newPage);

      setTimeout(() => {
        setIsNavigating(false);
      }, 100);
    },
    [isNavigating, onPageChange],
  );

  const navigateToPage = useCallback(
    (newPage: number) => {
      if (isNavigating) return;

      const isNavigatingForward = newPage > currentPage;
      const isOnFinalize = layouts[currentPage]?.type === 'Finalize';

      // Deferred validation: once the enumerator moves forward, surface
      // validation so empty/invalid required fields they are leaving behind are
      // highlighted. App.tsx listens and switches JsonForms to ValidateAndShow.
      if (isNavigatingForward) {
        window.dispatchEvent(new CustomEvent('formShowValidation'));
      }

      if (isNavigatingForward && !isOnFinalize) {
        const missingFields = getMissingRequiredFieldsOnPage();

        if (missingFields.length > 0) {
          const message = t(
            'validation.missingRequiredFieldsNamed',
            `Missing required field(s): ${missingFields.slice(0, 2).join(', ')}${missingFields.length > 2 ? '...' : ''}`,
            {
              names: `${missingFields.slice(0, 2).join(', ')}${missingFields.length > 2 ? '...' : ''}`,
            },
          );

          setPendingNavigation(newPage);
          setSnackbarMessage(message);
          setSnackbarOpen(true);
          performNavigation(newPage);
          return;
        }
      }

      if (snackbarOpen) {
        setSnackbarOpen(false);
        setPendingNavigation(null);
      }
      performNavigation(newPage);
    },
    [
      isNavigating,
      currentPage,
      layouts,
      getMissingRequiredFieldsOnPage,
      performNavigation,
      snackbarOpen,
      t,
    ],
  );

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      if (nextVisiblePage !== null) navigateToPage(nextVisiblePage);
    },
    onSwipedRight: () => {
      if (prevVisiblePage !== null) navigateToPage(prevVisiblePage);
    },
  });

  const { ref: swipeableRef, ...swipeHandlers } = handlers;

  const mergeScrollRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (typeof swipeableRef === 'function') {
        swipeableRef(el);
      }
    },
    [swipeableRef],
  );

  const setSwipeScreenRef = useCallback((el: HTMLDivElement | null) => {
    swipeScreenRef.current = el;
  }, []);

  const isOnFinalizePage = useMemo(() => {
    return layouts[currentPage]?.type === 'Finalize';
  }, [layouts, currentPage]);

  const isLastContentPage = nextVisiblePage === null && !isOnFinalizePage;

  const validationErrorCount = core?.errors?.length ?? 0;

  const validationAlertMessage = useMemo(() => {
    const errors = core?.errors ?? [];
    if (errors.length === 0) return '';
    return formatBlockingErrorSummary(
      errors,
      (core?.schema ?? schema) as JsonSchema7,
      3,
      t,
    );
  }, [core?.errors, core?.schema, schema, t]);

  const trySubmitForm = useCallback(() => {
    if (!formInitData) return;
    const errors = core?.errors ?? [];
    if (errors.length > 0) {
      navigateToFirstBlockingError(errors);
      return;
    }
    window.dispatchEvent(new CustomEvent('formShowValidation'));
    window.dispatchEvent(
      new CustomEvent('finalizeForm', {
        detail: { formInitData, data },
      }),
    );
  }, [formInitData, data, core?.errors]);

  const keyboardSubmitAction = useMemo(() => {
    const errorCount = core?.errors?.length ?? 0;
    if (isOnFinalizePage) {
      return {
        onTrigger: trySubmitForm,
        disabled: errorCount > 0 || !formInitData || isNavigating,
      };
    }
    if (skipFinalize && isLastContentPage) {
      return {
        onTrigger: trySubmitForm,
        disabled: !formInitData || isNavigating,
      };
    }
    if (nextVisiblePage !== null) {
      return {
        onTrigger: () => navigateToPage(nextVisiblePage),
        disabled: isNavigating,
      };
    }
    return undefined;
  }, [
    isOnFinalizePage,
    nextVisiblePage,
    navigateToPage,
    isNavigating,
    core?.errors,
    formInitData,
    trySubmitForm,
    skipFinalize,
    isLastContentPage,
  ]);

  const keyboardEnterKeyHint = useMemo(
    () =>
      primaryKeyboardEnterKeyHint(
        isOnFinalizePage,
        nextVisiblePage !== null ? nextButtonLabelOption : undefined,
        finalizeButtonLabelOption ?? t('nav.finalize', 'Finalize'),
      ),
    [
      isOnFinalizePage,
      nextVisiblePage,
      nextButtonLabelOption,
      finalizeButtonLabelOption,
      t,
    ],
  );

  const formContextForSwipe = useMemo(
    () => ({
      ...parentFormContext,
      keyboardEnterKeyHint,
    }),
    [parentFormContext, keyboardEnterKeyHint],
  );

  const handleSnackbarClose = useCallback(
    (event?: React.SyntheticEvent | Event, reason?: string) => {
      if (reason === 'clickaway') {
        return;
      }
      setSnackbarOpen(false);
      setPendingNavigation(null);
    },
    [],
  );

  const handleGoBack = useCallback(() => {
    setSnackbarOpen(false);
    if (pendingNavigation !== null && prevVisiblePage !== null) {
      performNavigation(prevVisiblePage);
    }
    setPendingNavigation(null);
    setSnackbarMessage('');
  }, [pendingNavigation, prevVisiblePage, performNavigation]);

  // ----- Header options (author-configurable) -----

  const headerTitle: string | undefined =
    swipeOptions.headerTitle || (schema as any)?.title || undefined;
  const headerFields: string[] = (swipeOptions.headerFields || []).slice(0, 2);

  const densityContextValue = useMemo(
    () => ({ labelLayout, groupVariant: 'flat' as const }),
    [labelLayout],
  );

  if (visible === false) {
    return null;
  }

  // ----- Render -----

  return (
    <FormDensityContext.Provider value={densityContextValue}>
      <FormContext.Provider value={formContextForSwipe}>
        <FormLayout
          keyboardSubmitAction={keyboardSubmitAction}
          scrollRefMerge={mergeScrollRef}
          scrollHandlers={swipeHandlers}
          header={
            <>
              <FormProgressBar
                currentPage={visiblePosition}
                totalScreens={totalVisibleScreens}
                data={data}
                schema={schema}
                uischema={uischema}
                mode="screens"
                isOnFinalizePage={isOnFinalizePage}
                canNavigatePrevious={prevVisiblePage !== null}
                canNavigateNext={nextVisiblePage !== null}
                onNavigatePrevious={() => {
                  if (prevVisiblePage !== null) navigateToPage(prevVisiblePage);
                }}
                onNavigateNext={() => {
                  if (nextVisiblePage !== null) navigateToPage(nextVisiblePage);
                }}
                navigationDisabled={isNavigating}
              />
              {headerFields.length > 0 && (
                <Box
                  sx={theme => ({
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 0.5,
                    py: 0.5,
                    px: { xs: 0.5, sm: 1 },
                    borderTop: `1px solid ${theme.palette.divider}`,
                  })}>
                  {headerFields.map((fieldKey: string) => {
                    const fieldSchema = (schema as any)?.properties?.[fieldKey];
                    const label = fieldSchema?.title || fieldKey;
                    const value = data?.[fieldKey];
                    const displayValue =
                      value != null && value !== '' ? String(value) : '—';
                    return (
                      <Typography
                        key={fieldKey}
                        variant="caption"
                        sx={{
                          px: 1,
                          py: 0.25,
                          borderRadius: 1,
                          backgroundColor: 'action.hover',
                          fontSize: '0.75rem',
                          color:
                            displayValue === '—'
                              ? 'text.disabled'
                              : 'text.primary',
                          fontWeight: displayValue === '—' ? 400 : 600,
                          textAlign: 'left',
                        }}>
                        {label}: {displayValue}
                      </Typography>
                    );
                  })}
                </Box>
              )}
              {showInnerTitle && headerTitle && (
                <Typography
                  variant="subtitle2"
                  sx={{
                    fontWeight: 700,
                    fontSize: '1rem',
                    lineHeight: 1.3,
                    color: 'text.primary',
                    px: { xs: 0.5, sm: 1 },
                    pb: 0.25,
                    textAlign: 'left',
                  }}>
                  {headerTitle}
                </Typography>
              )}
            </>
          }
          previousButton={
            prevVisiblePage !== null
              ? {
                  onClick: () => navigateToPage(prevVisiblePage),
                  disabled: isNavigating,
                }
              : undefined
          }
          nextButton={
            skipFinalize && isLastContentPage
              ? {
                  onClick: trySubmitForm,
                  disabled: isNavigating || !formInitData,
                  label: finalizeButtonLabelOption ?? t('nav.done', 'Done'),
                }
              : nextVisiblePage !== null
                ? {
                    onClick: () => navigateToPage(nextVisiblePage),
                    disabled: isNavigating,
                    label: nextButtonLabelOption,
                  }
                : undefined
          }
          contentBottomPadding={24}
          showNavigation={true}>
          <div ref={setSwipeScreenRef} className="swipelayout_screen">
            {(uischema as any)?.label && <h1>{(uischema as any).label}</h1>}
            {layouts.length > 0 && layouts[currentPage] && (
              <JsonFormsDispatch
                schema={schema}
                uischema={layouts[currentPage]}
                path={path}
                enabled={enabled}
                renderers={renderers}
                cells={cells}
              />
            )}
          </div>

          {skipFinalize && isLastContentPage && validationErrorCount > 0 && (
            <Typography
              variant="body2"
              color="error"
              role="alert"
              sx={{ px: { xs: 1, sm: 1.5 }, pt: 1, pb: 0.5 }}>
              {validationAlertMessage}
            </Typography>
          )}

          {snackbarOpen &&
            typeof document !== 'undefined' &&
            createPortal(
              <Box
                sx={{
                  position: 'fixed',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  minHeight: '100%',
                  height: '100%',
                  zIndex: 99,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 4,
                  backgroundColor: 'transparent',
                }}>
                <Box
                  sx={{
                    width: '100%',
                    maxWidth: 340,
                    borderRadius: CONFIRM_CARD_RADIUS,
                    border: `${CONFIRM_BORDER_WIDTH}px solid`,
                    borderColor: 'divider',
                    padding: `${CONFIRM_CARD_PADDING}px`,
                    backgroundColor: theme.palette.background.paper,
                    overflow: 'hidden',
                  }}>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 600, textAlign: 'center', mb: 1.5 }}>
                    {t(
                      'validation.missingRequiredFields',
                      'Missing required fields',
                    )}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ textAlign: 'center', mb: 3 }}>
                    {snackbarMessage ||
                      t(
                        'validation.draftOnReturn',
                        'Some required fields are missing. Any unsaved changes will be available as a draft when you return.',
                      )}
                  </Typography>
                  <Box
                    sx={{
                      flexDirection: 'row',
                      display: 'flex',
                      justifyContent: 'center',
                      gap: 2,
                      flexWrap: 'wrap',
                    }}>
                    <Button
                      variant="neutral"
                      size="medium"
                      onPress={handleSnackbarClose}>
                      {t('validation.stayHere', 'Stay here')}
                    </Button>
                    <Button
                      variant="danger"
                      size="medium"
                      onPress={handleGoBack}>
                      {t('validation.goBack', 'Go back')}
                    </Button>
                  </Box>
                </Box>
              </Box>,
              document.body,
            )}
        </FormLayout>
      </FormContext.Provider>
    </FormDensityContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Wrapper – manages page state and draft persistence
// ---------------------------------------------------------------------------

const SwipeLayoutWrapper = (props: ControlProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const { formInitData, draftSessionKey } = useFormContext();
  const { data } = props;
  const skipDraftPersistence =
    formInitData != null &&
    Boolean(
      (formInitData as { subObservationMode?: boolean; returnOnly?: boolean })
        .subObservationMode ||
      (formInitData as { returnOnly?: boolean }).returnOnly,
    );

  // Save partial data whenever the page changes or data changes
  const handlePageChange = useCallback(
    (page: number) => {
      // Save the current form data before changing the page
      if (data && formInitData && !skipDraftPersistence) {
        console.log('Saving draft data on page change:', data);
        draftService.saveDraft(
          formInitData.formType,
          data,
          formInitData,
          draftSessionKey,
        );
      }
      setCurrentPage(page);
    },
    [data, formInitData, draftSessionKey, skipDraftPersistence],
  );

  useEffect(() => {
    const handleNavigateToPage = (event: CustomEvent) => {
      // Save the current form data before navigating to a specific page
      if (data && formInitData && !skipDraftPersistence) {
        console.log('Saving draft data before navigation event:', data);
        draftService.saveDraft(
          formInitData.formType,
          data,
          formInitData,
          draftSessionKey,
        );
      }
      setCurrentPage(event.detail.page);
    };

    window.addEventListener(
      'navigateToPage',
      handleNavigateToPage as EventListener,
    );

    return () => {
      window.removeEventListener(
        'navigateToPage',
        handleNavigateToPage as EventListener,
      );
    };
  }, [data, formInitData, draftSessionKey, skipDraftPersistence]);

  return (
    <SwipeLayoutRenderer
      {...props}
      currentPage={currentPage}
      onPageChange={handlePageChange}
    />
  );
};

export default withJsonFormsControlProps(SwipeLayoutWrapper);
