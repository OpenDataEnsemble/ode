import React, { useCallback, useState, useEffect, useMemo } from "react";
import { JsonFormsDispatch, withJsonFormsControlProps } from "@jsonforms/react";
import { ControlProps, rankWith, uiTypeIs, RankedTester } from "@jsonforms/core";
import { useSwipeable } from "react-swipeable";
import { useFormContext } from "./App";
import { draftService } from './DraftService';
import FormProgressBar from './FormProgressBar';
import FormLayout from './FormLayout';

interface SwipeLayoutProps extends ControlProps {
  currentPage: number;
  onPageChange: (page: number) => void;
}

// Tester for SwipeLayout elements (explicitly defined)
export const swipeLayoutTester: RankedTester = rankWith(
  3, // Higher rank for explicit SwipeLayout
  uiTypeIs('SwipeLayout')
);

// Custom tester for Group elements that should be rendered as SwipeLayout
const isGroupElement = (uischema: any): boolean => {
  return uischema && uischema.type === 'Group';
};

// Tester for Group elements that should be rendered as SwipeLayout
export const groupAsSwipeLayoutTester: RankedTester = rankWith(
  2, // Lower rank than explicit SwipeLayout
  isGroupElement
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
  onPageChange
}: SwipeLayoutProps) => {
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Handle both SwipeLayout and Group elements
  // Use type assertion to avoid TypeScript errors
  const uiType = (uischema as any).type;
  const isExplicitSwipeLayout = uiType === 'SwipeLayout';
  
  // For SwipeLayout, use elements directly; for Group, wrap the group in an array
  const layouts = useMemo(() => {
    return isExplicitSwipeLayout
      ? (uischema as any).elements || []
      : [uischema]; // For Group, treat the entire group as a single page
  }, [uischema, isExplicitSwipeLayout]);

  if (typeof handleChange !== "function") {
    console.warn("Property 'handleChange'<function>  was not supplied to SwipeLayoutRenderer");
    handleChange = () => {}
  }

  const navigateToPage = useCallback((newPage: number) => {
    if (isNavigating) return;
    
    setIsNavigating(true);
    onPageChange(newPage);
    
    // Add a small delay before allowing next navigation
    setTimeout(() => {
      setIsNavigating(false);
    }, 100);
  }, [isNavigating, onPageChange]);

  const handlers = useSwipeable({
    onSwipedLeft: () => navigateToPage(Math.min(currentPage + 1, layouts.length - 1)),
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
              onClick: () => navigateToPage(Math.min(currentPage + 1, layouts.length - 1)),
              disabled: isNavigating,
            }
          : undefined
      }
      contentBottomPadding={120}
      showNavigation={true}
    >
      <div {...handlers} className="swipelayout_screen">
        {(uischema as any)?.label && <h1>{(uischema as any).label}</h1>}
        {layouts.length > 0 && (
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
    </FormLayout>
  );
};

// Create a wrapper component that manages the page state
const SwipeLayoutWrapper = (props: ControlProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const { formInitData } = useFormContext();
  const { data } = props;

  // Save partial data whenever the page changes or data changes
  const handlePageChange = useCallback((page: number) => {
    // Save the current form data before changing the page
    if (data && formInitData) {
      console.log('Saving draft data on page change:', data);
      draftService.saveDraft(formInitData.formType, data, formInitData);
    }
    setCurrentPage(page);
  }, [data, formInitData]);

  useEffect(() => {
    const handleNavigateToPage = (event: CustomEvent) => {
      // Save the current form data before navigating to a specific page
      if (data && formInitData) {
        console.log('Saving draft data before navigation event:', data);
        draftService.saveDraft(formInitData.formType, data, formInitData);
      }
      setCurrentPage(event.detail.page);
    };

    window.addEventListener('navigateToPage', handleNavigateToPage as EventListener);
    
    return () => {
      window.removeEventListener('navigateToPage', handleNavigateToPage as EventListener);
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
