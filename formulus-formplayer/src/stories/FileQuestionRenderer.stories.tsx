import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { materialRenderers } from '@jsonforms/material-renderers';
import FileQuestionRenderer, {
  fileQuestionTester,
} from '../renderers/FileQuestionRenderer';
import type {
  FileResult,
  FormulusInterface,
} from '../types/FormulusInterfaceDefinition';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';

const fileSchema = {
  type: 'object',
  properties: {
    fileField: {
      type: 'object',
      format: 'select_file',
      title: 'Attachment',
      description:
        'Select a generic file. Stored like other attachments (basename + metadata only).',
    },
  },
};

const fileUischema = {
  type: 'Control',
  scope: '#/properties/fileField',
};

const renderers = [
  { tester: fileQuestionTester, renderer: FileQuestionRenderer },
  ...materialRenderers,
];

function storyFileBasename(fixed?: string): string {
  if (fixed) {
    return fixed;
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : String(Date.now());
  return `story-file-${id}.pdf`;
}

/**
 * Storybook bridge: {@link FormulusInterface.requestFile} returns basename + portable metadata
 * like RN after copying into attachments draft.
 */
function createFileStoryFormulusMock(options: {
  captureBasename?: string;
  /** Display name shown from metadata.originalFileName */
  pickerDisplayName?: string;
}): FormulusInterface {
  const pickerDisplayName = options.pickerDisplayName ?? 'Quarterly-report.pdf';

  const iface = {
    requestFile: async (_fieldId: string): Promise<FileResult> => {
      const basename = storyFileBasename(options.captureBasename);
      const ts = new Date().toISOString();
      const draftPath = `/story_mock/attachments/draft/${basename}`;
      return {
        status: 'success',
        data: {
          type: 'file',
          filename: basename,
          uri: draftPath,
          url: `file://${draftPath}`,
          mimeType: 'application/pdf',
          size: 128_000,
          timestamp: ts,
          metadata: {
            extension: basename.includes('.')
              ? basename.split('.').pop()!.toLowerCase()
              : 'pdf',
            originalFileName: pickerDisplayName,
          },
        },
      };
    },
    getAttachmentUri: async (): Promise<string | null> => null,
  };

  return iface as FormulusInterface;
}

function installGetFormulusMock(iface: FormulusInterface): void {
  (
    window as unknown as { getFormulus: () => Promise<FormulusInterface> }
  ).getFormulus = () => Promise.resolve(iface);
}

type StoryProps = React.ComponentProps<typeof JsonFormsControlWrapper>;

function FileStoryDecorator(
  Story: React.ComponentType,
  context: { parameters: { formulusMock?: FormulusInterface } },
) {
  const mock =
    context.parameters.formulusMock ?? createFileStoryFormulusMock({});
  installGetFormulusMock(mock);
  return <Story />;
}

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/FileQuestionRenderer',
  component: JsonFormsControlWrapper,
  decorators: [FileStoryDecorator],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    initialData: {
      description:
        'Initial form data under `fileField` (object with basename `filename`)',
    },
  },
};

export default meta;

type Story = StoryObj<StoryProps>;

export const Empty: Story = {
  args: {
    schema: fileSchema,
    uischema: fileUischema,
    initialData: {},
    renderers,
  },
};

export const WithExistingFile: Story = {
  args: {
    schema: fileSchema,
    uischema: fileUischema,
    initialData: {
      fileField: {
        type: 'file',
        filename: 'a1b2c3d4-eeee-4fff-aaaa-bbbbbbbbbbbb.pdf',
        timestamp: new Date().toISOString(),
        metadata: {
          mimeType: 'application/pdf',
          size: 99000,
          extension: 'pdf',
          originalFileName: 'Signed waiver.pdf',
        },
      },
    },
    renderers,
  },
};

/** Older observations may only have attachment basename — UI falls back to `filename`. */
export const BasenameOnlyLegacy: Story = {
  args: {
    schema: fileSchema,
    uischema: fileUischema,
    initialData: {
      fileField: {
        type: 'file',
        filename: 'legacy-key-from-sync.bin',
        timestamp: new Date().toISOString(),
        metadata: {
          mimeType: 'application/octet-stream',
          size: 1024,
          extension: 'bin',
        },
      },
    },
    renderers,
  },
};
