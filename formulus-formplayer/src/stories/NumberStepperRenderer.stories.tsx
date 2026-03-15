import type { Meta, StoryObj } from '@storybook/react';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';
import { numberStepperRenderer } from '../renderers/NumberStepperRenderer';
import { materialRenderers } from '@jsonforms/material-renderers';

const ageSchema = {
  type: 'object',
  properties: {
    age: {
      type: 'integer',
      title: 'Age',
      description: 'Please enter your age.',
      minimum: 18,
      maximum: 120,
      default: 25,
    },
  },
};

const ageUischema = {
  type: 'Control',
  scope: '#/properties/age',
};

const renderers = [numberStepperRenderer, ...materialRenderers];

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/NumberStepperRenderer',
  component: JsonFormsControlWrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    initialData: {
      description: 'Initial value for the number field',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    schema: ageSchema,
    uischema: ageUischema,
    initialData: {},
    renderers,
  },
};

export const WithValue: Story = {
  args: {
    schema: ageSchema,
    uischema: ageUischema,
    initialData: { age: 42 },
    renderers,
  },
};

export const AtMinimum: Story = {
  args: {
    schema: ageSchema,
    uischema: ageUischema,
    initialData: { age: 18 },
    renderers,
  },
};

export const AtMaximum: Story = {
  args: {
    schema: ageSchema,
    uischema: ageUischema,
    initialData: { age: 120 },
    renderers,
  },
};
