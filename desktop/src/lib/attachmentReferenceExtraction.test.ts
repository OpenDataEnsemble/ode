import { describe, expect, it } from 'vitest';
import {
  collectAttachmentPathsFromSchema,
  referencedAttachmentNamesFromSchemaAndData,
  referencedAttachmentNamesHeuristic,
  stringLooksLikeAttachmentRef,
} from './attachmentReferenceExtraction';

describe('collectAttachmentPathsFromSchema', () => {
  it('collects paths for attachment formats under properties', () => {
    const schema = {
      type: 'object',
      properties: {
        pic: { type: 'object', format: 'photo' },
        title: { type: 'string' },
      },
    };
    const paths = collectAttachmentPathsFromSchema(schema);
    expect(paths.map(p => p.segments)).toContainEqual(['pic']);
  });

  it('collects array item paths for attachment items', () => {
    const schema = {
      type: 'object',
      properties: {
        shots: {
          type: 'array',
          items: { type: 'object', format: 'photo' },
        },
      },
    };
    const paths = collectAttachmentPathsFromSchema(schema);
    expect(paths.map(p => p.segments)).toContainEqual(['shots', '*']);
  });

  it('resolves local $ref before properties', () => {
    const schema = {
      definitions: {
        snap: { type: 'object', format: 'photo' },
      },
      type: 'object',
      properties: {
        p: { $ref: '#/definitions/snap' },
      },
    };
    const paths = collectAttachmentPathsFromSchema(schema);
    expect(paths.map(p => p.segments)).toContainEqual(['p']);
  });
});

describe('referencedAttachmentNamesFromSchemaAndData', () => {
  it('extracts basename from nested filename', () => {
    const schema = {
      type: 'object',
      properties: {
        pic: { type: 'object', format: 'photo' },
      },
    };
    const names = referencedAttachmentNamesFromSchemaAndData(schema, {
      pic: { filename: 'C:/fake/path/face.png' },
    });
    expect([...names]).toEqual(['face.png']);
  });

  it('ignores MIME types and sentinels nested in attachment objects', () => {
    const schema = {
      type: 'object',
      properties: {
        pic: { type: 'object', format: 'photo' },
      },
    };
    const names = referencedAttachmentNamesFromSchemaAndData(schema, {
      pic: {
        type: 'image',
        filename: 'real.jpg',
        mimeType: 'image/jpeg',
        mask: '*',
      },
    });
    expect([...names].sort()).toEqual(['real.jpg']);
  });
});

describe('stringLooksLikeAttachmentRef', () => {
  it('rejects MIME type strings', () => {
    expect(stringLooksLikeAttachmentRef('image/jpeg')).toBe(false);
    expect(stringLooksLikeAttachmentRef('image/jpg')).toBe(false);
  });

  it('rejects lone *', () => {
    expect(stringLooksLikeAttachmentRef('*')).toBe(false);
  });

  it('accepts plausible file paths and names', () => {
    expect(stringLooksLikeAttachmentRef('photo.jpg')).toBe(true);
    expect(stringLooksLikeAttachmentRef('C:/x/photo.jpg')).toBe(true);
  });
});

describe('referencedAttachmentNamesHeuristic', () => {
  it('finds attachmentId and attachments array entries', () => {
    const names = referencedAttachmentNamesHeuristic({
      attachmentId: 'blob-uuid/file.pdf',
      attachments: [{ attachment_id: 'other.png' }],
    });
    expect(names.has('file.pdf')).toBe(true);
    expect(names.has('other.png')).toBe(true);
  });
});
