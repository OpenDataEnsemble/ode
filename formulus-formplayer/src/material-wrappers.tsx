import React from 'react';
import { isEnumControl, RankedTester, rankWith, ControlProps } from '@jsonforms/core';
import { withJsonFormsControlProps } from '@jsonforms/react';
import { Card, CardActionArea, CardContent, Typography, Box } from '@mui/material';
import QuestionShell from './QuestionShell';

type AnyControlProps = ControlProps & { errors?: string };

const cardEnumControlTester: RankedTester = rankWith(6, isEnumControl);

const CardEnumControl = (props: AnyControlProps) => {
  const { data, handleChange, path, schema, uischema, errors, enabled = true } = props;
  const label = (uischema as any)?.label || schema.title;
  const description = schema.description;
  const required = Boolean(
    (uischema as any)?.options?.required ?? (schema as any)?.options?.required,
  );

  const options =
    schema.oneOf?.map((o: any) => ({
      value: o.const ?? o.enum?.[0] ?? o,
      label: o.title ?? String(o.const ?? o),
    })) || (schema.enum || []).map((v: any) => ({ value: v, label: String(v) }));

  return (
    <QuestionShell title={label} description={description} required={required} error={errors}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {options.map((opt) => {
          const selected = data === opt.value;
          return (
            <Card
              key={String(opt.value)}
              variant={selected ? 'elevation' : 'outlined'}
              sx={{
                borderColor: selected ? 'primary.main' : 'divider',
                boxShadow: selected ? 3 : 0,
              }}
            >
              <CardActionArea
                disabled={!enabled}
                onClick={() => handleChange(path, opt.value)}
                sx={{ p: 1.5 }}
              >
                <CardContent sx={{ py: 0.5, '&:last-child': { pb: 0.5 } }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: selected ? 700 : 500 }}>
                    {opt.label}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
    </QuestionShell>
  );
};

// NOTE: We removed the shell wrappers for text/number/integer/date controls because
// they interfere with JSONForms' internal cell rendering mechanism.
// The default materialRenderers handle these controls properly.
// Only export custom renderers that don't break cell rendering.
export const shellMaterialRenderers = [
  // Card-style enum control - a custom renderer that uses QuestionShell
  { tester: cardEnumControlTester, renderer: withJsonFormsControlProps(CardEnumControl) },
];
