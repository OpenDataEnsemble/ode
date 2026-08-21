import { databaseService } from '../database/DatabaseService';
import {
  Observation,
  NewObservationInput,
  UpdateObservationInput,
} from '../database/models/Observation';
import RNFS from 'react-native-fs';
import {
  resolveSharedChoiceRefs,
  SHARED_CHOICE_SCHEMA_ID,
  type SharedChoiceSchemaDoc,
} from '../utils/sharedChoiceSchema';
import { logger } from '../diagnostics/logger';
import type {
  ObservationListPage,
  ObservationListQuery,
} from '../database/observationListQuery';

/**
 * Interface representing a form type
 */
export interface FormSpec {
  id: string;
  name: string;
  description: string;
  schemaVersion: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: any;
  uiSchema: unknown;
}

/**
 * Service for managing form-related operations
 */
export class FormService {
  private static instance: FormService;
  private formSpecs: FormSpec[] = [];
  private static initializationPromise: Promise<void> | null = null;
  private cacheInvalidationCallbacks: Set<() => void> = new Set();
  private sharedChoiceSchemaByDir = new Map<
    string,
    SharedChoiceSchemaDoc | null
  >();

  private constructor() {}

  private async _initialize(): Promise<void> {
    try {
      const specs = await this.getFormspecsFromStorage();
      this.formSpecs = specs;
    } catch (error) {
      console.error(
        'Failed to load default form types during FormService construction:',
        error,
      );
      this.formSpecs = []; // Initialize with empty array if loading fails
    }
  }

  private async loadSharedChoiceSchema(
    formsDir: string,
  ): Promise<SharedChoiceSchemaDoc | null> {
    if (this.sharedChoiceSchemaByDir.has(formsDir)) {
      return this.sharedChoiceSchemaByDir.get(formsDir) ?? null;
    }
    const filePath = `${formsDir}/shared-choice-defs.schema.json`;
    try {
      const exists = await RNFS.exists(filePath);
      if (!exists) {
        this.sharedChoiceSchemaByDir.set(formsDir, null);
        return null;
      }
      const raw = await RNFS.readFile(filePath, 'utf8');
      const doc = JSON.parse(raw) as SharedChoiceSchemaDoc;
      if (!doc.$defs || typeof doc.$defs !== 'object') {
        console.warn(
          'FormService: shared-choice-defs.schema.json missing $defs',
        );
        this.sharedChoiceSchemaByDir.set(formsDir, null);
        return null;
      }
      if (!doc.$id) {
        doc.$id = SHARED_CHOICE_SCHEMA_ID;
      }
      this.sharedChoiceSchemaByDir.set(formsDir, doc);
      return doc;
    } catch (error) {
      console.warn(
        'FormService: failed to load shared-choice-defs.schema.json',
        error,
      );
      this.sharedChoiceSchemaByDir.set(formsDir, null);
      return null;
    }
  }

  private async loadFormspec(
    formDir: RNFS.ReadDirItem,
    formsParentDir: string,
  ): Promise<FormSpec | null> {
    if (!formDir.isDirectory()) {
      return null;
    }
    let schema: unknown;
    try {
      const filePath = formDir.path + '/schema.json';
      const fileContent = await RNFS.readFile(filePath, 'utf8');
      schema = JSON.parse(fileContent);
    } catch (error) {
      console.error(
        'Failed to load schema for form spec:',
        formDir.name,
        error,
      );
      return null;
    }

    const sharedChoice = await this.loadSharedChoiceSchema(formsParentDir);
    if (sharedChoice && schema && typeof schema === 'object') {
      try {
        schema = resolveSharedChoiceRefs(
          schema as Record<string, unknown>,
          sharedChoice,
        );
      } catch (resolveError) {
        console.error(
          'Failed to resolve shared choice refs for form:',
          formDir.name,
          resolveError,
        );
        return null;
      }
    }
    let uiSchema: unknown;
    try {
      const uiSchemaPath = formDir.path + '/ui.json';
      const uiSchemaContent = await RNFS.readFile(uiSchemaPath, 'utf8');
      uiSchema = JSON.parse(uiSchemaContent);
    } catch (error) {
      console.error(
        'Failed to load uiSchema for form spec:',
        formDir.name,
        error,
      );
      return null;
    }
    return {
      id: formDir.name,
      name: formDir.name,
      description: 'Form for collecting ' + formDir.name + ' observations',
      schemaVersion: '1.0', //TODO: Fix this
      schema: schema,
      uiSchema: uiSchema,
    };
  }

  private async getFormspecsFromStorage(): Promise<FormSpec[]> {
    try {
      // Support both bundle structures:
      // - Root-level forms/ (e.g. ODE testdata)
      // - app/forms/ (e.g. AnthroCollect bundles)
      const formsDirs = [
        RNFS.DocumentDirectoryPath + '/forms',
        RNFS.DocumentDirectoryPath + '/app/forms',
      ];

      const allFormSpecs: FormSpec[] = [];
      const seenIds = new Set<string>();

      for (const formSpecsDir of formsDirs) {
        const dirExists = await RNFS.exists(formSpecsDir);
        if (!dirExists) {
          continue;
        }

        const formSpecFolders = await RNFS.readDir(formSpecsDir);
        // Skip non-form directories (e.g. extensions/, question_types/, .hidden, temp_*)
        const formDirs = formSpecFolders.filter(
          f =>
            f.isDirectory() &&
            !f.name.startsWith('.') &&
            !f.name.startsWith('temp_') &&
            f.name !== 'extensions' &&
            f.name !== 'question_types',
        );

        for (const formDir of formDirs) {
          if (seenIds.has(formDir.name)) continue;
          const spec = await this.loadFormspec(formDir, formSpecsDir);
          if (spec) {
            allFormSpecs.push(spec);
            seenIds.add(spec.id);
          }
        }
      }

      // Ensure root forms dir exists for future downloads
      const rootFormsDir = RNFS.DocumentDirectoryPath + '/forms';
      const rootExists = await RNFS.exists(rootFormsDir);
      if (!rootExists) {
        await RNFS.mkdir(rootFormsDir);
      }

      return allFormSpecs;
    } catch (error) {
      console.error(
        'FormService: Failed to load form types from storage:',
        error,
      );
      return [];
    }
  }

  /**
   * Get the singleton instance of the FormService
   * @returns Promise that resolves with the FormService instance
   */
  public static async getInstance(): Promise<FormService> {
    if (!FormService.instance) {
      FormService.instance = new FormService();
    }

    if (!FormService.initializationPromise) {
      FormService.initializationPromise = FormService.instance
        ._initialize()
        .catch(error => {
          // Reset initializationPromise on error to allow retry
          FormService.initializationPromise = null;
          throw error;
        });
    }

    await FormService.initializationPromise;
    return FormService.instance;
  }

  /**
   * Get all available form types
   * @returns Array of form types
   */
  public getFormSpecs(): FormSpec[] {
    return this.formSpecs;
  }

  /**
   * Subscribe to cache invalidation events
   * @param callback Function to call when cache is invalidated
   * @returns Unsubscribe function
   */
  public onCacheInvalidated(callback: () => void): () => void {
    this.cacheInvalidationCallbacks.add(callback);
    return () => this.cacheInvalidationCallbacks.delete(callback);
  }

  /**
   * Invalidate the form specs cache and reload from storage
   * This should be called after app bundle updates
   */
  public async invalidateCache(): Promise<void> {
    try {
      const specs = await this.getFormspecsFromStorage();
      this.formSpecs = specs;

      // Notify all subscribers that cache has been invalidated
      this.cacheInvalidationCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error(
            'FormService: Error in cache invalidation callback:',
            error,
          );
        }
      });
    } catch (error) {
      console.error(
        'FormService: Failed to reload form specs after cache invalidation:',
        error,
      );
      throw error;
    }
  }

  /**
   * Get a form type by its ID
   * @param id Form type ID
   * @returns Form type or undefined if not found
   */
  public getFormSpecById(id: string): FormSpec | undefined {
    const found = this.formSpecs.find(formSpec => formSpec.id === id);
    if (!found) {
      console.warn('FormService: Form spec not found for', id);
    }
    return found;
  }

  /**
   * Get observations for a specific form type
   * @param formTypeId ID of the form type
   * @returns Array of observations
   */
  public async getObservationsByFormType(
    formTypeId: string,
  ): Promise<Observation[]> {
    const localRepo = databaseService.getLocalRepo();
    return await localRepo.getObservationsByFormType(formTypeId);
  }

  public async getActiveObservations(): Promise<Observation[]> {
    const localRepo = databaseService.getLocalRepo();
    return localRepo.getActiveObservations();
  }

  public async getObservation(
    observationId: string,
  ): Promise<Observation | null> {
    const localRepo = databaseService.getLocalRepo();
    return localRepo.getObservation(observationId);
  }

  public async listObservationsPage(
    query: ObservationListQuery,
  ): Promise<ObservationListPage> {
    const localRepo = databaseService.getLocalRepo();
    return localRepo.listObservationsPage(query);
  }

  /**
   * Get observations with optional WHERE clause filtering (for dynamic choice lists).
   * Filters by data.field = 'value' conditions. age_from_dob() is handled in formplayer.
   */
  public async getObservationsByQuery(options: {
    formType: string;
    isDraft?: boolean;
    includeDeleted?: boolean;
    filter?: import('@ode/observation-query').ObservationFilter;
    /** @deprecated Use structured `filter` instead */
    whereClause?: string | null;
  }): Promise<Observation[]> {
    const localRepo = databaseService.getLocalRepo();

    if (options.filter) {
      return localRepo.queryObservations({
        formType: options.formType,
        includeDeleted: options.includeDeleted,
        filter: options.filter,
      });
    }

    if (options.whereClause?.trim()) {
      console.warn(
        '[FormService] whereClause is deprecated; migrate to structured filter',
      );
    }

    return localRepo.queryObservations({
      formType: options.formType,
      includeDeleted: options.includeDeleted,
    });
  }

  /**
   * Delete an observation by its ID
   * @param observationId ID of the observation to delete
   * @returns Promise that resolves when the observation is deleted
   */
  public async deleteObservation(observationId: string): Promise<void> {
    const localRepo = databaseService.getLocalRepo();
    await localRepo.deleteObservation(observationId);
  }

  /**
   * Add a new observation to the database
   * @param formType The form type identifier
   * @param data The observation data
   * @returns Promise that resolves to the ID of the saved observation
   */
  public async addNewObservation(
    formType: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const input: NewObservationInput = {
      formType,
      data,
      formVersion: '1.0', // Default version
    };

    if (input.formType === undefined) {
      throw new Error('Form type is required to save observation');
    }
    if (input.data === undefined) {
      throw new Error('Data is required to save observation');
    }
    logger.info('forms', 'saving observation', { formType });
    const localRepo = databaseService.getLocalRepo();
    return await localRepo.saveObservation(input);
  }

  /**
   * Update an existing observation
   * @param observationId The ID of the observation to update
   * @param data The new observation data
   * @returns Promise that resolves to the ID of the updated observation
   */
  public async updateObservation(
    observationId: string,
    data: Record<string, unknown>,
  ): Promise<string> {
    const input: UpdateObservationInput = {
      observationId: observationId,
      data,
    };

    if (input.observationId === undefined) {
      throw new Error('Observation ID is required to update observation');
    }
    if (input.data === undefined) {
      throw new Error('Data is required to update observation');
    }
    const localRepo = databaseService.getLocalRepo();
    await localRepo.updateObservation(input);
    return input.observationId;
  }

  /**
   * Debug the database schema and migrations
   * This is a diagnostic function to help troubleshoot database issues
   */
  public async debugDatabase(): Promise<void> {
    try {
      // Get the local repository
      const localRepo = databaseService.getLocalRepo();
      if (!localRepo) {
        console.error('Repository not available');
        return;
      }

      // Log some test observations

      // Create a test observation with person form type
      await localRepo.saveObservation({
        formType: 'person',
        data: { test: 'data1' },
      });

      await localRepo.saveObservation({
        formType: 'test_form',
        data: { test: 'data2' },
      });
    } catch (error) {
      console.error('Error debugging database:', error);
    }
  }

  /**
   * Add a new form type
   * @param formType Form type to add
   */
  public addFormSpec(formSpec: FormSpec): void {
    // Check if form type with same ID already exists
    const existingIndex = this.formSpecs.findIndex(ft => ft.id === formSpec.id);

    if (existingIndex >= 0) {
      // Replace existing form type
      this.formSpecs[existingIndex] = formSpec;
    } else {
      // Add new form type
      this.formSpecs.push(formSpec);
    }
  }

  /**
   * Remove a form type
   * @param id Form type ID to remove
   * @returns True if form type was removed, false otherwise
   */
  public removeFormSpec(id: string): boolean {
    const initialLength = this.formSpecs.length;
    this.formSpecs = this.formSpecs.filter(formSpec => formSpec.id !== id);
    return this.formSpecs.length < initialLength;
  }
}
