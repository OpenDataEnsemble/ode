/**
 * DraftService.ts
 *
 * Service for managing form drafts in localStorage.
 * Handles saving, loading, and cleaning up partial form data.
 */

import { FormInitData } from './FormulusInterfaceDefinition';

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
}

/**
 * Service for managing form drafts
 */
export class DraftService {
  private static instance: DraftService;
  private readonly STORAGE_KEY = 'formulus_drafts';
  private readonly MAX_AGE_DAYS = 7;

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
  private generateDraftId(formType: string, observationId?: string | null): string {
    const base = observationId ? `${formType}_${observationId}` : formType;
    return `draft_${base}_${Date.now()}`;
  }

  /**
   * Get all drafts from localStorage
   */
  private getAllDrafts(): Draft[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];

      const drafts = JSON.parse(stored) as Draft[];
      // Convert date strings back to Date objects
      return drafts.map((draft) => ({
        ...draft,
        createdAt: new Date(draft.createdAt),
        updatedAt: new Date(draft.updatedAt),
      }));
    } catch (error) {
      console.error('Error loading drafts from localStorage:', error);
      return [];
    }
  }

  /**
   * Save all drafts to localStorage
   */
  private saveAllDrafts(drafts: Draft[]): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('Error saving drafts to localStorage:', error);
    }
  }

  /**
   * Clean up drafts older than MAX_AGE_DAYS
   */
  private cleanupOldDrafts(drafts: Draft[]): Draft[] {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.MAX_AGE_DAYS);

    const validDrafts = drafts.filter((draft) => draft.updatedAt > cutoffDate);
    const removedCount = drafts.length - validDrafts.length;

    if (removedCount > 0) {
      console.log(`DraftService: Cleaned up ${removedCount} old drafts`);
    }

    return validDrafts;
  }

  /**
   * Save or update a draft
   */
  public saveDraft(
    formType: string,
    data: Record<string, any>,
    formInitData?: FormInitData,
  ): string {
    const drafts = this.getAllDrafts();
    const now = new Date();

    // Look for existing draft for this form instance
    const existingIndex = drafts.findIndex(
      (draft) =>
        draft.formType === formType &&
        draft.observationId === (formInitData?.observationId || null),
    );

    let draftId: string;

    if (existingIndex >= 0) {
      // Update existing draft
      const existingDraft = drafts[existingIndex];
      draftId = existingDraft.id;
      drafts[existingIndex] = {
        ...existingDraft,
        data,
        updatedAt: now,
        params: formInitData?.params,
      };
      console.log(`DraftService: Updated existing draft ${draftId} for ${formType}`);
    } else {
      // Create new draft
      draftId = this.generateDraftId(formType, formInitData?.observationId);
      const newDraft: Draft = {
        id: draftId,
        formType,
        formVersion: formInitData?.formSchema?.version || undefined,
        data,
        createdAt: now,
        updatedAt: now,
        observationId: formInitData?.observationId || null,
        params: formInitData?.params,
      };
      drafts.push(newDraft);
      console.log(`DraftService: Created new draft ${draftId} for ${formType}`);
    }

    // Clean up old drafts and save
    const cleanedDrafts = this.cleanupOldDrafts(drafts);
    this.saveAllDrafts(cleanedDrafts);

    return draftId;
  }

  /**
   * Get drafts for a specific form type
   */
  public getDraftsForForm(formType: string, formVersion?: string): DraftSummary[] {
    const drafts = this.getAllDrafts();
    const cleanedDrafts = this.cleanupOldDrafts(drafts);

    // Save cleaned drafts back to storage
    if (cleanedDrafts.length !== drafts.length) {
      this.saveAllDrafts(cleanedDrafts);
    }

    const formDrafts = cleanedDrafts.filter((draft) => {
      if (draft.formType !== formType) return false;

      // If formVersion is specified, only return drafts with matching version
      if (formVersion && draft.formVersion && draft.formVersion !== formVersion) {
        return false;
      }

      return true;
    });

    // Convert to summaries and sort by most recent first
    return formDrafts
      .map((draft) => ({
        id: draft.id,
        formType: draft.formType,
        formVersion: draft.formVersion,
        createdAt: draft.createdAt,
        updatedAt: draft.updatedAt,
        observationId: draft.observationId,
        dataPreview: this.generateDataPreview(draft.data),
      }))
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  /**
   * Get a specific draft by ID
   */
  public getDraft(draftId: string): Draft | null {
    const drafts = this.getAllDrafts();
    return drafts.find((draft) => draft.id === draftId) || null;
  }

  /**
   * Delete a specific draft
   */
  public deleteDraft(draftId: string): boolean {
    const drafts = this.getAllDrafts();
    const initialLength = drafts.length;
    const filteredDrafts = drafts.filter((draft) => draft.id !== draftId);

    if (filteredDrafts.length < initialLength) {
      this.saveAllDrafts(filteredDrafts);
      console.log(`DraftService: Deleted draft ${draftId}`);
      return true;
    }

    return false;
  }

  /**
   * Delete all drafts for a specific form instance (called when form is finalized)
   */
  public deleteDraftsForFormInstance(formType: string, observationId?: string | null): number {
    const drafts = this.getAllDrafts();
    const initialLength = drafts.length;

    const filteredDrafts = drafts.filter(
      (draft) => !(draft.formType === formType && draft.observationId === (observationId || null)),
    );

    const deletedCount = initialLength - filteredDrafts.length;

    if (deletedCount > 0) {
      this.saveAllDrafts(filteredDrafts);
      console.log(
        `DraftService: Deleted ${deletedCount} drafts for ${formType} (observationId: ${observationId})`,
      );
    }

    return deletedCount;
  }

  /**
   * Get count of drafts older than specified days
   */
  public getOldDraftCount(days: number = this.MAX_AGE_DAYS): number {
    const drafts = this.getAllDrafts();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return drafts.filter((draft) => draft.updatedAt <= cutoffDate).length;
  }

  /**
   * Manually clean up old drafts and return count of removed drafts
   */
  public cleanupOldDraftsManually(): number {
    const drafts = this.getAllDrafts();
    const cleanedDrafts = this.cleanupOldDrafts(drafts);
    const removedCount = drafts.length - cleanedDrafts.length;

    if (removedCount > 0) {
      this.saveAllDrafts(cleanedDrafts);
    }

    return removedCount;
  }

  /**
   * Generate a preview string from form data for display purposes
   */
  private generateDataPreview(data: Record<string, any>): string {
    const keys = Object.keys(data).filter((key) => {
      const value = data[key];
      return value !== null && value !== undefined && value !== '';
    });

    if (keys.length === 0) return 'No data entered';

    // Try to find meaningful fields for preview
    const meaningfulKeys = keys
      .filter(
        (key) =>
          !key.startsWith('_') && // Skip internal fields
          (typeof data[key] === 'string' || typeof data[key] === 'number'),
      )
      .slice(0, 3); // Take first 3 meaningful fields

    if (meaningfulKeys.length === 0) {
      return `${keys.length} field${keys.length === 1 ? '' : 's'} filled`;
    }

    const previews = meaningfulKeys.map((key) => {
      const value = data[key];
      const truncated =
        String(value).length > 30 ? String(value).substring(0, 30) + '...' : String(value);
      return `${key}: ${truncated}`;
    });

    return previews.join(', ');
  }

  /**
   * Get total number of drafts
   */
  public getTotalDraftCount(): number {
    return this.getAllDrafts().length;
  }

  /**
   * Clear all drafts (for testing/debugging)
   */
  public clearAllDrafts(): void {
    localStorage.removeItem(this.STORAGE_KEY);
    console.log('DraftService: Cleared all drafts');
  }
}

// Export singleton instance
export const draftService = DraftService.getInstance();
