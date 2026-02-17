/**
 * CustomQuestionTypeRegistry.ts
 *
 * Converts a map of { formatName → React component } into JSON Forms
 * RendererRegistryEntries. Each entry gets an auto-generated tester that
 * matches on the schema's `format` field.
 *
 * Usage:
 *   const renderers = registerCustomQuestionTypes(componentsMap);
 *   // renderers can then be spread into the JsonForms renderers array
 */

import type { JsonFormsRendererRegistryEntry, RankedTester } from '@jsonforms/core';
import { rankWith, schemaMatches } from '@jsonforms/core';
import type { CustomQuestionTypeProps } from '../types/CustomQuestionTypeContract';
import { createCustomQuestionTypeRenderer } from '../renderers/CustomQuestionTypeAdapter';
import type React from 'react';

/**
 * Creates a ranked tester for a custom question type based on its schema format.
 *
 * Uses priority 6 which is higher than default Material renderers (priority 3-5)
 * but lower than specialized built-in question types (priority 10+).
 */
function createFormatTester(formatName: string): RankedTester {
  return rankWith(
    6,
    schemaMatches((schema) => {
      return (schema as Record<string, unknown>)?.format === formatName;
    }),
  );
}

/**
 * Registers custom question types by creating JSON Forms renderer entries.
 *
 * @param components - Map of format name → React component
 * @returns Array of JsonFormsRendererRegistryEntry ready to be used with <JsonForms>
 */
export function registerCustomQuestionTypes(
  components: Map<string, React.ComponentType<CustomQuestionTypeProps>>,
): JsonFormsRendererRegistryEntry[] {
  const entries: JsonFormsRendererRegistryEntry[] = [];

  for (const [formatName, component] of components) {
    const tester = createFormatTester(formatName);
    const renderer = createCustomQuestionTypeRenderer(formatName, component);

    entries.push({ tester, renderer });

    console.log(
      `[CustomQuestionTypeRegistry] Registered renderer for format "${formatName}"`,
    );
  }

  return entries;
}
