import type { Meta, StoryObj } from '@storybook/react';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';
import SignatureQuestionRenderer, {
  signatureQuestionTester,
} from '../renderers/SignatureQuestionRenderer';
import { materialRenderers } from '@jsonforms/material-renderers';

import sigPng from './assets/sig.png';

const signatureSchema = {
  type: 'object',
  properties: {
    signature: {
      type: ['string', 'object'],
      format: 'signature',
      title: 'Digital Signature',
      description: 'Please provide your signature',
    },
  },
};

const signatureUischema = {
  type: 'Control',
  scope: '#/properties/signature',
};

const renderers = [
  { tester: signatureQuestionTester, renderer: SignatureQuestionRenderer },
  ...materialRenderers,
];

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/SignatureQuestionRenderer',
  component: JsonFormsControlWrapper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    initialData: {
      description: 'Initial form data (e.g. empty or with existing signature)',
    },
  },
};

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    schema: signatureSchema,
    uischema: signatureUischema,
    initialData: {},
    renderers,
  },
};

export const WithExistingSignature: Story = {
  args: {
    schema: signatureSchema,
    uischema: signatureUischema,
    initialData: {
      signature: {
        type: 'signature',
        filename: 'sig.png',
        uri: sigPng,
        timestamp: new Date().toISOString(),
        metadata: { width: 560, height: 200, size: 100, strokeCount: 1 },
      },
    },
    renderers,
  },
};
