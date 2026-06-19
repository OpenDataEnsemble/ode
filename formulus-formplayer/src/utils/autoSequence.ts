/**
 * Platform `x-autoSequence` — assign max+1 sequence integers when blank; optional immutability.
 */

import type { JsonSchema7 } from '@jsonforms/core';
import { resolveTemplateValue } from '../renderers/subObservationHelpers';
import FormulusClient from '../services/FormulusInterface';

export type AutoSequenceConfig = {
  assign?: 'max+1';
  allocator?: 'native' | 'declarative';
  immutable?: boolean;
  scope?: 'sibling' | 'tree' | 'contextTree';
  contextKey?: string;
  contextFilter?: Record<string, string>;
  field?: string;
  /** App-authored suffix; Formulus prepends `device:{deviceId}:`. */
  scopeKey?: string;
};

export type AutoSequenceRuntimeContext = {
  subObservationContext?: Record<string, unknown> | null;
  sessionContext?: Record<string, unknown> | null;
};

type Binding = {
  field: string;
  config: AutoSequenceConfig;
  /** Path to parent object; `*` = each array index */
  parentSegments: string[];
  valueKind: 'string' | 'number';
};

function isBlankSequenceValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  const n = Number(value);
  return !Number.isFinite(n) || n <= 0;
}

function toPosInt(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

function resolveFilterToken(
  token: string,
  data: Record<string, unknown>,
): unknown {
  if (token.startsWith('$data.')) {
    return data[token.slice('$data.'.length)];
  }
  return data[token];
}

function filterValuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  const aNum = toPosInt(a);
  const bNum = toPosInt(b);
  if (aNum != null && bNum != null) return aNum === bNum;
  return String(a ?? '') === String(b ?? '');
}

function nodeMatchesFilter(
  node: Record<string, unknown>,
  filter: Record<string, string> | undefined,
  data: Record<string, unknown>,
): boolean {
  if (!filter) return true;
  for (const [nodeKey, token] of Object.entries(filter)) {
    if (!filterValuesEqual(node[nodeKey], resolveFilterToken(token, data))) {
      return false;
    }
  }
  return true;
}

function collectFieldValues(
  node: unknown,
  fieldName: string,
  filter: Record<string, string> | undefined,
  data: Record<string, unknown>,
  out: number[],
): void {
  if (node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) {
      collectFieldValues(item, fieldName, filter, data, out);
    }
    return;
  }
  if (typeof node !== 'object') return;

  const obj = node as Record<string, unknown>;
  if (!nodeMatchesFilter(obj, filter, data)) return;

  if (Object.prototype.hasOwnProperty.call(obj, fieldName)) {
    const n = toPosInt(obj[fieldName]);
    if (n != null) out.push(n);
  }

  for (const value of Object.values(obj)) {
    if (value && typeof value === 'object') {
      collectFieldValues(value, fieldName, undefined, data, out);
    }
  }
}

function maxFromValues(values: number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

function computeNextValue(
  binding: Binding,
  data: Record<string, unknown>,
  runtime: AutoSequenceRuntimeContext,
): number {
  const fieldName = binding.config.field ?? binding.field;
  const values: number[] = [];
  const scope = binding.config.scope ?? 'sibling';

  if (scope === 'sibling') {
    const parent = resolveParentObject(data, binding.parentSegments);
    if (Array.isArray(parent)) {
      for (const item of parent) {
        if (item && typeof item === 'object') {
          const n = toPosInt((item as Record<string, unknown>)[fieldName]);
          if (n != null) values.push(n);
        }
      }
    }
  } else if (scope === 'contextTree') {
    const contextKey = binding.config.contextKey ?? 'quartos';
    const subCtx =
      runtime.subObservationContext ??
      (runtime.sessionContext?.subObservation as Record<
        string,
        unknown
      > | null);
    collectFieldValues(
      subCtx?.[contextKey],
      fieldName,
      binding.config.contextFilter,
      data,
      values,
    );
    collectFieldValues(
      data,
      fieldName,
      binding.config.contextFilter,
      data,
      values,
    );
  } else {
    collectFieldValues(
      data,
      fieldName,
      binding.config.contextFilter,
      data,
      values,
    );
  }

  return maxFromValues(values) + 1;
}

function collectBindings(
  schema: JsonSchema7 | undefined,
  parentSegments: string[] = [],
): Binding[] {
  if (!schema || typeof schema !== 'object') return [];

  const bindings: Binding[] = [];
  const props = schema.properties;
  if (props) {
    for (const [name, childSchema] of Object.entries(props)) {
      const child = childSchema as JsonSchema7;
      const seq = (child as Record<string, unknown>)['x-autoSequence'] as
        | AutoSequenceConfig
        | undefined;
      if (seq && typeof seq === 'object') {
        bindings.push({
          field: name,
          parentSegments,
          valueKind: child.type === 'string' ? 'string' : 'number',
          config: {
            assign: 'max+1',
            immutable: true,
            scope: 'sibling',
            ...seq,
            field: seq.field ?? name,
          },
        });
      }
      bindings.push(...collectBindings(child, [...parentSegments, name]));
    }
  }

  if (schema.items && typeof schema.items === 'object') {
    bindings.push(
      ...collectBindings(schema.items as JsonSchema7, [...parentSegments, '*']),
    );
  }

  return bindings;
}

function resolveParentObject(
  data: Record<string, unknown>,
  segments: string[],
): unknown {
  let cur: unknown = data;
  for (const segment of segments) {
    if (segment === '*') return cur;
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[segment];
  }
  return cur;
}

type ParentRef = { parent: Record<string, unknown> };

function enumerateParents(
  data: Record<string, unknown>,
  segments: string[],
): ParentRef[] {
  if (segments.length === 0) return [{ parent: data }];

  const [head, ...tail] = segments;
  if (head === '*') {
    if (!Array.isArray(data)) return [];
    const out: ParentRef[] = [];
    for (const item of data) {
      if (item && typeof item === 'object') {
        out.push(...enumerateParents(item as Record<string, unknown>, tail));
      }
    }
    return out;
  }

  const next = data[head];
  if (next == null || typeof next !== 'object') return [];
  if (tail.length === 0) {
    return [{ parent: next as Record<string, unknown> }];
  }
  return enumerateParents(next as Record<string, unknown>, tail);
}

function usesNativeAllocator(config: AutoSequenceConfig): boolean {
  return config.allocator === 'native' && Boolean(config.scopeKey?.trim());
}

function resolveScopeKeyTemplate(
  template: string,
  data: Record<string, unknown>,
): string {
  const resolved = resolveTemplateValue(template, data, null);
  return typeof resolved === 'string' ? resolved.trim() : String(resolved ?? '').trim();
}

async function computeNextValueAsync(
  binding: Binding,
  data: Record<string, unknown>,
  runtime: AutoSequenceRuntimeContext,
): Promise<number | string> {
  if (usesNativeAllocator(binding.config)) {
    const scopeKey = resolveScopeKeyTemplate(
      binding.config.scopeKey!.trim(),
      data,
    );
    if (!scopeKey) {
      throw new Error(
        `x-autoSequence scopeKey resolved empty for field "${binding.field}"`,
      );
    }
    const client = FormulusClient.getInstance();
    return client.allocateSequence(scopeKey);
  }
  const next = computeNextValue(binding, data, runtime);
  return binding.valueKind === 'string' ? String(next) : next;
}

/** Apply all `x-autoSequence` rules in `schema` when fields are blank. */
export async function applyAutoSequences(
  data: Record<string, unknown>,
  schema: JsonSchema7 | undefined,
  runtime: AutoSequenceRuntimeContext = {},
): Promise<{ data: Record<string, unknown>; mutated: boolean }> {
  if (!schema) return { data, mutated: false };

  const bindings = collectBindings(schema, []);
  if (bindings.length === 0) return { data, mutated: false };

  const working = structuredClone(data);
  let mutated = false;

  for (const binding of bindings) {
    const immutable = binding.config.immutable !== false;
    const fieldName = binding.field;
    const parentRefs = enumerateParents(working, binding.parentSegments);

    for (const { parent } of parentRefs) {
      const current = parent[fieldName];
      if (immutable && !isBlankSequenceValue(current)) continue;
      if (!isBlankSequenceValue(current)) continue;

      parent[fieldName] = await computeNextValueAsync(binding, working, runtime);
      mutated = true;
    }
  }

  return { data: mutated ? working : data, mutated };
}
