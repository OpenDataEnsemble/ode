import React from 'react';
import { RankedTester, rankWith, uiTypeIs, UISchemaElement } from '@jsonforms/core';
import { withJsonFormsLabelProps } from '@jsonforms/react';
import { Typography, Box } from '@mui/material';

/**
 * Simple HTML sanitizer that removes dangerous tags and attributes.
 */
const sanitizeHtml = (html: string): string => {
  // Remove script tags and their content
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
  // Remove event handlers (onclick, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript:/gi, '');
  // Remove data: URLs in href/src (potential XSS vector)
  sanitized = sanitized.replace(/\s*href\s*=\s*["']?\s*data:/gi, ' href="');
  sanitized = sanitized.replace(/\s*src\s*=\s*["']?\s*data:/gi, ' src="');

  return sanitized;
};

/**
 * Check if content contains HTML tags
 */
const hasHtmlTags = (content: string): boolean => {
  const htmlTagPattern = /<[a-z][a-z0-9]*(\s+[^>]*)?>/i;
  return htmlTagPattern.test(content);
};

interface HtmlLabelProps {
  text?: string;
  visible?: boolean;
  uischema?: UISchemaElement;
}

/**
 * Custom Label renderer that supports HTML content.
 * Detects HTML tags in the label text and renders them safely.
 */
const HtmlLabelRenderer: React.FC<HtmlLabelProps> = ({ text, visible, uischema }) => {
  if (visible === false) {
    return null;
  }

  // Check if HTML rendering is enabled via options or if content has HTML tags
  const options = (uischema as any)?.options || {};
  const htmlEnabled = options.html === true || options.format === 'html';
  const contentHasHtml = hasHtmlTags(text || '');
  const shouldRenderHtml = htmlEnabled || contentHasHtml;

  if (shouldRenderHtml && text) {
    const sanitized = sanitizeHtml(text);
    return (
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="body1"
          component="div"
          sx={{
            '& ul, & ol': {
              pl: 3,
              my: 1,
            },
            '& li': {
              mb: 0.5,
            },
            '& b, & strong': {
              fontWeight: 700,
            },
            '& i, & em': {
              fontStyle: 'italic',
            },
            '& br': {
              display: 'block',
              content: '""',
              mt: 1,
            },
          }}
          dangerouslySetInnerHTML={{ __html: sanitized }}
        />
      </Box>
    );
  }

  // Plain text rendering
  return (
    <Box sx={{ mb: 2 }}>
      <Typography variant="body1">{text}</Typography>
    </Box>
  );
};

// Tester with high priority to override default label renderer
export const htmlLabelTester: RankedTester = rankWith(10, uiTypeIs('Label'));

// Use type assertion to satisfy withJsonFormsLabelProps
export default withJsonFormsLabelProps(HtmlLabelRenderer as React.ComponentType<any>);
