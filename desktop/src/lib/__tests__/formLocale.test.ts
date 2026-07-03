import { describe, expect, it, vi, beforeEach } from 'vitest';
import { scanActiveBundleFormLocales } from '../formLocale';

vi.mock('../tauriClient', () => ({
  tauriClient: {
    listActiveBundleForms: vi.fn(),
    readBundleFormSpec: vi.fn(),
  },
}));

import { tauriClient } from '../tauriClient';

describe('scanActiveBundleFormLocales', () => {
  beforeEach(() => {
    vi.mocked(tauriClient.listActiveBundleForms).mockReset();
    vi.mocked(tauriClient.readBundleFormSpec).mockReset();
  });

  it('collects locales from uiSchema (camelCase from Tauri)', async () => {
    vi.mocked(tauriClient.listActiveBundleForms).mockResolvedValue([
      { formType: 'register_bean' },
    ]);
    vi.mocked(tauriClient.readBundleFormSpec).mockResolvedValue({
      formType: 'register_bean',
      formSchema: {},
      uiSchema: {
        translations: { it: { label: 'Registra' } },
        elements: [
          {
            type: 'Control',
            translations: { it: { label: 'Nome' } },
          },
        ],
      },
    });

    await expect(scanActiveBundleFormLocales()).resolves.toEqual(['it']);
  });
});
