import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  cleanup,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { FormPreviewPage } from './FormPreviewPage';
import { tauriClient } from '../lib/tauriClient';
import { save } from '@tauri-apps/plugin-dialog';
import type { FormplayerEmbedHandle } from '../components/FormplayerEmbed';
import type { FormInitData } from '../lib/formplayerHost';

vi.mock('../lib/tauriClient', () => ({
  tauriClient: {
    listActiveBundleForms: vi.fn(async () => [{ formType: 'demo' }]),
    readBundleFormSpec: vi.fn(),
    saveObservation: vi.fn(async () => ({})),
    getObservation: vi.fn(),
    writeTextFile: vi.fn(),
  },
}));
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(async () => '/tmp/export.json'),
}));
vi.mock('../hooks/useDeveloperMode', () => ({
  useDeveloperMode: () => ({ developerMode: false, devMirrorGeneration: 0 }),
}));
vi.mock('../lib/bundleExtensionLoader', () => ({
  loadBundleFormplayerExtensions: async () => ({}),
}));
vi.mock('../lib/formLocale', () => ({
  FORM_LOCALE_DEFAULT: 'default',
  getDesktopFormLocalePreference: () => 'default',
  scanActiveBundleFormLocales: async () => [],
  setDesktopFormLocalePreference: vi.fn(),
  resolveDesktopFormLocale: () => 'default',
}));
vi.mock('../components/FormPreviewAdvancedParamsDialog', () => ({
  FormPreviewAdvancedParamsDialog: () => null,
}));
vi.mock('../components/CustomAppDeviceViewport', () => ({
  CustomAppDeviceViewport: ({
    toolbarStart,
    children,
  }: {
    toolbarStart: React.ReactNode;
    children: (args: {
      fillFrame: boolean;
      devicePixelRatio: number;
    }) => React.ReactNode;
  }) => (
    <>
      {toolbarStart}
      {children({ fillFrame: true, devicePixelRatio: 1 })}
    </>
  ),
}));
vi.mock('../components/FormplayerEmbed', () => ({
  FormplayerEmbed: forwardRef<
    FormplayerEmbedHandle,
    { formInitData: FormInitData | null }
  >((props, ref) => {
    const iframe = useRef<HTMLIFrameElement>(null);
    useImperativeHandle(ref, () => ({
      getIframe: () => iframe.current,
      flushDraftAsync: async () => {},
      deliverBridgeResponse: () => {},
      notifyReceiveFocus: () => {},
    }));
    return (
      <iframe
        ref={iframe}
        title={props.formInitData ? 'opened-preview' : 'empty-preview'}
      />
    );
  }),
}));

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});

async function openPreview(
  schema: Record<string, unknown>,
  edit = false,
  beforeFinalize?: () => void,
) {
  vi.mocked(tauriClient.readBundleFormSpec).mockResolvedValue({
    formType: 'demo',
    formSchema: schema,
    uiSchema: {},
  });
  render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/',
          state: edit
            ? {
                formPreviewEdit: {
                  formType: 'demo',
                  observationId: 'old',
                  savedData: {},
                },
              }
            : undefined,
        },
      ]}>
      <FormPreviewPage />
    </MemoryRouter>,
  );
  if (!edit) {
    await waitFor(() =>
      expect(screen.getByLabelText('Form type')).not.toBeDisabled(),
    );
    fireEvent.change(screen.getByLabelText('Form type'), {
      target: { value: 'demo' },
    });
  }
  const iframe = (await screen.findByTitle(
    'opened-preview',
  )) as HTMLIFrameElement;
  beforeFinalize?.();
  await act(async () => {
    window.dispatchEvent(
      new MessageEvent('message', {
        source: iframe.contentWindow,
        data: JSON.stringify({
          type: edit ? 'updateObservation' : 'submitObservation',
          messageId: 'finalize',
          formType: 'demo',
          observationId: edit ? 'old' : undefined,
          finalData: { answer: 42 },
          formVersion: 'untrusted',
        }),
      }),
    );
  });
  await screen.findByRole('dialog');
}

it.each([
  [{ version: '3' }, '3'],
  [{}, '1.0'],
  [{ schemaVersion: '2' }, '2'],
])(
  'persists the opening preview version for %j',
  async (schema: Record<string, unknown>, expected) => {
    await openPreview(schema, false, () => {
      schema.schemaVersion = '3';
      vi.mocked(tauriClient.readBundleFormSpec).mockResolvedValue({
        formType: 'demo',
        formSchema: { version: '3' },
        uiSchema: {},
      });
    });
    // The finalize request also stays stable while the user chooses how to save.
    schema.schemaVersion = '9';
    fireEvent.click(screen.getByText('Save to database'));
    await waitFor(() =>
      expect(tauriClient.saveObservation).toHaveBeenCalledWith(
        expect.objectContaining({
          extras: { formVersion: expected, tags: ['Testdata'] },
        }),
      ),
    );
  },
);

it.each([false, true])(
  'exports resolved/new or preserved/edit formVersion (edit=%s)',
  async edit => {
    vi.mocked(tauriClient.getObservation).mockResolvedValue({
      id: 'old',
      payload: {},
      dirty: false,
      syncStatus: 'clean',
      hasConflictCopy: false,
      lastSavedAt: '',
      deleted: false,
      extras: {
        formVersion: '7',
        author: 'Alice',
        deviceId: 'device',
        tags: ['Original'],
      },
    });
    await openPreview({ schemaVersion: '9' }, edit);
    fireEvent.click(screen.getByText('Save as .json file'));
    await waitFor(() => expect(tauriClient.writeTextFile).toHaveBeenCalled());
    expect(save).toHaveBeenCalled();
    const envelope = JSON.parse(
      vi.mocked(tauriClient.writeTextFile).mock.calls[0][1],
    );
    expect(envelope.formVersion).toBe(edit ? '7' : '9');
  },
);

it('preserves original edit version and other extras while schema is newer', async () => {
  const extras = {
    formVersion: '7',
    author: 'Alice',
    deviceId: 'device',
    tags: ['Original'],
  };
  vi.mocked(tauriClient.getObservation).mockResolvedValue({
    id: 'old',
    payload: {},
    dirty: false,
    syncStatus: 'clean',
    hasConflictCopy: false,
    lastSavedAt: '',
    deleted: false,
    extras,
  });
  await openPreview({ schemaVersion: '9' }, true);
  fireEvent.click(screen.getByText('Save to database'));
  await waitFor(() =>
    expect(tauriClient.saveObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'old',
        extras: { ...extras, tags: ['Original', 'Testdata'] },
      }),
    ),
  );
});

it('binds same-form nested headless creates to their sender snapshots', async () => {
  vi.mocked(tauriClient.readBundleFormSpec).mockResolvedValue({
    formType: 'demo',
    formSchema: { schemaVersion: '1' },
    uiSchema: {},
  });
  render(
    <MemoryRouter>
      <FormPreviewPage />
    </MemoryRouter>,
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Form type')).not.toBeDisabled(),
  );
  fireEvent.change(screen.getByLabelText('Form type'), {
    target: { value: 'demo' },
  });
  const root = (await screen.findByTitle(
    'opened-preview',
  )) as HTMLIFrameElement;
  const rootWindow = root.contentWindow!;

  async function send(source: Window, data: Record<string, unknown>) {
    await act(async () => {
      window.dispatchEvent(
        new MessageEvent('message', { source, data: JSON.stringify(data) }),
      );
    });
  }

  async function openNested(
    source: Window,
    version: string,
    messageId: string,
    existing: HTMLIFrameElement[],
  ) {
    vi.mocked(tauriClient.readBundleFormSpec).mockResolvedValue({
      formType: 'child',
      formSchema: { schemaVersion: version },
      uiSchema: {},
    });
    await send(source, {
      type: 'openFormplayer',
      messageId,
      formType: 'child',
      options: { subObservationMode: true },
    });
    let iframe: HTMLIFrameElement | undefined;
    await waitFor(() => {
      iframe = (
        screen.getAllByTitle('opened-preview') as HTMLIFrameElement[]
      ).find(item => !existing.includes(item));
      expect(iframe).toBeDefined();
    });
    return iframe!;
  }

  const a = await openNested(rootWindow, '2', 'open-a', [root]);
  const aWindow = a.contentWindow!;
  const b = await openNested(aWindow, '3', 'open-b', [root, a]);
  const bWindow = b.contentWindow!;
  expect(aWindow).not.toBe(bWindow);
  expect(aWindow).not.toBe(rootWindow);
  vi.mocked(tauriClient.readBundleFormSpec).mockResolvedValue({
    formType: 'child',
    formSchema: { schemaVersion: '9' },
    uiSchema: {},
  });

  async function persist(
    source: Window,
    formType: string,
    marker: string,
    version: string,
  ) {
    await send(source, {
      type: 'persistObservation',
      messageId: marker,
      input: { formType, finalData: { marker } },
    });
    await waitFor(() =>
      expect(tauriClient.saveObservation).toHaveBeenLastCalledWith(
        expect.objectContaining({
          formType,
          payload: { marker },
          extras: { formVersion: version },
        }),
      ),
    );
  }

  await persist(aWindow, 'child', 'save-a', '2');
  await persist(bWindow, 'child', 'save-b', '3');
  // A root request for another form must read the host spec, not borrow a nested snapshot.
  await persist(rootWindow, 'child', 'save-other-form', '9');
  await persist(rootWindow, 'demo', 'save-root', '1');

  const saves = vi.mocked(tauriClient.saveObservation).mock.calls.length;
  await send(bWindow, {
    type: 'submitObservation',
    messageId: 'finalize-b',
    formType: 'child',
    finalData: {},
  });
  await waitFor(() =>
    expect(screen.getAllByTitle('opened-preview')).toHaveLength(2),
  );
  await send(aWindow, {
    type: 'submitObservation',
    messageId: 'finalize-a',
    formType: 'child',
    finalData: {},
  });
  await waitFor(() =>
    expect(screen.getAllByTitle('opened-preview')).toHaveLength(1),
  );
  expect(tauriClient.saveObservation).toHaveBeenCalledTimes(saves);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
