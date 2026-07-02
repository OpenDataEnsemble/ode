import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';
import LikertScaleQuestionRenderer, {
  likertScaleQuestionTester,
} from '../renderers/LikertScaleQuestionRenderer';
import { materialRenderers } from '@jsonforms/material-renderers';

const satisfactionOneOf = [
  { const: 1, title: 'Very dissatisfied' },
  { const: 2, title: 'Dissatisfied' },
  { const: 3, title: 'Neutral' },
  { const: 4, title: 'Satisfied' },
  { const: 5, title: 'Very satisfied' },
];

const npsOneOf = Array.from({ length: 11 }, (_, i) => ({
  const: i,
  title:
    i === 0 ? 'Not at all likely' : i === 10 ? 'Extremely likely' : String(i),
}));

const renderers = [
  { tester: likertScaleQuestionTester, renderer: LikertScaleQuestionRenderer },
  ...materialRenderers,
];

/** Simulates a phone-width container to check wrapping and label fit. */
const mobileDecorator = (Story: React.ComponentType) => (
  <div style={{ width: 340, border: '1px dashed #ccc', padding: 12 }}>
    <Story />
  </div>
);

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/LikertScaleQuestionRenderer',
  component: JsonFormsControlWrapper,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

function likertSchema(
  overrides: Record<string, unknown> = {},
  likert: Record<string, unknown> = {},
) {
  return {
    type: 'object',
    properties: {
      satisfaction: {
        type: 'integer',
        format: 'likert',
        title: 'How satisfied are you with the service?',
        oneOf: satisfactionOneOf,
        likert: { display: 'buttons', ...likert },
        ...overrides,
      },
    },
  };
}

const uischema = {
  type: 'Control',
  scope: '#/properties/satisfaction',
};

// --- Display variants -------------------------------------------------------

export const Buttons: Story = {
  args: {
    schema: likertSchema(),
    uischema,
    initialData: {},
    renderers,
  },
};

export const ButtonsSelected: Story = {
  args: {
    schema: likertSchema(),
    uischema,
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const ButtonsSpectrum: Story = {
  args: {
    schema: likertSchema({}, { colorMode: 'spectrum' }),
    uischema,
    initialData: { satisfaction: 1 },
    renderers,
  },
};

export const RadioRow: Story = {
  args: {
    schema: likertSchema({}, { display: 'radio' }),
    uischema,
    initialData: { satisfaction: 3 },
    renderers,
  },
};

export const Slider: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        satisfaction: {
          type: 'integer',
          format: 'likert',
          title: 'Rate your experience (0–10)',
          oneOf: npsOneOf,
          likert: { display: 'slider' },
        },
      },
    },
    uischema,
    initialData: { satisfaction: 7 },
    renderers,
  },
};

export const NumericScale: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        satisfaction: {
          type: 'integer',
          format: 'likert',
          title: 'On a scale of 1–5, how likely are you to return?',
          oneOf: Array.from({ length: 5 }, (_, i) => ({
            const: i + 1,
            title: String(i + 1),
          })),
          likert: { display: 'numeric' },
        },
      },
    },
    uischema,
    initialData: { satisfaction: 2 },
    renderers,
  },
};

export const Stars: Story = {
  args: {
    schema: likertSchema({}, { display: 'stars' }),
    uischema,
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const Emoji: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        satisfaction: {
          type: 'integer',
          format: 'likert',
          title: 'How do you feel today?',
          oneOf: [
            { const: 1, title: 'Very bad', emoji: '😞' },
            { const: 2, title: 'Bad', emoji: '😕' },
            { const: 3, title: 'Okay', emoji: '😐' },
            { const: 4, title: 'Good', emoji: '🙂' },
            { const: 5, title: 'Great', emoji: '😄' },
          ],
          likert: { display: 'emoji' },
        },
      },
    },
    uischema,
    initialData: { satisfaction: 5 },
    renderers,
  },
};

// --- Scale configuration ----------------------------------------------------

export const NpsEndpointLabelsOnly: Story = {
  name: 'NPS 0–10 (endpoint labels only)',
  args: {
    schema: {
      type: 'object',
      properties: {
        satisfaction: {
          type: 'integer',
          format: 'likert',
          title: 'How likely are you to recommend us?',
          oneOf: npsOneOf,
          likert: { display: 'buttons', endpointLabelsOnly: true },
        },
      },
    },
    uischema,
    initialData: { satisfaction: 8 },
    renderers,
  },
};

export const PresetAgreement: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        agreement: {
          type: 'integer',
          format: 'likert',
          title: 'I would recommend this service',
          likert: { preset: 'agreement', display: 'buttons' },
        },
      },
    },
    uischema: {
      type: 'Control',
      scope: '#/properties/agreement',
    },
    initialData: {},
    renderers,
  },
};

export const WithNotApplicable: Story = {
  args: {
    schema: likertSchema(
      { type: ['integer', 'null'] },
      {
        allowNotApplicable: true,
        notApplicableLabel: 'Not applicable',
      },
    ),
    uischema,
    initialData: { satisfaction: null },
    renderers,
  },
};

export const StackedVertical: Story = {
  args: {
    schema: likertSchema(),
    uischema: {
      ...uischema,
      options: { orientation: 'vertical' },
    },
    initialData: {},
    renderers,
  },
};

// --- States -----------------------------------------------------------------

export const RequiredError: Story = {
  args: {
    schema: {
      ...likertSchema(),
      required: ['satisfaction'],
    },
    uischema,
    initialData: {},
    renderers,
    validationMode: 'ValidateAndShow',
  },
};

export const Disabled: Story = {
  args: {
    schema: likertSchema(),
    uischema: {
      ...uischema,
      options: { readonly: true },
    },
    initialData: { satisfaction: 3 },
    renderers,
  },
};

export const TranslatedLabels: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        satisfaction: {
          type: 'integer',
          format: 'likert',
          title: 'Quelle est votre satisfaction?',
          oneOf: [
            { const: 1, title: 'Très insatisfait' },
            { const: 2, title: 'Insatisfait' },
            { const: 3, title: 'Neutre' },
            { const: 4, title: 'Satisfait' },
            { const: 5, title: 'Très satisfait' },
          ],
          likert: { display: 'buttons' },
        },
      },
    },
    uischema,
    initialData: {},
    renderers,
  },
};

// --- Mobile / narrow layouts -------------------------------------------------

export const MobileButtons: Story = {
  name: 'Mobile width: buttons wrap',
  decorators: [mobileDecorator],
  args: {
    schema: likertSchema(),
    uischema,
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const MobileNps: Story = {
  name: 'Mobile width: NPS 0–10',
  decorators: [mobileDecorator],
  args: {
    schema: {
      type: 'object',
      properties: {
        satisfaction: {
          type: 'integer',
          format: 'likert',
          title: 'How likely are you to recommend us?',
          oneOf: npsOneOf,
          likert: { display: 'buttons', endpointLabelsOnly: true },
        },
      },
    },
    uischema,
    initialData: { satisfaction: 6 },
    renderers,
  },
};

export const MobileRadioRow: Story = {
  name: 'Mobile width: radio row',
  decorators: [mobileDecorator],
  args: {
    schema: likertSchema({}, { display: 'radio' }),
    uischema,
    initialData: {},
    renderers,
  },
};
