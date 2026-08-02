import { describe, it, expect } from 'vitest';
import { createAjv } from '@jsonforms/core';
import type { UISchemaElement } from '@jsonforms/core';
import {
  clearHiddenControlData,
  mergeIncomingFormData,
} from './clearHiddenControlData';
import { mergePreservingSubObsArrays } from '../renderers/subObservationHelpers';

const ajv = createAjv();

/** Minimal cap_ses-style consent page + following group. */
const uischema = {
  type: 'SwipeLayout',
  elements: [
    {
      type: 'Group',
      label: 'Consentimento',
      elements: [
        { type: 'Control', scope: '#/properties/consent' },
        {
          type: 'Control',
          scope: '#/properties/reason_no_consent',
          rule: {
            effect: 'SHOW',
            condition: {
              scope: '#/properties/consent',
              schema: { const: '2' },
            },
          },
        },
      ],
    },
    {
      type: 'Group',
      label: 'Principal respondente',
      rule: {
        effect: 'SHOW',
        condition: {
          scope: '#/properties/consent',
          schema: { const: '1' },
        },
      },
      elements: [
        {
          type: 'Control',
          scope: '#/properties/m1_sexo',
          rule: {
            effect: 'SHOW',
            condition: {
              scope: '#/properties/consent',
              schema: { const: '1' },
            },
          },
        },
      ],
    },
  ],
} as UISchemaElement;

describe('clearHiddenControlData', () => {
  it('omits reason_no_consent when consent flips to Sim (1)', () => {
    const data = {
      consent: '1',
      reason_no_consent: 'Não tenho tempo',
      m1_sexo: '1',
    };
    const next = clearHiddenControlData(data, uischema, ajv);
    expect(next.consent).toBe('1');
    expect(next).not.toHaveProperty('reason_no_consent');
    expect(next.m1_sexo).toBe('1');
  });

  it('omits Sim-path fields when consent is Não (2), including under a hidden Group', () => {
    const data = {
      consent: '2',
      reason_no_consent: 'Não tenho tempo',
      m1_sexo: '2',
    };
    const next = clearHiddenControlData(data, uischema, ajv);
    expect(next.consent).toBe('2');
    expect(next.reason_no_consent).toBe('Não tenho tempo');
    expect(next).not.toHaveProperty('m1_sexo');
  });

  it('strips stale null clears so AJV sees unanswered, not Invalid value', () => {
    const data = {
      consent: '1',
      reason_no_consent: null,
    };
    const next = clearHiddenControlData(data, uischema, ajv);
    expect(next).not.toHaveProperty('reason_no_consent');
  });
});

describe('mergeIncomingFormData', () => {
  it('keeps off-page answers but drops ones made irrelevant by SHOW/HIDE', () => {
    const baseline = {
      consent: '2',
      reason_no_consent: 'Não tenho tempo',
      m1_sexo: '1',
      obsdate: '2026-06-19',
    };
    // Partial SwipeLayout payload after flipping consent to Sim; reason key deleted.
    const incoming = { consent: '1', m1_sexo: '1' };

    const restoredOnly = mergePreservingSubObsArrays(baseline, incoming);
    expect(restoredOnly.reason_no_consent).toBe('Não tenho tempo');

    const next = mergeIncomingFormData(baseline, incoming, { uischema, ajv });
    expect(next.consent).toBe('1');
    expect(next.obsdate).toBe('2026-06-19'); // off-page prefill kept
    expect(next).not.toHaveProperty('reason_no_consent'); // irrelevant omitted
    expect(next.m1_sexo).toBe('1');
  });
});
