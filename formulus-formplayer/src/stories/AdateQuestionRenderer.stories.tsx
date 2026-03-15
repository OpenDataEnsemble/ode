import type { Meta, StoryObj } from '@storybook/react';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';
import AdateQuestionRenderer, {
  adateQuestionTester,
} from '../renderers/AdateQuestionRenderer';
import { materialRenderers } from '@jsonforms/material-renderers';

const adateSchema = {
  type: 'object',
  properties: {
    eventDate: {
      type: 'string',
      format: 'adate',
      title: 'Approximate date',
      description:
        'Enter the date when possible. Use "Not specified" for unknown day, month or year.',
    },
  },
};

const adateUischema = {
  type: 'Control',
  scope: '#/properties/eventDate',
};

const renderers = [
  { tester: adateQuestionTester, renderer: AdateQuestionRenderer },
  ...materialRenderers,
];

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/AdateQuestionRenderer',
  component: JsonFormsControlWrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    initialData: {
      description:
        'Initial form data (storage format: YYYY-MM-DD, use ?? for unknown parts)',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    schema: adateSchema,
    uischema: adateUischema,
    initialData: {},
    renderers,
  },
};

export const WithFullDate: Story = {
  args: {
    schema: adateSchema,
    uischema: adateUischema,
    initialData: { eventDate: '2024-06-15' },
    renderers,
  },
};

export const WithUnknownDay: Story = {
  args: {
    schema: adateSchema,
    uischema: adateUischema,
    initialData: { eventDate: '2024-06-??' },
    renderers,
  },
};

export const WithUnknownMonthAndDay: Story = {
  args: {
    schema: adateSchema,
    uischema: adateUischema,
    initialData: { eventDate: '2024-??-??' },
    renderers,
  },
};
