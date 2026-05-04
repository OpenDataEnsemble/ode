import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { materialRenderers } from '@jsonforms/material-renderers';
import VideoQuestionRenderer, {
  videoQuestionTester,
} from '../renderers/VideoQuestionRenderer';
import type {
  FormulusInterface,
  VideoResult,
} from '../types/FormulusInterfaceDefinition';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';

const DEMO_VIDEO_URL =
  'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

const videoSchema = {
  type: 'object',
  properties: {
    videoField: {
      type: 'object',
      format: 'video',
      title: 'Video clip',
      description: 'Record a short video.',
    },
  },
};

const videoUischema = {
  type: 'Control',
  scope: '#/properties/videoField',
};

const renderers = [
  { tester: videoQuestionTester, renderer: VideoQuestionRenderer },
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

function storyVideoBasename(fixed?: string): string {
  if (fixed) {
    return fixed;
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : String(Date.now());
  return `story-video-${id}.mp4`;
}

function createVideoStoryFormulusMock(options: {
  seedBasenames?: Record<string, string>;
  captureBasename?: string;
  previewUrlAfterCapture?: string;
}): FormulusInterface {
  const vault = new Map<string, string>(
    Object.entries(options.seedBasenames ?? {}),
  );
  const previewUrl = options.previewUrlAfterCapture ?? DEMO_VIDEO_URL;

  const iface = {
    requestVideo: async (_fieldId: string): Promise<VideoResult> => {
      const basename = storyVideoBasename(options.captureBasename);
      vault.set(basename, previewUrl);
      const ts = new Date().toISOString();
      const draftPath = `/story_mock/attachments/draft/${basename}`;
      return {
        status: 'success',
        data: {
          type: 'video',
          filename: basename,
          uri: draftPath,
          url: `file://${draftPath}`,
          timestamp: ts,
          metadata: {
            duration: 12,
            format: 'mp4',
            size: 500000,
            width: 1280,
            height: 720,
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

function VideoStoryDecorator(
  Story: React.ComponentType,
  context: { parameters: { formulusMock?: FormulusInterface } },
) {
  const mock =
    context.parameters.formulusMock ??
    createVideoStoryFormulusMock({
      seedBasenames: {
        'existing-video.mp4': DEMO_VIDEO_URL,
      },
    });
  installGetFormulusMock(mock);
  return <Story />;
}

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/VideoQuestionRenderer',
  component: JsonFormsControlWrapper,
  decorators: [VideoStoryDecorator],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<StoryProps>;

export const Empty: Story = {
  args: {
    schema: videoSchema,
    uischema: videoUischema,
    initialData: {},
    renderers,
  },
};

export const WithExistingVideo: Story = {
  args: {
    schema: videoSchema,
    uischema: videoUischema,
    initialData: {
      videoField: {
        type: 'video',
        filename: 'existing-video.mp4',
        timestamp: new Date().toISOString(),
        metadata: {
          duration: 10,
          format: 'mp4',
          size: 400000,
          width: 1280,
          height: 720,
        },
      },
    },
    renderers,
  },
};

export const AttachmentUriUnavailable: Story = {
  parameters: {
    formulusMock: createVideoStoryFormulusMock({
      seedBasenames: {},
      captureBasename: 'missing-uri.mp4',
    }),
  },
  args: {
    schema: videoSchema,
    uischema: videoUischema,
    initialData: {
      videoField: {
        type: 'video',
        filename: 'missing-uri.mp4',
        timestamp: new Date().toISOString(),
        metadata: {
          duration: 5,
          format: 'mp4',
          size: 200000,
          width: 640,
          height: 480,
        },
      },
    },
    renderers,
  },
};
