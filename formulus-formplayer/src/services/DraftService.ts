/**
 * DraftService.ts
 *
 * Service for managing form drafts in profile-scoped localStorage.
 *
 * Storage layout (all keys live inside the profile's formplayer namespace):
 * - `drafts_index_v2`: small JSON array of draft metadata (no form data)
 * - `draft_v2:<id>`: one entry per draft holding its data and params
 *
 * Older builds kept every draft in a single `formulus_drafts` array. That blob
 * is migrated on first access. Keeping drafts in separate entries means a
 * single large draft cannot block saving every other draft, and listing drafts
 * no longer parses all form data.
 *
 * Drafts not edited for {@link DEFAULT_DRAFT_MAX_AGE_DAYS} days are removed by
 * {@link DraftService.cleanupExpiredDrafts}.
 */

import { FormInitData } from '../types/FormulusInterfaceDefinition';
import { formplayerStorage, isQuotaError } from './ProfileStorage';
import { resolveFormSchemaVersion } from '../utils/formSchemaVersion';

/** Drafts not edited for this many days are removed automatically. */
export const DEFAULT_DRAFT_MAX_AGE_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Interface for a saved draft
 */
export interface Draft {
  /** Unique identifier for the draft */
  id: string;
  /** Form type (e.g., 'form1') */
  formType: string;
  /** Form version for compatibility checking */
  formVersion?: string;
  /** The partial form data */
  data: Record<string, any>;
  /** When the draft was created */
  createdAt: Date;
  /** When the draft was last updated */
  updatedAt: Date;
  /** Optional observation ID if editing existing observation */
  observationId?: string | null;
  /**
   * Formplayer-only: distinguishes multiple unsaved drafts for the same formType
   * (not part of the native bridge).
   */
  draftSessionKey?: string | null;
  /** Optional form parameters */
  params?: Record<string, any>;
}

/**
 * Interface for draft summary (used in UI lists)
 */
export interface DraftSummary {
  id: string;
  formType: string;
  formVersion?: string;
  createdAt: Date;
  updatedAt: Date;
  observationId?: string | null;
  /** Preview of form data for display */
  dataPreview: string;
  draftSessionKey?: string | null;
  /**
   * True when the draft was saved with a different form version than the one
   * being opened. Such drafts are still listed so they can be resumed or deleted.
   */
  isOtherVersion: boolean;
  /** When the draft will be removed by age-based cleanup if not edited again. */
  expiresAt: Date;
}

export interface DraftCleanupOptions {
  /** Maximum age in days since the last edit. Defaults to 7. */
  maxAgeDays?: number;
  /** Reference time, for tests. Defaults to now. */
  now?: Date;
  /** Draft rows to keep regardless of age (e.g. the one being opened). */
  keep?: (draft: DraftMeta) => boolean;
}

/** Draft metadata kept in the index (everything except data and params). */
export type DraftMeta = Omit<Draft, 'data' | 'params'>;

interface StoredMeta {
  id: string;
  formType: string;
  formVersion?: string;
  createdAt: string;
  updatedAt: string;
  observationId?: string | null;
  draftSessionKey?: string | null;
}

interface StoredPayload {
  data: Record<string, any>;
  params?: Record<string, any>;
}

const toMeta = (stored: StoredMeta): DraftMeta => ({
  ...stored,
  createdAt: new Date(stored.createdAt),
  updatedAt: new Date(stored.updatedAt),
});

/** Corrupt dates are stored as '' (still invalid when read back) instead of throwing. */
const isoOrEmpty = (date: Date): string =>
  Number.isFinite(date.getTime()) ? date.toISOString() : '';

const toStoredMeta = (meta: DraftMeta): StoredMeta => ({
  id: meta.id,
  formType: meta.formType,
  formVersion: meta.formVersion,
  createdAt: isoOrEmpty(meta.createdAt),
  updatedAt: isoOrEmpty(meta.updatedAt),
  observationId: meta.observationId,
  draftSessionKey: meta.draftSessionKey,
});

/** Valid timestamp, or null for a missing/corrupt date. */
const timeOf = (date: Date): number | null => {
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
};

/**
 * Service for managing form drafts
 */
export class DraftService {
  private static instance: DraftService;
  /** Pre-v2 single-array storage, migrated on first access. */
  private readonly LEGACY_STORAGE_KEY = 'formulus_drafts';
  private readonly INDEX_KEY = 'drafts_index_v2';
  private readonly ITEM_PREFIX = 'draft_v2:';

  private constructor() {}

  /**
   * Get the singleton instance
   */
  public static getInstance(): DraftService {
    if (!DraftService.instance) {
      DraftService.instance = new DraftService();
    }
    return DraftService.instance;
  }

  /**
   * Generate a unique draft ID
   */
  private generateDraftId(
    formType: string,
    observationId: string | null | undefined,
    existing: DraftMeta[],
  ): string {
    const base = observationId ? `${formType}_${observationId}` : formType;
    const id = `draft_${base}_${Date.now()}`;
    // Each draft has its own storage entry, so IDs must never collide.
    let unique = id;
    for (let n = 1; existing.some(meta => meta.id === unique); n++) {
      unique = `${id}_${n}`;
    }
    return unique;
  }

  private itemKey(id: string): string {
    return `${this.ITEM_PREFIX}${id}`;
  }

  /** Legacy rows without a session key get a stable one so they can be resumed. */
  private normalize(meta: DraftMeta): DraftMeta {
    if (meta.observationId != null || meta.draftSessionKey) return meta;
    return { ...meta, draftSessionKey: `legacy_${meta.id}` };
  }

  /**
   * Move the pre-v2 `formulus_drafts` array into per-draft entries.
   *
   * New entries are written first and the blob removed afterwards. If that
   * hits the storage quota, the blob is removed before writing so the
   * migration never needs room for two copies. Any failure removes the new
   * entries and keeps (or restores) the blob, so the next access can retry.
   */
  private migrateLegacyBlob(): DraftMeta[] | null {
    const raw = formplayerStorage.getItem(this.LEGACY_STORAGE_KEY);
    if (raw === null) return null;

    const parsed = JSON.parse(raw) as Array<StoredMeta & StoredPayload>;
    const rows = Array.isArray(parsed) ? parsed : [];
    const metas = rows.map(row =>
      this.normalize(
        toMeta({
          id: row.id,
          formType: row.formType,
          formVersion: row.formVersion,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          observationId: row.observationId,
          draftSessionKey: row.draftSessionKey,
        }),
      ),
    );

    const writeAll = () => {
      const written: string[] = [];
      try {
        rows.forEach(row => {
          const payload: StoredPayload = { data: row.data ?? {} };
          if (row.params !== undefined) payload.params = row.params;
          formplayerStorage.setItem(
            this.itemKey(row.id),
            JSON.stringify(payload),
          );
          written.push(row.id);
        });
        this.writeIndex(metas);
      } catch (error) {
        formplayerStorage.removeItem(this.INDEX_KEY);
        written.forEach(id => formplayerStorage.removeItem(this.itemKey(id)));
        throw error;
      }
    };

    try {
      writeAll();
    } catch (error) {
      if (!isQuotaError(error)) throw error;
      formplayerStorage.removeItem(this.LEGACY_STORAGE_KEY);
      try {
        writeAll();
      } catch (retryError) {
        formplayerStorage.setItem(this.LEGACY_STORAGE_KEY, raw);
        throw retryError;
      }
    }
    formplayerStorage.removeItem(this.LEGACY_STORAGE_KEY);
    console.log(
      `DraftService: Migrated ${metas.length} draft(s) to v2 storage`,
    );
    return metas;
  }

  /**
   * Read draft metadata. Throws when storage cannot be read, so callers never
   * mistake a failed read for "no drafts".
   */
  private readIndex(): DraftMeta[] {
    try {
      const raw = formplayerStorage.getItem(this.INDEX_KEY);
      if (raw === null) return this.migrateLegacyBlob() ?? [];
      const stored = JSON.parse(raw) as StoredMeta[];
      return (Array.isArray(stored) ? stored : []).map(toMeta);
    } catch (error) {
      console.error('Error loading drafts from localStorage:', error);
      throw error;
    }
  }

  private writeIndex(metas: DraftMeta[]): void {
    formplayerStorage.setItem(
      this.INDEX_KEY,
      JSON.stringify(metas.map(toStoredMeta)),
    );
  }

  private readPayload(id: string): StoredPayload | null {
    const raw = formplayerStorage.getItem(this.itemKey(id));
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as StoredPayload;
    return { data: parsed?.data ?? {}, params: parsed?.params };
  }

  /** Remove index rows first, then their entries, so the index never points at missing data. */
  private removeDrafts(ids: string[]): void {
    if (ids.length === 0) return;
    const remove = new Set(ids);
    this.writeIndex(this.readIndex().filter(meta => !remove.has(meta.id)));
    ids.forEach(id => formplayerStorage.removeItem(this.itemKey(id)));
  }

  private draftMatches(
    draft: DraftMeta,
    formType: string,
    observationId: string | null,
    draftSessionKey: string | null,
  ): boolean {
    if (draft.formType !== formType) return false;
    if (observationId !== null) {
      return draft.observationId === observationId;
    }
    if (draft.observationId != null) return false;
    return (
      draftSessionKey != null &&
      draftSessionKey !== '' &&
      draft.draftSessionKey === draftSessionKey
    );
  }

  /**
   * Save or update a draft. Throws if storage rejects the write.
   * @param draftSessionKey — Formplayer-only; required when `observationId` is null (pass from App / FormContext).
   */
  public saveDraft(
    formType: string,
    data: Record<string, any>,
    formInitData?: FormInitData,
    draftSessionKey?: string | null,
  ): string {
    const metas = this.readIndex();
    const now = new Date();

    const observationId = formInitData?.observationId ?? null;
    const sessionKey =
      observationId === null ? (draftSessionKey ?? null) : null;

    if (observationId === null && (!sessionKey || sessionKey === '')) {
      console.warn(
        '[DraftService] saveDraft: missing draftSessionKey for new observation',
      );
      return '';
    }

    const payload: StoredPayload = { data, params: formInitData?.params };
    const existingIndex = metas.findIndex(meta =>
      this.draftMatches(
        this.normalize(meta),
        formType,
        observationId,
        sessionKey,
      ),
    );

    if (existingIndex >= 0) {
      const existing = this.normalize(metas[existingIndex]);
      formplayerStorage.setItem(
        this.itemKey(existing.id),
        JSON.stringify(payload),
      );
      metas[existingIndex] = {
        ...metas[existingIndex],
        updatedAt: now,
        draftSessionKey:
          observationId === null
            ? (sessionKey ?? existing.draftSessionKey)
            : metas[existingIndex].draftSessionKey,
      };
      this.writeIndex(metas);
      console.log(
        `DraftService: Updated existing draft ${existing.id} for ${formType}`,
      );
      return existing.id;
    }

    const draftId = this.generateDraftId(
      formType,
      formInitData?.observationId,
      metas,
    );
    formplayerStorage.setItem(this.itemKey(draftId), JSON.stringify(payload));
    try {
      this.writeIndex([
        ...metas,
        {
          id: draftId,
          formType,
          formVersion: resolveFormSchemaVersion(formInitData?.formSchema),
          createdAt: now,
          updatedAt: now,
          observationId,
          draftSessionKey: observationId === null ? sessionKey : null,
        },
      ]);
    } catch (error) {
      formplayerStorage.removeItem(this.itemKey(draftId));
      throw error;
    }
    console.log(`DraftService: Created new draft ${draftId} for ${formType}`);
    return draftId;
  }

  /**
   * Get drafts for a specific form type, most recent first.
   *
   * Drafts saved with another form version are included and flagged with
   * `isOtherVersion`, so users can still resume or delete them.
   */
  public getDraftsForForm(
    formType: string,
    formVersion?: string,
    maxAgeDays: number = DEFAULT_DRAFT_MAX_AGE_DAYS,
  ): DraftSummary[] {
    return this.readIndex()
      .filter(meta => meta.formType === formType)
      .map(raw => {
        const meta = this.normalize(raw);
        const payload = this.readPayload(meta.id);
        return {
          id: meta.id,
          formType: meta.formType,
          formVersion: meta.formVersion,
          createdAt: meta.createdAt,
          updatedAt: meta.updatedAt,
          observationId: meta.observationId,
          dataPreview: this.generateDataPreview(payload?.data ?? {}),
          draftSessionKey: meta.draftSessionKey,
          isOtherVersion: Boolean(
            formVersion && meta.formVersion && meta.formVersion !== formVersion,
          ),
          expiresAt: new Date(meta.updatedAt.getTime() + maxAgeDays * DAY_MS),
        };
      })
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get a specific draft by ID
   */
  public getDraft(draftId: string): Draft | null {
    const meta = this.readIndex().find(draft => draft.id === draftId);
    if (!meta) return null;
    const payload = this.readPayload(draftId);
    return {
      ...this.normalize(meta),
      data: payload?.data ?? {},
      params: payload?.params,
    };
  }

  /**
   * Delete a specific draft
   */
  public deleteDraft(draftId: string): boolean {
    if (!this.readIndex().some(draft => draft.id === draftId)) return false;
    this.removeDrafts([draftId]);
    console.log(`DraftService: Deleted draft ${draftId}`);
    return true;
  }

  /**
   * Delete draft(s) for an existing observation after successful submit.
   */
  public deleteDraftsForFormInstance(
    formType: string,
    observationId: string,
  ): number {
    const ids = this.readIndex()
      .filter(
        draft =>
          draft.formType === formType && draft.observationId === observationId,
      )
      .map(draft => draft.id);
    this.removeDrafts(ids);
    if (ids.length > 0) {
      console.log(
        `DraftService: Deleted ${ids.length} draft(s) for ${formType} (observationId: ${observationId})`,
      );
    }
    return ids.length;
  }

  /**
   * After successful submit of a *new* observation: remove only this session's draft row.
   */
  public deleteDraftForNewObservationSession(
    formType: string,
    draftSessionKey: string,
  ): number {
    const ids = this.readIndex()
      .map(meta => this.normalize(meta))
      .filter(
        draft =>
          draft.formType === formType &&
          (draft.observationId === null || draft.observationId === undefined) &&
          draft.draftSessionKey === draftSessionKey,
      )
      .map(draft => draft.id);
    this.removeDrafts(ids);
    if (ids.length > 0) {
      console.log(
        `DraftService: Deleted ${ids.length} draft(s) for ${formType} (new observation session)`,
      );
    }
    return ids.length;
  }

  /**
   * Remove drafts that have not been edited for `maxAgeDays`.
   *
   * Drafts with a missing date or a date in the future (e.g. a device clock
   * that was wrong when the draft was saved) are kept, as are any rows the
   * `keep` predicate selects. Returns the number of drafts removed.
   */
  public cleanupExpiredDrafts(options: DraftCleanupOptions = {}): number {
    const maxAgeDays = options.maxAgeDays ?? DEFAULT_DRAFT_MAX_AGE_DAYS;
    if (!(maxAgeDays > 0)) return 0;
    const now = (options.now ?? new Date()).getTime();
    const cutoff = now - maxAgeDays * DAY_MS;

    const ids = this.readIndex()
      .filter(meta => {
        const updated = timeOf(meta.updatedAt);
        if (updated === null || updated > now) return false;
        if (options.keep?.(meta)) return false;
        return updated <= cutoff;
      })
      .map(meta => meta.id);
    this.removeDrafts(ids);
    if (ids.length > 0) {
      console.log(`DraftService: Removed ${ids.length} expired draft(s)`);
    }
    return ids.length;
  }

  /**
   * Generate a preview string from form data for display purposes
   */
  private generateDataPreview(data: Record<string, any>): string {
    const keys = Object.keys(data).filter(key => {
      const value = data[key];
      return value !== null && value !== undefined && value !== '';
    });

    if (keys.length === 0) return 'No data entered';

    // Try to find meaningful fields for preview
    const meaningfulKeys = keys
      .filter(
        key =>
          !key.startsWith('_') && // Skip internal fields
          (typeof data[key] === 'string' || typeof data[key] === 'number'),
      )
      .slice(0, 3); // Take first 3 meaningful fields

    if (meaningfulKeys.length === 0) {
      return `${keys.length} field${keys.length === 1 ? '' : 's'} filled`;
    }

    const previews = meaningfulKeys.map(key => {
      const value = data[key];
      const truncated =
        String(value).length > 30
          ? String(value).substring(0, 30) + '...'
          : String(value);
      return `${key}: ${truncated}`;
    });

    return previews.join(', ');
  }

  /**
   * Get total number of drafts
   */
  public getTotalDraftCount(): number {
    return this.readIndex().length;
  }

  /**
   * Clear all drafts (for testing/debugging)
   */
  public clearAllDrafts(): void {
    const ids = this.readIndex().map(meta => meta.id);
    formplayerStorage.removeItem(this.INDEX_KEY);
    ids.forEach(id => formplayerStorage.removeItem(this.itemKey(id)));
    formplayerStorage.removeItem(this.LEGACY_STORAGE_KEY);
    console.log('DraftService: Cleared all drafts');
  }
}

// Export singleton instance
export const draftService = DraftService.getInstance();
