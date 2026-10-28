// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { JsonForms } from '@jsonforms/react';
import { materialRenderers } from '@jsonforms/material-renderers';
import Ajv from 'ajv';
import SwipeLayoutRenderer, { swipeLayoutTester } from './SwipeLayoutRenderer';
import SignatureQuestionRenderer, {
  signatureQuestionTester,
} from './SignatureQuestionRenderer';

const ajv = new Ajv({ strict: false });
ajv.addFormat('signature', () => true);

const schema = {
  type: 'object',
  properties: {
    signature: { type: 'object', format: 'signature', title: 'Signature' },
    after: { type: 'string', title: 'After note' },
  },
};

const uischema = {
  type: 'SwipeLayout',
  elements: [
    {
      type: 'VerticalLayout',
      elements: [
        { type: 'Label', text: 'Page one' },
        { type: 'Control', scope: '#/properties/signature' },
      ],
    },
    {
      type: 'VerticalLayout',
      elements: [
        { type: 'Label', text: 'Page two' },
        { type: 'Control', scope: '#/properties/after' },
      ],
    },
  ],
};

const renderers = [
  ...materialRenderers,
  { tester: swipeLayoutTester, renderer: SwipeLayoutRenderer },
  { tester: signatureQuestionTester, renderer: SignatureQuestionRenderer },
];

function swipeLeft(target: Element) {
  fireEvent.touchStart(target, { touches: [{ clientX: 300, clientY: 50 }] });
  fireEvent.touchMove(target, { touches: [{ clientX: 200, clientY: 52 }] });
  fireEvent.touchMove(target, { touches: [{ clientX: 40, clientY: 55 }] });
  fireEvent.touchEnd(target, { touches: [] });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('SwipeLayout page swipes', () => {
  function renderForm() {
    return render(
      <JsonForms
        schema={schema}
        uischema={uischema}
        data={{}}
        renderers={renderers}
        ajv={ajv}
      />,
    );
  }

  it('does not change page when the swipe starts on the signature canvas', async () => {
    const { container } = renderForm();
    expect(screen.getByText('Page one')).toBeInTheDocument();

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    swipeLeft(canvas!);

    await new Promise(resolve => setTimeout(resolve, 600));
    expect(screen.getByText('Page one')).toBeInTheDocument();
    expect(screen.queryByText('Page two')).not.toBeInTheDocument();
  });

  it('still changes page when the swipe starts elsewhere on the page', async () => {
    renderForm();
    swipeLeft(screen.getByText('Page one'));

    await waitFor(() =>
      expect(screen.getByText('Page two')).toBeInTheDocument(),
    );
  });
});
