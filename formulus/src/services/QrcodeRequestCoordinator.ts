/**
 * Ensures at most one in-flight `requestQrcode` bridge call; settles on cancel.
 */

export type QrcodeBridgeResult = {
  fieldId?: string;
  status: string;
  message?: string;
  data?: unknown;
};

type ActiveRequest = {
  fieldId: string;
  resolve: (result: unknown) => void;
  settled: boolean;
};

export class QrcodeRequestCoordinator {
  private active: ActiveRequest | null = null;

  /** Start a QR request, or reject immediately if the scanner is already open. */
  request(fieldId: string): Promise<unknown> {
    if (this.active && !this.active.settled) {
      return Promise.resolve({
        fieldId,
        status: 'error',
        message: 'QR scanner is already open',
      } satisfies QrcodeBridgeResult);
    }

    return new Promise(resolve => {
      this.active = { fieldId, resolve, settled: false };
    });
  }

  /** Resolve the active request (idempotent). */
  settle(result: unknown): void {
    if (!this.active || this.active.settled) return;
    this.active.settled = true;
    const { resolve } = this.active;
    this.active = null;
    resolve(result);
  }

  /** Cancel the active request if it matches `fieldId` (or any if omitted). */
  cancel(fieldId?: string): void {
    if (!this.active || this.active.settled) return;
    if (fieldId && this.active.fieldId !== fieldId) return;

    this.settle({
      fieldId: this.active.fieldId,
      status: 'cancelled',
      message: 'QR scan cancelled',
    } satisfies QrcodeBridgeResult);
  }

  getActiveFieldId(): string | null {
    if (!this.active || this.active.settled) return null;
    return this.active.fieldId;
  }
}

export const qrcodeRequestCoordinator = new QrcodeRequestCoordinator();
