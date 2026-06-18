import { describe, expect, it, vi } from 'vitest';
import type { FormplayerEmbedHandle } from '../../components/FormplayerEmbed';
import {
  clearPendingSubObservationOpensForTests,
  deliverSubObservationCompletion,
  registerPendingSubObservationOpen,
} from '../formPreviewSubObservationBridge';

describe('formPreviewSubObservationBridge', () => {
  it('delivers completion via parent embed handle and content window', () => {
    clearPendingSubObservationOpensForTests();
    const postMessage = vi.fn();
    const deliver = vi.fn();
    const parentWindow = { postMessage } as unknown as Window;
    const handle = {
      getIframe: () => ({ contentWindow: parentWindow }) as HTMLIFrameElement,
      deliverBridgeResponse: deliver,
    } satisfies FormplayerEmbedHandle;

    registerPendingSubObservationOpen({
      parentMessageId: 'msg-1',
      parentEmbed: handle,
      parentContentWindow: parentWindow,
      formType: 'child_form',
    });

    const ok = deliverSubObservationCompletion('msg-1', {
      status: 'form_submitted',
      formType: 'child_form',
      formData: { k: 'v' },
    });

    expect(ok).toBe(true);
    expect(deliver).toHaveBeenCalledWith('openFormplayer', 'msg-1', {
      result: {
        status: 'form_submitted',
        formType: 'child_form',
        formData: { k: 'v' },
      },
    });
    expect(postMessage).toHaveBeenCalled();
  });
});
