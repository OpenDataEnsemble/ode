import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  JsonFormsDispatch,
  withJsonFormsControlProps,
  useJsonForms,
} from '@jsonforms/react';
import {
  ControlProps,
  rankWith,
  uiTypeIs,
  RankedTester,
} from '@jsonforms/core';
import { useSwipeable } from 'react-swipeable';
import { Snackbar } from '@mui/material';
import { Button } from '@ode/components/react-web';
import { tokens } from '../theme/tokens-adapter';
import { useFormContext } from '../App';
import { draftService } from '../services/DraftService';
import FormProgressBar from '../components/FormProgressBar';
import FormLayout from '../components/FormLayout';

// ---------------------------------------------------------------------------
// Page visibility helpers
// ---------------------------------------------------------------------------

/** Resolve a data value from a JSON Pointer scope (e.g. "#/properties/sexo"). */
const resolveDataValue = (scope: string, data: any): any => {
  if (!scope || !data) return undefined;
  const parts = scope.replace(/^#\/properties\//, '').split('/');
  let value = data;
  for (const part of parts) {
    if (value != null && typeof value === 'object') {
      value = value[part];
    } else {
      return undefined;
    }
  }
  return value;
};

/** Evaluate a JSON Schema condition object against a concrete value. */
const evaluateConditionSchema = (schema: any, value: any): boolean => {
  if (!schema) return true;

  if ('const' in schema) return value === schema.const;
  if ('enum' in schema)
    return Array.isArray(schema.enum) && schema.enum.includes(value);
  if ('not' in schema) return !evaluateConditionSchema(schema.not, value);
  if ('pattern' in schema && typeof value === 'string')
    return new RegExp(schema.pattern).test(value);
  if ('minimum' in schema && typeof value === 'number')
    return value >= schema.minimum;
  if ('maximum' in schema && typeof value === 'number')
    return value <= schema.maximum;

  return true;
};

/** Check whether a single UI‑schema element is visible given current data. */
const isElementVisible = (element: any, data: any): boolean => {
  if (!element?.rule) return true;

  const { effect, condition } = element.rule;
  if (!condition?.scope || !condition?.schema) return true;

  const value = resolveDataValue(condition.scope, data);
  const conditionMet = evaluateConditionSchema(condition.schema, value);

  if (effect === 'SHOW') return conditionMet;
  if (effect === 'HIDE') return !conditionMet;
  // ENABLE / DISABLE do not affect visibility
  return true;
};

/**
 * Determine whether a page (typically a VerticalLayout) has any visible
 * content.  A page is hidden only when **every** child element is hidden by a
 * rule.  Finalize pages and pages without children are always visible.
 */
const isPageVisible = (page: any, data: any): boolean => {
  if (!page) return false;
  if (page.type === 'Finalize') return true;

  // The page itself may carry a rule
  if (page.rule && !isElementVisible(page, data)) return false;

  // Pages without child elements (e.g. a bare Control) are always visible
  if (!page.elements || page.elements.length === 0) return true;

  // Visible if at least one child is visible
  return page.elements.some((el: any) => isElementVisible(el, data));
};

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

const SwipeLayoutRenderer = ({
  schema,
  uischema,
  data,
  handleChange,
  path,
  renderers,
  cells,
  enabled,
  currentPage,
  onPageChange,
}: SwipeLayoutProps) => {
  const [isNavigating, setIsNavigating] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<number | null>(
    null,
  );
  const [snackbarMessage, setSnackbarMessage] = useState<string>('');
  const { core } = useJsonForms();

  const uiType = (uischema as any).type;
  const isExplicitSwipeLayout = uiType === 'SwipeLayout';

  const layouts = useMemo(() => {
    return isExplicitSwipeLayout
      ? (uischema as any).elements || []
      : [uischema];
  }, [uischema, isExplicitSwipeLayout]);

  if (typeof handleChange !== 'function') {
    console.warn(
      "Property 'handleChange'<function>  was not supplied to SwipeLayoutRenderer",
    );
    handleChange = () => {};
  }

  // ----- Visibility-aware navigation helpers -----

  /** Indices of pages that are currently visible given the form data. */
  const visiblePageIndices = useMemo(() => {
    return layouts
      .map((_: any, idx: number) => idx)
      .filter((idx: number) => isPageVisible(layouts[idx], data));
  }, [layouts, data]);

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
    if (isPageVisible(layouts[currentPage], data)) return;

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
  }, [currentPage, data, layouts, visiblePageIndices, onPageChange]);

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

    const getPageControls = (element: any): any[] => {
      const controls: any[] = [];
      if (element.type === 'Control' && element.scope) {
        controls.push(element);
      }
      if (element.elements && Array.isArray(element.elements)) {
        element.elements.forEach((el: any) => {
          controls.push(...getPageControls(el));
        });
      }
      return controls;
    };

    // Only validate controls that are actually visible
    const pageControls = getPageControls(currentPageElement).filter(control =>
      isElementVisible(control, data),
    );

    pageControls.forEach(control => {
      if (!control.scope) return;

      const fieldPath = control.scope;
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
  }, [core, data, layouts, currentPage]);

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

      if (isNavigatingForward && !isOnFinalize) {
        const missingFields = getMissingRequiredFieldsOnPage();

        if (missingFields.length > 0) {
          const message = `Missing required ${
            missingFields.length === 1 ? 'field' : 'fields'
          }: ${missingFields.slice(0, 2).join(', ')}${missingFields.length > 2 ? '...' : ''}`;

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

  const isOnFinalizePage = useMemo(() => {
    return layouts[currentPage]?.type === 'Finalize';
  }, [layouts, currentPage]);

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

  // ----- Render -----

  return (
    <FormLayout
      header={
        <FormProgressBar
          currentPage={visiblePosition}
          totalScreens={totalVisibleScreens}
          data={data}
          schema={schema}
          uischema={uischema}
          mode="screens"
          isOnFinalizePage={isOnFinalizePage}
        />
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
        nextVisiblePage !== null
          ? {
              onClick: () => navigateToPage(nextVisiblePage),
              disabled: isNavigating,
            }
          : undefined
      }
      contentBottomPadding={80}
      showNavigation={true}>
      <div {...handlers} className="swipelayout_screen">
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

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage || 'Some required fields are missing'}
        action={
          <Button variant="secondary" size="small" onPress={handleGoBack}>
            Go Back
          </Button>
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: `rgba(0, 0, 0, ${(tokens as any).opacity?.['90'] ?? 0.9})`,
            color: tokens.color.neutral.white,
            boxShadow: (tokens as any).shadow?.portal?.md ?? tokens.shadow?.md,
          },
        }}
      />
    </FormLayout>
  );
};

// ---------------------------------------------------------------------------
// Wrapper – manages page state and draft persistence
// ---------------------------------------------------------------------------

const SwipeLayoutWrapper = (props: ControlProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const { formInitData } = useFormContext();
  const { data } = props;

  // Save partial data whenever the page changes or data changes
  const handlePageChange = useCallback(
    (page: number) => {
      // Save the current form data before changing the page
      if (data && formInitData) {
        console.log('Saving draft data on page change:', data);
        draftService.saveDraft(formInitData.formType, data, formInitData);
      }
      setCurrentPage(page);
    },
    [data, formInitData],
  );

  useEffect(() => {
    const handleNavigateToPage = (event: CustomEvent) => {
      // Save the current form data before navigating to a specific page
      if (data && formInitData) {
        console.log('Saving draft data before navigation event:', data);
        draftService.saveDraft(formInitData.formType, data, formInitData);
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
  }, [data, formInitData]);

  // Also save data when it changes (even without page change)
  useEffect(() => {
    if (data) {
      // Debounce the save to avoid too many calls
      const debounceTimer = setTimeout(() => {
        if (formInitData) {
          console.log('Saving draft data on data change:', data);
          draftService.saveDraft(formInitData.formType, data, formInitData);
        }
      }, 1000); // 1 second debounce

      return () => clearTimeout(debounceTimer);
    }
  }, [data, formInitData]);

  return (
    <SwipeLayoutRenderer
      {...props}
      currentPage={currentPage}
      onPageChange={handlePageChange}
    />
  );
};

export default withJsonFormsControlProps(SwipeLayoutWrapper);
