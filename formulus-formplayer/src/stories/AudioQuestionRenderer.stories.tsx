import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { materialRenderers } from '@jsonforms/material-renderers';
import AudioQuestionRenderer, {
  audioQuestionTester,
} from '../renderers/AudioQuestionRenderer';
import type {
  AudioResult,
  FormulusInterface,
} from '../types/FormulusInterfaceDefinition';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';

/** Short CC0 sample — playable in iframe without bundling binary assets. */
const DEMO_AUDIO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-audio/t-rex-roar.mp3';

const audioSchema = {
  type: 'object',
  properties: {
    audioField: {
      type: 'object',
      format: 'audio',
      title: 'Voice note',
      description: 'Record a short audio clip.',
    },
  },
};

const audioUischema = {
  type: 'Control',
  scope: '#/properties/audioField',
};

const renderers = [
  { tester: audioQuestionTester, renderer: AudioQuestionRenderer },
  ...materialRenderers,
];

function basenameFromAttachmentRef(
  fileRef: string | { filename?: string },
): string {
  const raw =
    typeof fileRef === 'string' ? fileRef : (fileRef.filename ?? '').trim();
  if (!raw) {
    return '';
  }
  const normalized = raw.replace(/\\/g, '/');
  return normalized.split('/').pop()?.trim() ?? '';
}

function storyAudioBasename(fixed?: string): string {
  if (fixed) {
    return fixed;
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : String(Date.now());
  return `story-audio-${id}.m4a`;
}

function createAudioStoryFormulusMock(options: {
  seedBasenames?: Record<string, string>;
  captureBasename?: string;
  previewUrlAfterCapture?: string;
}): FormulusInterface {
  const vault = new Map<string, string>(
    Object.entries(options.seedBasenames ?? {}),
  );
  const previewUrl = options.previewUrlAfterCapture ?? DEMO_AUDIO_URL;

  const iface = {
    requestAudio: async (_fieldId: string): Promise<AudioResult> => {
      const basename = storyAudioBasename(options.captureBasename);
      vault.set(basename, previewUrl);
      const ts = new Date().toISOString();
      const draftPath = `/story_mock/attachments/draft/${basename}`;
      return {
        status: 'success',
        data: {
          type: 'audio',
          filename: basename,
          uri: `file://${draftPath}`,
          url: previewUrl,
          base64: '',
          timestamp: ts,
          metadata: {
            duration: 2.5,
            format: 'm4a',
            sampleRate: 44100,
            channels: 1,
            size: 120000,
          },
        },
      };
    },
    getAttachmentUri: async (
      fileRef: string | { filename?: string },
    ): Promise<string | null> => {
      const base = basenameFromAttachmentRef(fileRef);
      return base ? (vault.get(base) ?? null) : null;
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

function AudioStoryDecorator(
  Story: React.ComponentType,
  context: { parameters: { formulusMock?: FormulusInterface } },
) {
  const mock =
    context.parameters.formulusMock ??
    createAudioStoryFormulusMock({
      seedBasenames: {
        'existing-audio.m4a': DEMO_AUDIO_URL,
      },
    });
  installGetFormulusMock(mock);
  return <Story />;
}

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/AudioQuestionRenderer',
  component: JsonFormsControlWrapper,
  decorators: [AudioStoryDecorator],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<StoryProps>;

export const Empty: Story = {
  args: {
    schema: audioSchema,
    uischema: audioUischema,
    initialData: {},
    renderers,
  },
};

export const WithExistingAudio: Story = {
  args: {
    schema: audioSchema,
    uischema: audioUischema,
    initialData: {
      audioField: {
        type: 'audio',
        filename: 'existing-audio.m4a',
        timestamp: new Date().toISOString(),
        metadata: {
          duration: 3,
          format: 'm4a',
          sampleRate: 44100,
          channels: 1,
          size: 95000,
        },
      },
    },
    renderers,
  },
};

export const AttachmentUriUnavailable: Story = {
  parameters: {
    formulusMock: createAudioStoryFormulusMock({
      seedBasenames: {},
      captureBasename: 'missing-uri.m4a',
    }),
  },
  args: {
    schema: audioSchema,
    uischema: audioUischema,
    initialData: {
      audioField: {
        type: 'audio',
        filename: 'missing-uri.m4a',
        timestamp: new Date().toISOString(),
        metadata: {
          duration: 1,
          format: 'm4a',
          sampleRate: 44100,
          channels: 1,
          size: 1000,
        },
      },
    },
    renderers,
  },
};
