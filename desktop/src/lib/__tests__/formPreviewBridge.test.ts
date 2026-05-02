import { describe, expect, it, vi } from 'vitest';
import {
  DESKTOP_FORM_PREVIEW_PREFIX,
  FORM_PREVIEW_FORMULUS_INTERFACE_VERSION,
  FORMULUS_INJECTION_REQUEST_TYPES,
  handleFormPreviewBridgeMessage,
  postFormplayerBridgeReply,
} from '../formPreviewBridge';
import { tauriClient } from '../tauriClient';

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `asset:${path}`,
}));

vi.mock('@tauri-apps/api/path', () => ({
  join: (...parts: string[]) => parts.join('/'),
}));

vi.mock('../tauriClient', () => ({
  tauriClient: {
    getWorkspace: vi.fn().mockResolvedValue('/mock/ws'),
    listActiveBundleForms: vi.fn().mockResolvedValue([{ formType: 'demo' }]),
    listObservationsPage: vi.fn().mockResolvedValue({ rows: [], total: 0 }),
    getActiveBundleFormsFileBaseUrl: vi
      .fn()
      .mockResolvedValue('file:///tmp/ws/bundles/active/forms'),
    workspaceDirectoryFileUrl: vi
      .fn()
      .mockResolvedValue('file:///tmp/ws/attachments/synced/'),
    workspaceAttachmentFileUrl: vi.fn().mockResolvedValue(null),
  },
}));

/** Mimics iframe → parent messages so reply routing matches `event.source`. */
function bridgeMessageFromIframe(
  iframe: HTMLIFrameElement,
  payload: Record<string, unknown>,
): MessageEvent {
  const cw = iframe.contentWindow as Window;
  return new MessageEvent('message', {
    data: JSON.stringify(payload),
    source: cw,
    origin: 'http://localhost',
  });
}

describe('FORMULUS_INJECTION_REQUEST_TYPES', () => {
  it('lists known injection request types', () => {
    expect(FORMULUS_INJECTION_REQUEST_TYPES).toContain('getVersion');
    expect(FORMULUS_INJECTION_REQUEST_TYPES).toContain('submitObservation');
  });
});

describe('handleFormPreviewBridgeMessage', () => {
  it('replies to getVersion', async () => {
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(iframe, {
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

  it('routes replies to iframe matched by resolveReplyIframe when source is nested', async () => {
    const postPrimary = vi.fn();
    const postNested = vi.fn();
    const nestedCw = { postMessage: postNested } as unknown as Window;
    const nestedIframe = {
      contentWindow: nestedCw,
    } as HTMLIFrameElement;
    const primaryCw = { postMessage: postPrimary } as unknown as Window;
    const primaryIframe = {
      contentWindow: primaryCw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      new MessageEvent('message', {
        data: JSON.stringify({ type: 'getVersion', messageId: 'mv2' }),
        source: nestedCw,
        origin: 'http://localhost',
      }),
      {
        iframe: primaryIframe,
        resolveReplyIframe: src =>
          src === nestedCw
            ? nestedIframe
            : src === primaryCw
              ? primaryIframe
              : null,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(postNested).toHaveBeenCalledTimes(1);
    expect(postPrimary).not.toHaveBeenCalled();
  });

  it('defers openFormplayer_response when subObservationMode and hook provided', async () => {
    const postPrimary = vi.fn();
    const primaryCw = { postMessage: postPrimary } as unknown as Window;
    const primaryIframe = {
      contentWindow: primaryCw,
    } as HTMLIFrameElement;
    const defer = vi.fn();

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(primaryIframe, {
        type: 'openFormplayer',
        messageId: 'op-def',
        formType: 'child_form',
        params: { a: 1 },
        savedData: {},
        options: { subObservationMode: true },
      }),
      {
        iframe: primaryIframe,
        resolveReplyIframe: src =>
          src === primaryCw ? primaryIframe : null,
        onFinalize: async () => ({ error: 'no' }),
        onDeferOpenSubObservation: defer,
      },
    );

    expect(postPrimary).not.toHaveBeenCalled();
    expect(defer).toHaveBeenCalledWith({
      parentIframe: primaryIframe,
      messageId: 'op-def',
      formType: 'child_form',
      params: { a: 1 },
      savedData: {},
    });
  });

  it('completes nested finalize without calling onFinalize when hook returns payload', async () => {
    const postNested = vi.fn();
    const nestedCw = { postMessage: postNested } as unknown as Window;
    const nestedIframe = {
      contentWindow: nestedCw,
    } as HTMLIFrameElement;

    const onFinalize = vi.fn(async () => ({ result: 'should-not-run' }));
    const tryNested = vi.fn(
      async (): Promise<{ result: string } | null> => ({
        result: 'nested-synthetic-id',
      }),
    );

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(nestedIframe, {
        type: 'submitObservation',
        messageId: 'sub-n',
        formType: 'x',
        finalData: { k: 'v' },
      }),
      {
        iframe: null,
        resolveReplyIframe: src =>
          src === nestedCw ? nestedIframe : null,
        onFinalize,
        tryCompleteNestedSubObservationFinalize: tryNested,
      },
    );

    expect(tryNested).toHaveBeenCalled();
    expect(onFinalize).not.toHaveBeenCalled();
    expect(postNested).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postNested.mock.calls[0][0] as string);
    expect(payload.type).toBe('submitObservation_response');
    expect(payload.result).toBe('nested-synthetic-id');
  });

  it('stubs requestCamera with prefixed error', async () => {
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(iframe, {
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

  it('getAttachmentUri maps file:// through convertFileSrc for iframe img', async () => {
    vi.mocked(tauriClient.workspaceAttachmentFileUrl).mockResolvedValueOnce(
      'file:///home/u/ws/attachments/synced/a.jpg',
    );
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(iframe, {
        type: 'getAttachmentUri',
        messageId: 'ga1',
        fileName: 'a.jpg',
      }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(payload.type).toBe('getAttachmentUri_response');
    expect(payload.result).toBe('asset:/home/u/ws/attachments/synced/a.jpg');
  });

  it('getAttachmentUri resolves basename from filename descriptor', async () => {
    vi.mocked(tauriClient.workspaceAttachmentFileUrl).mockResolvedValueOnce(
      'file:///home/u/ws/attachments/synced/b.jpg',
    );
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(iframe, {
        type: 'getAttachmentUri',
        messageId: 'ga2',
        fileName: { filename: 'b.jpg' },
      }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(tauriClient.workspaceAttachmentFileUrl).toHaveBeenCalledWith(
      'b.jpg',
    );
    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(payload.type).toBe('getAttachmentUri_response');
    expect(payload.result).toBe('asset:/home/u/ws/attachments/synced/b.jpg');
  });

  it('getAttachmentUri returns null when workspace resolves to a foreign file URL', async () => {
    vi.mocked(tauriClient.workspaceAttachmentFileUrl).mockClear();
    vi.mocked(tauriClient.workspaceAttachmentFileUrl).mockResolvedValueOnce(
      'file:///data/user/0/org.opendataensemble.formulus/files/x.jpg',
    );
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(iframe, {
        type: 'getAttachmentUri',
        messageId: 'gaForeign',
        fileName: 'x.jpg',
      }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    const payload = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(payload.type).toBe('getAttachmentUri_response');
    expect(payload.result).toBeNull();
  });

  it('getAttachmentUri returns null for descriptor without filename', async () => {
    vi.mocked(tauriClient.workspaceAttachmentFileUrl).mockClear();
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(iframe, {
        type: 'getAttachmentUri',
        messageId: 'ga3',
        fileName: {
          uri: 'file:///ignored/stale.jpg',
        },
      }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(tauriClient.workspaceAttachmentFileUrl).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(postMessage.mock.calls[0][0] as string);
    expect(payload.type).toBe('getAttachmentUri_response');
    expect(payload.result).toBeNull();
  });

  it('ignores messages without messageId', async () => {
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      bridgeMessageFromIframe(iframe, {
        type: 'formplayerReadyToReceiveInit',
      }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(postMessage).not.toHaveBeenCalled();
  });

  it('legacy raw-only callers still reply using iframe.contentWindow fallback', async () => {
    const postMessage = vi.fn();
    const cw = { postMessage } as unknown as Window;
    const iframe = {
      contentWindow: cw,
    } as HTMLIFrameElement;

    await handleFormPreviewBridgeMessage(
      JSON.stringify({ type: 'getVersion', messageId: 'legacy1' }),
      {
        iframe,
        onFinalize: async () => ({ error: 'no' }),
      },
    );

    expect(postMessage).toHaveBeenCalledTimes(1);
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
