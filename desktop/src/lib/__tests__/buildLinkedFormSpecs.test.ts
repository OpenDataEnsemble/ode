import { describe, expect, it, vi } from 'vitest';
import { collectLinkedFormIds } from '../collectLinkedFormIds';
import { buildLinkedFormSpecs } from '../buildLinkedFormSpecs';

describe('collectLinkedFormIds', () => {
  it('collects linkedForm from nested properties', () => {
    const ids = collectLinkedFormIds({
      properties: {
        quartos: {
          type: 'array',
          linkedForm: 'censo_milda_quarto',
        },
      },
    });
    expect([...ids]).toEqual(['censo_milda_quarto']);
  });
});

describe('buildLinkedFormSpecs', () => {
  it('loads linked forms and follows nested chains', async () => {
    const loadSpec = vi.fn(async (formType: string) => {
      if (formType === 'parent') {
        return {
          formSchema: {
            properties: {
              items: { linkedForm: 'child' },
            },
          },
          uiSchema: { type: 'VerticalLayout' },
        };
      }
      if (formType === 'child') {
        return {
          formSchema: {
            properties: { name: { type: 'string', title: 'Name' } },
          },
          uiSchema: {
            type: 'Control',
            scope: '#/properties/name',
            label: 'Child label',
          },
        };
      }
      throw new Error('missing');
    });

    const specs = await buildLinkedFormSpecs(
      { properties: { items: { linkedForm: 'parent' } } },
      loadSpec,
    );

    expect(loadSpec).toHaveBeenCalledWith('parent');
    expect(loadSpec).toHaveBeenCalledWith('child');
    expect(specs?.parent?.schema).toBeTruthy();
    expect(specs?.child?.uiSchema).toEqual({
      type: 'Control',
      scope: '#/properties/name',
      label: 'Child label',
    });
  });

  it('returns undefined when no linked forms', async () => {
    const loadSpec = vi.fn();
    const specs = await buildLinkedFormSpecs(
      { type: 'object', properties: { a: { type: 'string' } } },
      loadSpec,
    );
    expect(specs).toBeUndefined();
    expect(loadSpec).not.toHaveBeenCalled();
  });
});
