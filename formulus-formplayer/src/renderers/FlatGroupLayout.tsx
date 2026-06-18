import React from 'react';
import { withJsonFormsLayoutProps } from '@jsonforms/react';
import {
  LayoutProps,
  RankedTester,
  rankWith,
  uiTypeIs,
  UISchemaElement,
} from '@jsonforms/core';
import { MaterialLayoutRenderer } from '@jsonforms/material-renderers';
import { Box, Card, CardContent, CardHeader, Typography } from '@mui/material';
import { useFormDensity } from '../context/FormDensityContext';

const isEmpty = (value: string | undefined): boolean =>
  value === undefined || value === null || value.trim() === '';

/** @internal for tests — card shell without JSON Forms wrapper */
export function CardGroupShell({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <Card sx={{ mb: 1.25 }}>
      {!isEmpty(label) && (
        <CardHeader
          title={label}
          sx={{ pb: 0.5, '& .MuiCardHeader-title': { fontSize: '1rem' } }}
        />
      )}
      <CardContent sx={{ pt: 0, '&:last-child': { pb: 2 } }}>
        {children}
      </CardContent>
    </Card>
  );
}

export const flatGroupLayoutTester: RankedTester = rankWith(2, uiTypeIs('Group'));

const FlatGroupLayoutRenderer = ({
  uischema,
  schema,
  path,
  visible,
  enabled,
  renderers,
  cells,
  direction,
  label,
}: LayoutProps) => {
  const { groupVariant } = useFormDensity();
  const groupLayout = uischema as {
    elements: UISchemaElement[];
    options?: { variant?: string };
  };
  const useCard =
    groupVariant === 'card' || groupLayout.options?.variant === 'card';

  if (!visible) {
    return null;
  }

  const childProps = {
    elements: groupLayout.elements,
    schema,
    path,
    enabled,
    direction,
    visible,
    renderers,
    cells,
  };

  const layout = (
    <MaterialLayoutRenderer
      {...childProps}
      visible={visible}
      enabled={enabled}
      elements={groupLayout.elements}
    />
  );

  if (useCard) {
    return <CardGroupShell label={label}>{layout}</CardGroupShell>;
  }

  return (
    <Box sx={{ width: '100%', mb: 1 }}>
      {!isEmpty(label) && (
        <Typography
          variant="subtitle2"
          component="h2"
          sx={{
            fontWeight: 700,
            fontSize: '1rem',
            lineHeight: 1.3,
            pt: 0,
            pb: 0.5,
            px: 0,
            textAlign: 'left',
          }}>
          {label}
        </Typography>
      )}
      {layout}
    </Box>
  );
};

export const FlatGroupLayout = withJsonFormsLayoutProps(FlatGroupLayoutRenderer);
