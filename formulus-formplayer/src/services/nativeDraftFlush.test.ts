import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

// Execute the actual private request emitted by the native modal, without loading RN.
const modal = ts.createSourceFile(
  'FormplayerModal.tsx',
  fs.readFileSync(
    new URL(
      '../../../formulus/src/components/FormplayerModal.tsx',
      import.meta.url,
    ),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let script = '';
function visit(node: ts.Node) {
  if (
    ts.isTemplateExpression(node) &&
    node.getText(modal).includes("type: '__odeDraftFlushed'")
  ) {
    script =
      node.head.text +
      node.templateSpans
        .map(span => JSON.stringify('test-flush-id') + span.literal.text)
        .join('');
    return;
  }
  ts.forEachChild(node, visit);
}
visit(modal);

async function run(flush?: () => Promise<void> | void) {
  const messages: Array<{ type: string; messageId: string; error?: string }> =
    [];
  const context = vm.createContext({
    window: {
      __formulusFlushDraft: flush,
      ReactNativeWebView: {
        postMessage: (raw: string) => messages.push(JSON.parse(raw)),
      },
    },
  });
  expect(script).toContain('__odeDraftFlushed');
  vm.runInContext(script, context);
  await new Promise(resolve => setTimeout(resolve, 0));
  return messages;
}

describe('native flushDraftAsync private acknowledgement', () => {
  it('acknowledges only after Formplayer refresh/save resolves', async () => {
    let saved = false;
    let finish!: () => void;
    const pending = new Promise<void>(resolve => {
      finish = resolve;
    });
    const messages = await run(async () => {
      await pending;
      saved = true;
    });
    expect(messages).toEqual([]);
    expect(saved).toBe(false);
    finish();
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(saved).toBe(true);
    expect(messages).toEqual([
      { type: '__odeDraftFlushed', messageId: 'test-flush-id' },
    ]);
  });

  it('reports storage errors rather than success', async () => {
    const messages = await run(async () => {
      throw new Error('quota exceeded');
    });
    expect(messages).toEqual([
      {
        type: '__odeDraftFlushed',
        messageId: 'test-flush-id',
        error: 'Error: quota exceeded',
      },
    ]);
  });

  it('rejects unavailable/old Formplayer rather than acknowledging a no-op', async () => {
    const messages = await run();
    expect(messages[0].error).toContain('flush is unavailable');
    const oldFormplayer = await run(() => {});
    expect(oldFormplayer[0].error).toContain('flush is unavailable');
  });
});
