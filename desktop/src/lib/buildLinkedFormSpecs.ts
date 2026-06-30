import { collectLinkedFormIds } from './collectLinkedFormIds';
import type { FormInitData } from './formplayerHost';

export type LoadLinkedFormSpec = (formType: string) => Promise<{
  formSchema: unknown;
  uiSchema?: unknown;
}>;

/**
 * Load schema/ui for all forms referenced by `linkedForm` (including nested chains).
 * Matches Formulus FormplayerModal behaviour for sub-observation column labels.
 */
export async function buildLinkedFormSpecs(
  rootSchema: unknown,
  loadSpec: LoadLinkedFormSpec,
): Promise<FormInitData['linkedFormSpecs']> {
  const pending = [...collectLinkedFormIds(rootSchema)];
  const loaded = new Set<string>();
  const specs: NonNullable<FormInitData['linkedFormSpecs']> = {};

  while (pending.length > 0) {
    const id = pending.pop()!;
    if (loaded.has(id)) continue;
    loaded.add(id);

    try {
      const spec = await loadSpec(id);
      if (!spec.formSchema) continue;
      specs[id] = {
        schema: spec.formSchema,
        uiSchema: spec.uiSchema ?? {},
      };
      for (const nested of collectLinkedFormIds(spec.formSchema)) {
        if (!loaded.has(nested) && !pending.includes(nested)) {
          pending.push(nested);
        }
      }
    } catch (error) {
      console.warn(
        `[buildLinkedFormSpecs] Failed to load linked form "${id}":`,
        error,
      );
    }
  }

  return Object.keys(specs).length > 0 ? specs : undefined;
}
