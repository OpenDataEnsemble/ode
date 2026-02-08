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
import { Snackbar, Button } from '@mui/material';
import { useFormContext } from '../App';
import { draftService } from '../services/DraftService';
import FormProgressBar from '../components/FormProgressBar';
import FormLayout from '../components/FormLayout';

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

    const pageControls = getPageControls(currentPageElement);

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
          }: ${missingFields.slice(0, 2).join(', ')}${
            missingFields.length > 2 ? '...' : ''
          }`;

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
    onSwipedLeft: () =>
      navigateToPage(Math.min(currentPage + 1, layouts.length - 1)),
    onSwipedRight: () => navigateToPage(Math.max(currentPage - 1, 0)),
  });

  // Calculate total screens including Finalize (so progress reaches 100% only on Finalize)
  const totalScreens = useMemo(() => {
    // Include all screens including Finalize so progress reaches 100% only when on Finalize page
    return layouts.length;
  }, [layouts]);

  // Check if we're on the Finalize page
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
    if (pendingNavigation !== null && currentPage > 0) {
      performNavigation(currentPage - 1);
    }
    setPendingNavigation(null);
    setSnackbarMessage('');
  }, [pendingNavigation, currentPage, performNavigation]);

  return (
    <FormLayout
      header={
        <FormProgressBar
          currentPage={currentPage}
          totalScreens={totalScreens}
          data={data}
          schema={schema}
          uischema={uischema}
          mode="screens"
          isOnFinalizePage={isOnFinalizePage}
        />
      }
      previousButton={
        currentPage > 0
          ? {
              onClick: () => navigateToPage(Math.max(currentPage - 1, 0)),
              disabled: isNavigating,
            }
          : undefined
      }
      nextButton={
        currentPage < layouts.length - 1
          ? {
              onClick: () =>
                navigateToPage(Math.min(currentPage + 1, layouts.length - 1)),
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
          <Button
            size="small"
            onClick={handleGoBack}
            sx={{
              color: 'primary.light',
              minWidth: 'auto',
              textTransform: 'none',
              fontWeight: 500,
              padding: '4px 8px',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
              },
            }}>
            Go Back
          </Button>
        }
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{
          '& .MuiSnackbarContent-root': {
            backgroundColor: 'rgba(0, 0, 0, 0.87)',
            color: '#fff',
            boxShadow:
              '0px 3px 5px -1px rgba(0,0,0,0.2), 0px 6px 10px 0px rgba(0,0,0,0.14), 0px 1px 18px 0px rgba(0,0,0,0.12)',
          },
        }}
      />
    </FormLayout>
  );
};

// Create a wrapper component that manages the page state
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
