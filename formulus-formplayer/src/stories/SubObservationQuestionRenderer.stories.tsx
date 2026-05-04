import type { Meta, StoryObj } from '@storybook/react-vite';
import React, { useEffect } from 'react';
import { materialRenderers } from '@jsonforms/material-renderers';
import {
  SubObservationQuestionRenderer,
  subObservationQuestionTester,
} from '../renderers/SubObservationQuestionRenderer';
import type {
  FormCompletionResult,
  FormulusInterface,
} from '../types/FormulusInterfaceDefinition';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';

const linkedChildFormType = 'story_child_visit';

const parentSchemaBase = {
  type: 'object',
  properties: {
    observationId: {
      type: 'string',
      title: 'Parent observation ID',
      default: 'story-parent-obs-001',
    },
    sites: {
      type: 'array',
      format: 'sub-observation',
      title: 'Site visits',
      description:
        'Embedded repeats; Storybook mocks nested sessions via openFormplayer(subObservationMode).',
      linkedForm: linkedChildFormType,
      parentKey: 'parentSurveyId',
      parentValuePath: 'observationId',
      columns: [
        { key: 'siteName', label: 'Site' },
        { key: 'visitDate', label: 'Visited' },
      ],
      items: { type: 'object' },
    },
  },
};

const parentUischema = {
  type: 'VerticalLayout',
  elements: [
    { type: 'Control', scope: '#/properties/observationId' },
    {
      type: 'Control',
      scope: '#/properties/sites',
      label: 'Related site visits',
    },
  ],
};

const renderers = [
  {
    tester: subObservationQuestionTester,
    renderer: SubObservationQuestionRenderer,
  },
  ...materialRenderers,
];

type AddBehaviour = 'submit_new_row' | 'cancel_add';

function createSubObservationStoryFormulusMock(options?: {
  addBehaviour?: AddBehaviour;
}): FormulusInterface {
  const addBehaviour = options?.addBehaviour ?? 'submit_new_row';

  const iface: Pick<FormulusInterface, 'openFormplayer'> = {
    openFormplayer: async (
      formType: string,
      params: Record<string, unknown>,
      savedData: Record<string, unknown>,
      opts?: { subObservationMode?: boolean },
    ): Promise<FormCompletionResult> => {
      if (!opts?.subObservationMode) {
        return {
          status: 'error',
          formType,
          message:
            'Storybook mock: openFormplayer only implements subObservationMode',
        };
      }

      const savedKeys = Object.keys(savedData || {}).filter(
        k => savedData[k] !== undefined && savedData[k] !== null,
      );
      const isEdit = savedKeys.length > 0;

      if (!isEdit && addBehaviour === 'cancel_add') {
        return { status: 'cancelled', formType };
      }

      const parentLink =
        (typeof params.parentSurveyId === 'string' && params.parentSurveyId) ||
        (typeof savedData.parentSurveyId === 'string' &&
          savedData.parentSurveyId) ||
        '';

      if (!isEdit) {
        return {
          status: 'form_submitted',
          formType,
          formData: {
            siteName: 'Mock added site',
            visitDate: '2026-05-04',
            parentSurveyId: parentLink || 'story-parent-fallback',
          },
        };
      }

      const prevName =
        typeof savedData.siteName === 'string' ? savedData.siteName : 'Site';
      return {
        status: 'form_updated',
        formType,
        formData: {
          ...savedData,
          siteName: `${prevName} (edited)`,
        },
      };
    },
  };

  return iface as FormulusInterface;
}

function installGetFormulusMock(iface: FormulusInterface): void {
  (
    window as unknown as { getFormulus: () => Promise<FormulusInterface> }
  ).getFormulus = () => Promise.resolve(iface);
}

type StoryProps = React.ComponentProps<typeof JsonFormsControlWrapper>;

function ConfirmStubWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const prev = window.confirm;
    window.confirm = () => true;
    return () => {
      window.confirm = prev;
    };
  }, []);
  return <>{children}</>;
}

function SubObservationStoryDecorator(
  Story: React.ComponentType,
  context: { parameters: { formulusMock?: FormulusInterface } },
) {
  const mock =
    context.parameters.formulusMock ??
    createSubObservationStoryFormulusMock({});
  installGetFormulusMock(mock);
  return (
    <ConfirmStubWrapper>
      <Story />
    </ConfirmStubWrapper>
  );
}

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/SubObservationQuestionRenderer',
  component: JsonFormsControlWrapper,
  decorators: [SubObservationStoryDecorator],
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<StoryProps>;

export const Empty: Story = {
  args: {
    schema: parentSchemaBase,
    uischema: parentUischema,
    initialData: {
      observationId: 'story-parent-obs-001',
      sites: [],
    },
    renderers,
  },
};

export const WithRows: Story = {
  args: {
    schema: parentSchemaBase,
    uischema: parentUischema,
    initialData: {
      observationId: 'story-parent-obs-001',
      sites: [
        {
          siteName: 'North station',
          visitDate: '2026-01-10',
          parentSurveyId: 'story-parent-obs-001',
        },
        {
          siteName: 'South depot',
          visitDate: '2026-02-02',
          parentSurveyId: 'story-parent-obs-001',
        },
      ],
    },
    renderers,
  },
};

/** Schema missing `linkedForm` — renderer surfaces configuration error. */
export const Misconfigured: Story = {
  args: {
    schema: {
      type: 'object',
      properties: {
        observationId: {
          type: 'string',
          title: 'Parent observation ID',
          default: 'x',
        },
        sites: {
          type: 'array',
          format: 'sub-observation',
          title: 'Broken repeat',
          parentKey: 'parentSurveyId',
          items: { type: 'object' },
        },
      },
    },
    uischema: parentUischema,
    initialData: {
      observationId: 'x',
      sites: [],
    },
    renderers,
  },
};

/** Simulated user backs out of the nested form — no row appended. */
export const AddCancelled: Story = {
  parameters: {
    formulusMock: createSubObservationStoryFormulusMock({
      addBehaviour: 'cancel_add',
    }),
  },
  args: {
    schema: parentSchemaBase,
    uischema: parentUischema,
    initialData: {
      observationId: 'story-parent-obs-001',
      sites: [],
    },
    renderers,
  },
};

export const DeleteDisabled: Story = {
  args: {
    schema: {
      ...parentSchemaBase,
      properties: {
        ...parentSchemaBase.properties,
        sites: {
          ...parentSchemaBase.properties.sites,
          allowDelete: false,
        },
      },
    },
    uischema: parentUischema,
    initialData: {
      observationId: 'story-parent-obs-001',
      sites: [
        {
          siteName: 'Locked row',
          visitDate: '2026-03-01',
          parentSurveyId: 'story-parent-obs-001',
        },
      ],
    },
    renderers,
  },
};
