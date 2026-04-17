import { describe, expect, it } from 'vitest';
import { sanitizePortableAttachmentsInFormData } from '../sanitizeFormSavedData';

describe('sanitizePortableAttachmentsInFormData', () => {
  it('removes uri/url and reduces path-like filename to basename', () => {
    const out = sanitizePortableAttachmentsInFormData({
      photo: {
        id: '8d89369e-260b-4816-85af-b03418f6bc7b',
        filename:
          'file:///data/user/0/org.opendataensemble.formulus/files/attachments/synced/8d89369e-260b-4816-85af-b03418f6bc7b.jpg',
        uri: 'file:///data/user/0/org.opendataensemble.formulus/files/attachments/synced/8d89369e-260b-4816-85af-b03418f6bc7b.jpg',
        metadata: { width: 1, height: 1 },
      },
    });
    expect(out.photo).toEqual({
      id: '8d89369e-260b-4816-85af-b03418f6bc7b',
      filename: '8d89369e-260b-4816-85af-b03418f6bc7b.jpg',
      metadata: { width: 1, height: 1 },
    });
  });

  it('does not strip arbitrary objects with filename-like keys', () => {
    const out = sanitizePortableAttachmentsInFormData({
      note: { filename: 'readme', body: 'x' },
    });
    expect(out).toEqual({ note: { filename: 'readme', body: 'x' } });
  });
});
