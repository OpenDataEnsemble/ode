import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';
import LikertScaleQuestionRenderer, {
  likertScaleQuestionTester,
} from '../renderers/LikertScaleQuestionRenderer';
import { materialRenderers } from '@jsonforms/material-renderers';
import type { LikertOneOfEntry } from '../components/likert/likertTypes';
import {
  likertField,
  likertObjectSchema,
  likertPresetField,
} from '../components/likert/likertSchemaHelpers';

const satisfactionOneOf: LikertOneOfEntry[] = [
  { const: 1, title: 'Very dissatisfied' },
  { const: 2, title: 'Dissatisfied' },
  { const: 3, title: 'Neutral' },
  { const: 4, title: 'Satisfied' },
  { const: 5, title: 'Very satisfied' },
];

const npsOneOf: LikertOneOfEntry[] = Array.from({ length: 11 }, (_, i) => ({
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

function satisfactionSchema(
  likert: Parameters<typeof likertField>[1]['likert'] = {},
  fieldOverrides: Parameters<typeof likertField>[1] = {},
) {
  return likertObjectSchema(
    likertField(satisfactionOneOf, {
      title: 'How satisfied are you with the service?',
      likert: { display: 'buttons', ...likert },
      ...fieldOverrides,
    }),
  );
}

const uischema = {
  type: 'Control',
  scope: '#/properties/satisfaction',
};

// --- Display variants -------------------------------------------------------

export const Buttons: Story = {
  args: { schema: satisfactionSchema(), uischema, initialData: {}, renderers },
};

export const ButtonsSelected: Story = {
  args: {
    schema: satisfactionSchema(),
    uischema,
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const ButtonsSpectrum: Story = {
  args: {
    schema: satisfactionSchema({ colorMode: 'spectrum' }),
    uischema,
    initialData: { satisfaction: 1 },
    renderers,
  },
};

export const RadioRow: Story = {
  args: {
    schema: satisfactionSchema({ display: 'radio' }),
    uischema,
    initialData: { satisfaction: 3 },
    renderers,
  },
};

export const Slider: Story = {
  args: {
    schema: likertObjectSchema(
      likertField(npsOneOf, {
        title: 'Rate your experience (0–10)',
        likert: { display: 'slider' },
      }),
    ),
    uischema,
    initialData: { satisfaction: 7 },
    renderers,
  },
};

export const NumericScale: Story = {
  args: {
    schema: likertObjectSchema(
      likertField(
        Array.from({ length: 5 }, (_, i) => ({
          const: i + 1,
          title: String(i + 1),
        })),
        {
          title: 'On a scale of 1–5, how likely are you to return?',
          likert: { display: 'numeric' },
        },
      ),
    ),
    uischema,
    initialData: { satisfaction: 2 },
    renderers,
  },
};

export const NumericWithWordAnchors: Story = {
  name: 'Numeric + word anchors (recommended)',
  args: {
    schema: likertObjectSchema(
      likertField(
        [
          { const: 0, title: 'No pain' },
          { const: 1, title: '1' },
          { const: 2, title: '2' },
          { const: 3, title: '3' },
          { const: 4, title: '4' },
          { const: 5, title: '5' },
          { const: 6, title: '6' },
          { const: 7, title: '7' },
          { const: 8, title: '8' },
          { const: 9, title: '9' },
          { const: 10, title: 'Worst pain' },
        ],
        {
          title: 'Rate your pain level',
          likert: { display: 'numeric', colorMode: 'spectrum' },
        },
      ),
    ),
    uischema,
    initialData: { satisfaction: 3 },
    renderers,
  },
};

export const Stars: Story = {
  args: {
    schema: satisfactionSchema({ display: 'stars' }),
    uischema,
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const Emoji: Story = {
  args: {
    schema: likertObjectSchema(
      likertField(
        [
          { const: 1, title: 'Very bad', emoji: '😞' },
          { const: 2, title: 'Bad', emoji: '😕' },
          { const: 3, title: 'Okay', emoji: '😐' },
          { const: 4, title: 'Good', emoji: '🙂' },
          { const: 5, title: 'Great', emoji: '😄' },
        ],
        {
          title: 'How do you feel today?',
          likert: { display: 'emoji' },
        },
      ),
    ),
    uischema,
    initialData: { satisfaction: 5 },
    renderers,
  },
};

// --- Scale configuration ----------------------------------------------------

export const NpsEndpointLabelsOnly: Story = {
  name: 'NPS 0–10 (endpoint labels only)',
  args: {
    schema: likertObjectSchema(
      likertField(npsOneOf, {
        title: 'How likely are you to recommend us?',
        likert: { display: 'buttons', endpointLabelsOnly: true },
      }),
    ),
    uischema,
    initialData: { satisfaction: 8 },
    renderers,
  },
};

export const PresetAgreement: Story = {
  args: {
    schema: likertObjectSchema(
      likertPresetField('agreement', {
        title: 'I would recommend this service',
        likert: { display: 'buttons' },
      }),
      'agreement',
    ),
    uischema: { type: 'Control', scope: '#/properties/agreement' },
    initialData: {},
    renderers,
  },
};

export const WithNotApplicable: Story = {
  args: {
    schema: satisfactionSchema(
      {
        allowNotApplicable: true,
        notApplicableLabel: 'Not applicable',
      },
      { type: ['integer', 'null'] },
    ),
    uischema,
    initialData: { satisfaction: null },
    renderers,
  },
};

export const StackedVertical: Story = {
  args: {
    schema: satisfactionSchema(),
    uischema: { ...uischema, options: { orientation: 'vertical' } },
    initialData: {},
    renderers,
  },
};

export const TwoColumnLayout: Story = {
  name: 'Two-column layout (cols-2)',
  args: {
    schema: satisfactionSchema(),
    uischema: { ...uischema, options: { orientation: 'cols-2' } },
    initialData: { satisfaction: 3 },
    renderers,
  },
};

// --- States -----------------------------------------------------------------

export const RequiredError: Story = {
  args: {
    schema: likertObjectSchema(
      likertField(satisfactionOneOf, {
        title: 'How satisfied are you with the service?',
        likert: { display: 'buttons' },
      }),
      'satisfaction',
      ['satisfaction'],
    ),
    uischema,
    initialData: {},
    renderers,
    validationMode: 'ValidateAndShow',
  },
};

export const Disabled: Story = {
  args: {
    schema: satisfactionSchema(),
    uischema: { ...uischema, options: { readonly: true } },
    initialData: { satisfaction: 3 },
    renderers,
  },
};

export const ReadOnlyReview: Story = {
  name: 'Readonly / review mode',
  args: {
    schema: satisfactionSchema({ colorMode: 'spectrum' }),
    uischema: { ...uischema, options: { readonly: true } },
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const ReadOnlyReviewNumeric: Story = {
  name: 'Readonly / review (numeric + anchors)',
  args: {
    schema: likertObjectSchema(
      likertField(
        [
          { const: 0, title: 'No pain' },
          { const: 1, title: '1' },
          { const: 2, title: '2' },
          { const: 3, title: '3' },
          { const: 4, title: '4' },
          { const: 5, title: '5' },
          { const: 6, title: '6' },
          { const: 7, title: '7' },
          { const: 8, title: '8' },
          { const: 9, title: '9' },
          { const: 10, title: 'Worst pain' },
        ],
        {
          title: 'Rate your pain level',
          likert: { display: 'numeric', colorMode: 'spectrum' },
        },
      ),
    ),
    uischema: {
      type: 'Control',
      scope: '#/properties/satisfaction',
      options: { readonly: true },
    },
    initialData: { satisfaction: 7 },
    renderers,
  },
};

export const EmojiSpectrum: Story = {
  name: 'Emoji + spectrum accent',
  args: {
    schema: likertObjectSchema(
      likertField(
        [
          { const: 1, title: 'Very bad', emoji: '😞' },
          { const: 2, title: 'Bad', emoji: '😕' },
          { const: 3, title: 'Okay', emoji: '😐' },
          { const: 4, title: 'Good', emoji: '🙂' },
          { const: 5, title: 'Great', emoji: '😄' },
        ],
        {
          title: 'How do you feel today?',
          likert: { display: 'emoji', colorMode: 'spectrum' },
        },
      ),
    ),
    uischema,
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const TranslatedLabels: Story = {
  args: {
    schema: likertObjectSchema(
      likertField(
        [
          { const: 1, title: 'Très insatisfait' },
          { const: 2, title: 'Insatisfait' },
          { const: 3, title: 'Neutre' },
          { const: 4, title: 'Satisfait' },
          { const: 5, title: 'Très satisfait' },
        ],
        {
          title: 'Quelle est votre satisfaction?',
          likert: { display: 'buttons' },
        },
      ),
    ),
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
    schema: satisfactionSchema(),
    uischema,
    initialData: { satisfaction: 4 },
    renderers,
  },
};

export const MobileNps: Story = {
  name: 'Mobile width: NPS 0–10',
  decorators: [mobileDecorator],
  args: {
    schema: likertObjectSchema(
      likertField(npsOneOf, {
        title: 'How likely are you to recommend us?',
        likert: { display: 'buttons', endpointLabelsOnly: true },
      }),
    ),
    uischema,
    initialData: { satisfaction: 6 },
    renderers,
  },
};

export const MobileRadioRow: Story = {
  name: 'Mobile width: radio row',
  decorators: [mobileDecorator],
  args: {
    schema: satisfactionSchema({ display: 'radio' }),
    uischema,
    initialData: {},
    renderers,
  },
};
