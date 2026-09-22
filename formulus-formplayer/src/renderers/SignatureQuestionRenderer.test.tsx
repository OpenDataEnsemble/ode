// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { JsonForms } from '@jsonforms/react';
import Ajv from 'ajv';
import SignatureQuestionRenderer, { signatureQuestionTester } from './SignatureQuestionRenderer';
import FormulusClient from '../services/FormulusInterface';

const ajv = new Ajv({ strict: false });
ajv.addFormat('signature', () => true);
const schema = { type: 'object', properties: { signature: { type: 'object', format: 'signature', title: 'Signature' } } };
const uischema = { type: 'Control', scope: '#/properties/signature' };
const renderers = [{ tester: signatureQuestionTester, renderer: SignatureQuestionRenderer }];
function Form({ value }: { value: Record<string, unknown> }) {
  return <JsonForms schema={schema} uischema={uischema} data={{ signature: value }} renderers={renderers} ajv={ajv} />;
}

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('signature profile-safe preview', () => {
  it('resolves a migrated legacy basename through the bridge without changing stored data', async () => {
    const value = { type: 'signature', filename: 'signature_123.png', uri: 'file:///old/Documents/signatures/signature_123.png' };
    const snapshot = { ...value };
    const resolve = vi.spyOn(FormulusClient.getInstance(), 'getAttachmentUri').mockResolvedValue('file:///docs/profiles/active/signatures/signature_123.png');
    render(<Form value={value} />);
    await waitFor(() => expect(screen.getByAltText('Signature')).toHaveAttribute('src', 'file:///docs/profiles/active/signatures/signature_123.png'));
    expect(resolve).toHaveBeenCalledWith('signature_123.png');
    expect(value).toEqual(snapshot);
  });

  it('keeps inline canvas signatures self-contained without calling the bridge', () => {
    const uri = 'data:image/png;base64,aGVsbG8=';
    const resolve = vi.spyOn(FormulusClient.getInstance(), 'getAttachmentUri');
    render(<Form value={{ type: 'signature', filename: 'canvas.png', uri }} />);
    expect(screen.getByAltText('Signature')).toHaveAttribute('src', uri);
    expect(resolve).not.toHaveBeenCalled();
  });

  it.each(['file:///docs/profiles/other/signatures/private.png', 'https://untrusted.example/signature.png', 'data:image/svg+xml;base64,PHN2Zz4='])('never uses the stored URI as a fallback: %s', async uri => {
    const resolve = vi.spyOn(FormulusClient.getInstance(), 'getAttachmentUri').mockResolvedValue(null);
    render(<Form value={{ type: 'signature', filename: 'missing.png', uri }} />);
    await waitFor(() => expect(resolve).toHaveBeenCalledWith('missing.png'));
    expect(screen.queryByAltText('Signature')).toBeNull();
  });

  it('does not load a URI-only legacy object', () => {
    const resolve = vi.spyOn(FormulusClient.getInstance(), 'getAttachmentUri');
    render(<Form value={{ type: 'signature', uri: 'file:///arbitrary.png' }} />);
    expect(screen.queryByAltText('Signature')).toBeNull();
    expect(resolve).not.toHaveBeenCalled();
  });

  it('ignores stale resolution when another signature is shown', async () => {
    let finish!: (uri: string) => void;
    const first = new Promise<string>(resolve => { finish = resolve; });
    vi.spyOn(FormulusClient.getInstance(), 'getAttachmentUri').mockReturnValueOnce(first).mockResolvedValueOnce('file:///active/signatures/new.png');
    const view = render(<Form value={{ type: 'signature', filename: 'old.png', uri: 'file:///old.png' }} />);
    view.rerender(<Form value={{ type: 'signature', filename: 'new.png', uri: 'file:///old-root/new.png' }} />);
    await waitFor(() => expect(screen.getByAltText('Signature')).toHaveAttribute('src', 'file:///active/signatures/new.png'));
    await act(async () => { finish('file:///active/signatures/old.png'); });
    expect(screen.getByAltText('Signature')).toHaveAttribute('src', 'file:///active/signatures/new.png');
  });

  it('handles resolver errors without displaying the old file URI', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const resolve = vi.spyOn(FormulusClient.getInstance(), 'getAttachmentUri').mockRejectedValue(new Error('storage unavailable'));
    render(<Form value={{ type: 'signature', filename: 'old.png', uri: 'file:///old.png' }} />);
    await waitFor(() => expect(resolve).toHaveBeenCalled());
    expect(screen.queryByAltText('Signature')).toBeNull();
  });
});
