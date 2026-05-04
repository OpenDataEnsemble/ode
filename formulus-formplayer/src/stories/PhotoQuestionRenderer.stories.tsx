import type { Meta, StoryObj } from '@storybook/react-vite';
import React from 'react';
import { materialRenderers } from '@jsonforms/material-renderers';
import PhotoQuestionRenderer, {
  photoQuestionTester,
} from '../renderers/PhotoQuestionRenderer';
import type {
  CameraResult,
  FormulusInterface,
} from '../types/FormulusInterfaceDefinition';
import { JsonFormsControlWrapper } from './JsonFormsControlWrapper';

import demoPhotoUrl from './assets/sig.png';

const photoSchema = {
  type: 'object',
  properties: {
    photoField: {
      type: 'object',
      format: 'photo',
      title: 'Site photo',
      description: 'Capture a photo for this observation.',
    },
  },
};

const photoUischema = {
  type: 'Control',
  scope: '#/properties/photoField',
};

const renderers = [
  { tester: photoQuestionTester, renderer: PhotoQuestionRenderer },
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

function storyCaptureBasename(fixed?: string): string {
  if (fixed) {
    return fixed;
  }
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : String(Date.now());
  return `story-capture-${id}.jpg`;
}

/**
 * Storybook bridge aligned with RN: {@link requestCamera} registers a basename → display URL;
 * previews load only through {@link FormulusInterface.getAttachmentUri} (like
 * {@link resolveAttachmentDisplayUri} on device).
 */
function createPhotoStoryFormulusMock(options: {
  /** Pre-seed basenames (e.g. loaded observation) → browser-loadable preview URL */
  seedBasenames?: Record<string, string>;
  /** Fixed basename for each simulated capture (default: random per tap) */
  captureBasename?: string;
  /** URL returned by getAttachmentUri after capture */
  previewUrlAfterCapture?: string;
}): FormulusInterface {
  const vault = new Map<string, string>(
    Object.entries(options.seedBasenames ?? {}),
  );
  const previewUrl = options.previewUrlAfterCapture ?? demoPhotoUrl;

  const iface = {
    requestCamera: async (_fieldId: string): Promise<CameraResult> => {
      const basename = storyCaptureBasename(options.captureBasename);
      vault.set(basename, previewUrl);
      const ts = new Date().toISOString();
      const draftPath = `/story_mock/attachments/draft/${basename}`;
      return {
        status: 'success',
        data: {
          type: 'image',
          id: basename.replace(/\.jpg$/i, ''),
          filename: basename,
          uri: draftPath,
          url: `file://${draftPath}`,
          timestamp: ts,
          metadata: {
            width: 1200,
            height: 900,
            size: 95000,
            mimeType: 'image/jpeg',
            source: 'storybook_mock',
            quality: 85,
            persistentStorage: true,
            storageLocation: 'story_attachments_draft',
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
  (window as unknown as { getFormulus: () => Promise<FormulusInterface> }).getFormulus =
    () => Promise.resolve(iface);
}

type StoryProps = React.ComponentProps<typeof JsonFormsControlWrapper>;

function PhotoStoryDecorator(
  Story: React.ComponentType,
  context: { parameters: { formulusMock?: FormulusInterface } },
) {
  const mock =
    context.parameters.formulusMock ??
    createPhotoStoryFormulusMock({
      seedBasenames: {
        'existing-photo.jpg': demoPhotoUrl,
      },
    });
  installGetFormulusMock(mock);
  return <Story />;
}

const meta: Meta<typeof JsonFormsControlWrapper> = {
  title: 'Question Renderers/PhotoQuestionRenderer',
  component: JsonFormsControlWrapper,
  decorators: [PhotoStoryDecorator],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    initialData: {
      description:
        'Initial form data under `photoField` (object with basename `filename` after capture)',
    },
  },
};

export default meta;

type Story = StoryObj<StoryProps>;

export const Empty: Story = {
  args: {
    schema: photoSchema,
    uischema: photoUischema,
    initialData: {},
    renderers,
  },
};

export const WithExistingPhoto: Story = {
  args: {
    schema: photoSchema,
    uischema: photoUischema,
    initialData: {
      photoField: {
        id: 'existing-id',
        type: 'image',
        filename: 'existing-photo.jpg',
        timestamp: new Date().toISOString(),
        metadata: {
          width: 1200,
          height: 900,
          size: 95000,
          mimeType: 'image/jpeg',
          quality: 85,
        },
      },
    },
    renderers,
  },
};

/** Same contract as RN when the file is missing from draft/synced folders — basename ok, no preview URL. */
export const AttachmentUriUnavailable: Story = {
  parameters: {
    formulusMock: createPhotoStoryFormulusMock({
      seedBasenames: {},
      captureBasename: 'missing-uri.jpg',
    }),
  },
  args: {
    schema: photoSchema,
    uischema: photoUischema,
    initialData: {
      photoField: {
        id: 'no-uri',
        type: 'image',
        filename: 'missing-uri.jpg',
        timestamp: new Date().toISOString(),
        metadata: {
          width: 800,
          height: 600,
          size: 1000,
          mimeType: 'image/jpeg',
          quality: 80,
        },
      },
    },
    renderers,
  },
};
