import type { Meta, StoryObj } from '@storybook/react-vite';
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

const hemoglobinSchema = {
  type: 'object',
  properties: {
    hb_resultado: {
      type: 'number',
      title: 'Resultado de hemoglobina',
      minimum: 0,
      maximum: 25,
    },
  },
};

const hemoglobinUischema = {
  type: 'Control',
  scope: '#/properties/hb_resultado',
  label: 'Resultado de hemoglobina',
};

const decimalSchema = {
  type: 'object',
  properties: {
    measurement: {
      type: 'number',
      title: 'Measurement',
      multipleOf: 0.1,
    },
  },
};

const decimalUischema = {
  type: 'Control',
  scope: '#/properties/measurement',
};

const renderers = [numberStepperRenderer, ...materialRenderers];

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/NumberStepperRenderer',
  component: JsonFormsControlWrapper,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'Built-in numeric control for `type: integer` and `type: number`. Uses draft-while-focused text input (`inputMode` + `enterKeyHint`); never clamps schema bounds while typing.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    initialData: {
      description: 'Initial value for the number field',
    },
    keyboardEnterKeyHint: {
      control: 'select',
      options: ['next', 'done', 'go'],
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
    keyboardEnterKeyHint: 'next',
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

/** Mirrors GBMIS lab `hb_resultado` — decimal `type: number` with bounds 0–25. */
export const HemoglobinLab: Story = {
  args: {
    schema: hemoglobinSchema,
    uischema: hemoglobinUischema,
    initialData: {},
    renderers,
    keyboardEnterKeyHint: 'next',
  },
};

/** Type 35 to see max validation without value snapping; backspace to clear and enter 16. */
export const OverMaximumWhileTyping: Story = {
  args: {
    schema: hemoglobinSchema,
    uischema: hemoglobinUischema,
    initialData: {},
    renderers,
    validationMode: 'ValidateAndShow',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Enter 35: inline error for maximum 25, but the field keeps showing 35 until you edit. Backspace to empty, then type 16.',
      },
    },
  },
};

export const BackspaceAndReplace: Story = {
  args: {
    schema: hemoglobinSchema,
    uischema: hemoglobinUischema,
    initialData: { hb_resultado: 35 },
    renderers,
    validationMode: 'ValidateAndShow',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Starts at 35 (over max). Focus, backspace all digits, type 16 — value must not snap to a bound while editing.',
      },
    },
  },
};

export const DecimalEntry: Story = {
  args: {
    schema: decimalSchema,
    uischema: decimalUischema,
    initialData: {},
    renderers,
    keyboardEnterKeyHint: 'done',
  },
};

export const IntegerWithNextKey: Story = {
  args: {
    schema: ageSchema,
    uischema: ageUischema,
    initialData: { age: 30 },
    renderers,
    keyboardEnterKeyHint: 'next',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Inspect the input in mobile devtools: `inputmode=numeric`, `enterkeyhint=next`.',
      },
    },
  },
};
