import { describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_FORM_PREVIEW_PREFIX,
  FORM_PREVIEW_FORMULUS_INTERFACE_VERSION,
  FORMULUS_INJECTION_REQUEST_TYPES,
  handleFormPreviewBridgeMessage,
  postFormplayerBridgeReply,
} from '../formPreviewBridge';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../tauriClient', () => ({
  tauriClient: {
    getWorkspace: vi.fn().mockResolvedValue('/mock/ws'),
    listActiveBundleForms: vi.fn().mockResolvedValue([
      { formType: 'demo' },
    ]),
    listObservationsPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    getActiveBundleFormsFileBaseUrl: vi
      .fn()
      .mockResolvedValue('file:///tmp/ws/bundles/active/forms'),
    workspaceDirectoryFileUrl: vi
      .fn()
      .mockResolvedValue('file:///tmp/ws/attachments/'),
    workspaceAttachmentFileUrl: vi.fn().mockResolvedValue(null),
  },
}));

describe('FORMULUS_INJECTION_REQUEST_TYPES', () => {
  it('lists known injection request types', () => {
    expect(FORMULUS_INJECTION_REQUEST_TYPES).toContain('getVersion');
    expect(FORMULUS_INJECTION_REQUEST_TYPES).toContain('submitObservation');
  });
});

describe('handleFormPreviewBridgeMessage', () => {
  it('replies to getVersion', async () => {
    const postMessage = vi.fn();
    const iframe = {
      contentWindow: { postMessage } as unknown as Window,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      JSON.stringify({
        type: 'getVersion',
        messageId: 'm1',
      }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(payload.type).toBe('getVersion_response');
    expect(payload.messageId).toBe('m1');
    expect(payload.result).toBe(FORM_PREVIEW_FORMULUS_INTERFACE_VERSION);
  });

  it('stubs requestCamera with prefixed error', async () => {
    const postMessage = vi.fn();
    const iframe = {
      contentWindow: { postMessage } as unknown as Window,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      JSON.stringify({
        type: 'requestCamera',
        messageId: 'm2',
      }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    const payload = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(payload.type).toBe('requestCamera_response');
    expect(payload.error).toContain(DESKTOP_FORM_PREVIEW_PREFIX);
  });

  it('ignores messages without messageId', async () => {
    const postMessage = vi.fn();
    const iframe = {
      contentWindow: { postMessage } as unknown as Window,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      JSON.stringify({ type: 'formplayerReadyToReceiveInit' }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(postMessage).not.toHaveBeenCalled();
  });
});

describe('postFormplayerBridgeReply', () => {
  it('uses *_response type', () => {
    const postMessage = vi.fn();
    const iframe = {
      contentWindow: { postMessage } as unknown as Window,
    } as HTMLIFrameElement;

    postFormplayerBridgeReply(iframe, 'getThemeMode', 'mid', {
      result: 'system',
    });

    const payload = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(payload.type).toBe('getThemeMode_response');
  });
});
