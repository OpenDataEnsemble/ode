/**
 * Persists last-submitted scalar field values for opt-in "sticky" controls.
 * Keyed by formType + formVersion + field path (JSON pointer segment).
 */

export interface StickyStore {
  [fieldPath: string]: unknown;
}

export class StickyService {
  private static instance: StickyService;
  private readonly STORAGE_KEY = 'formulus_sticky_fields';

  private constructor() {}

  static getInstance(): StickyService {
    if (!StickyService.instance) {
      StickyService.instance = new StickyService();
    }
    return StickyService.instance;
  }

  private storageKey(formType: string, formVersion?: string): string {
    return `${formType}::${formVersion ?? '0'}`;
  }

  private readAll(): Record<string, StickyStore> {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed !== null ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeAll(data: Record<string, StickyStore>): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('[StickyService] Failed to persist sticky values', e);
    }
  }

  getStickyValues(formType: string, formVersion?: string): StickyStore {
    const all = this.readAll();
    return all[this.storageKey(formType, formVersion)] ?? {};
  }

  saveStickyValues(
    formType: string,
    formVersion: string | undefined,
    values: StickyStore,
  ): void {
    if (!formType || Object.keys(values).length === 0) return;
    const all = this.readAll();
    const key = this.storageKey(formType, formVersion);
    all[key] = { ...(all[key] ?? {}), ...values };
    this.writeAll(all);
  }
}

export const stickyService = StickyService.getInstance();
