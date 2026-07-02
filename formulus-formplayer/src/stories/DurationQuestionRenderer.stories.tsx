import type { Meta, StoryObj } from '@storybook/react-vite';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';
import DurationQuestionRenderer, {
  durationQuestionTester,
} from '../renderers/DurationQuestionRenderer';
import { materialRenderers } from '@jsonforms/material-renderers';

const renderers = [
  { tester: durationQuestionTester, renderer: DurationQuestionRenderer },
  ...materialRenderers,
];

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/DurationQuestionRenderer',
  component: JsonFormsControlWrapper,
  parameters: { layout: 'centered' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

const uischema = {
  type: 'Control',
  scope: '#/properties/task_duration',
};

export const StopwatchIdle: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        task_duration: {
          type: 'number',
          format: 'duration',
          title: 'Time to complete the task',
          minimum: 0,
          duration: {
            mode: 'stopwatch',
            unit: 'seconds',
            precision: 1,
            allowManualEntry: true,
          },
        },
      },
    },
    uischema,
    initialData: {},
    renderers,
  },
};

export const StopwatchSaved: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        task_duration: {
          type: 'number',
          format: 'duration',
          title: 'Time to complete the task',
          duration: { mode: 'stopwatch', precision: 1 },
        },
      },
    },
    uischema,
    initialData: { task_duration: 83.4 },
    renderers,
  },
};

export const Countdown: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        task_duration: {
          type: 'number',
          format: 'duration',
          title: 'Hold position duration',
          duration: {
            mode: 'countdown',
            countdownFrom: 60,
            precision: 1,
            allowManualEntry: false,
          },
        },
      },
    },
    uischema,
    initialData: {},
    renderers,
  },
};

export const ManualOnly: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        task_duration: {
          type: 'number',
          format: 'duration',
          title: 'Enter elapsed time (seconds)',
          duration: { mode: 'manual', precision: 1 },
        },
      },
    },
    uischema,
    initialData: {},
    renderers,
  },
};

export const RequiredError: Story = {
  args: {
    schema: {
      type: 'object',
      required: ['task_duration'],
      properties: {
        task_duration: {
          type: 'number',
          format: 'duration',
          title: 'Time to complete the task',
          duration: { mode: 'stopwatch' },
        },
      },
    },
    uischema,
    initialData: {},
    renderers,
    validationMode: 'ValidateAndShow',
  },
};
