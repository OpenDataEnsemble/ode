import React, { useCallback, useState, useEffect, useRef } from "react";
import { JsonFormsDispatch, withJsonFormsControlProps } from "@jsonforms/react";
import { ControlProps, rankWith, uiTypeIs, isGroup, RankedTester } from "@jsonforms/core";
import { useSwipeable } from "react-swipeable";
import { Button, Box } from "@mui/material";
import FormulusClient from "./FormulusInterface";

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
  const layouts = isExplicitSwipeLayout
    ? (uischema as any).elements || []
    : [uischema]; // For Group, treat the entire group as a single page

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

  return (
    <Box sx={{ position: 'relative', height: '100%' }}>
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
      <Box sx={{ 
        position: "absolute", 
        bottom: 20, 
        width: "100%", 
        textAlign: "center",
        display: 'flex',
        justifyContent: 'center',
        gap: 2
      }}>
        <Button 
          variant="contained"
          onClick={() => navigateToPage(Math.max(currentPage - 1, 0))} 
          disabled={currentPage === 0 || isNavigating}
        >
          Previous
        </Button>
        <Button 
          variant="contained"
          onClick={() => navigateToPage(Math.min(currentPage + 1, layouts.length - 1))} 
          disabled={currentPage === layouts.length - 1 || isNavigating}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};

// Create a wrapper component that manages the page state
const SwipeLayoutWrapper = (props: ControlProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const formulusClient = useRef<FormulusClient>(FormulusClient.getInstance());
  const { data } = props;

  // Save partial data whenever the page changes or data changes
  const handlePageChange = useCallback((page: number) => {
    // Save the current form data before changing the page
    if (data) {
      console.log('Saving partial form data on page change:', data);
      formulusClient.current.savePartial(data);
    }
    setCurrentPage(page);
  }, [data]);

  useEffect(() => {
    const handleNavigateToPage = (event: CustomEvent) => {
      // Save the current form data before navigating to a specific page
      if (data) {
        console.log('Saving partial form data before navigation event:', data);
        formulusClient.current.savePartial(data);
      }
      setCurrentPage(event.detail.page);
    };

    window.addEventListener('navigateToPage', handleNavigateToPage as EventListener);
    
    return () => {
      window.removeEventListener('navigateToPage', handleNavigateToPage as EventListener);
    };
  }, [data]);
  
  // Also save data when it changes (even without page change)
  useEffect(() => {
    if (data) {
      // Debounce the save to avoid too many calls
      const debounceTimer = setTimeout(() => {
        console.log('Saving partial form data on data change:', data);
        formulusClient.current.savePartial(data);
      }, 1000); // 1 second debounce
      
      return () => clearTimeout(debounceTimer);
    }
  }, [data]);

  return (
    <SwipeLayoutRenderer
      {...props}
      currentPage={currentPage}
      onPageChange={handlePageChange}
    />
  );
};

export default withJsonFormsControlProps(SwipeLayoutWrapper);
