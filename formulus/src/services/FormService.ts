import { databaseService } from '../database/DatabaseService';
import {
  Observation,
  NewObservationInput,
  UpdateObservationInput,
} from '../database/models/Observation';
import RNFS from 'react-native-fs';

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

  private constructor() {
    console.log(
      'FormService: Instance created - use await getInstance() to access singleton instance',
    );
  }

  private async _initialize(): Promise<void> {
    console.log('FormService: Starting initialization...');
    try {
      const specs = await this.getFormspecsFromStorage();
      this.formSpecs = specs;
      console.log(
        `FormService: ${specs.length} form specs loaded successfully`,
      );
    } catch (error) {
      console.error(
        'Failed to load default form types during FormService construction:',
        error,
      );
      this.formSpecs = []; // Initialize with empty array if loading fails
    }
  }

  private async loadFormspec(
    formDir: RNFS.ReadDirItem,
  ): Promise<FormSpec | null> {
    if (!formDir.isDirectory()) {
      console.log('Skipping non-directory:', formDir.name);
      return null;
    }
    console.log('Loading form spec:', formDir.path);
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
        // Skip non-form directories (e.g. extensions/, .hidden)
        const formDirs = formSpecFolders.filter(
          f =>
            f.isDirectory() &&
            !f.name.startsWith('.') &&
            f.name !== 'extensions',
        );

        for (const formDir of formDirs) {
          if (seenIds.has(formDir.name)) continue;
          const spec = await this.loadFormspec(formDir);
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

      console.log(
        `FormService: Successfully loaded ${allFormSpecs.length} form specs`,
      );
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
      console.log('FormService: Starting initialization...');
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
    console.log('FormService: Invalidating cache and reloading form specs...');
    try {
      const specs = await this.getFormspecsFromStorage();
      this.formSpecs = specs;
      console.log(
        `FormService: Cache invalidated, ${specs.length} form specs reloaded`,
      );

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
    if (found) {
      console.log(
        'FormService: Found form spec for',
        id,
        'sending schema and uiSchema',
      );
    } else {
      console.warn('FormService: Form spec not found for', id);
      console.debug('FormService: Form specs:', this.formSpecs);
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

  /**
   * Get observations with optional WHERE clause filtering (for dynamic choice lists).
   * Filters by data.field = 'value' conditions. age_from_dob() is handled in formplayer.
   */
  public async getObservationsByQuery(options: {
    formType: string;
    isDraft?: boolean;
    includeDeleted?: boolean;
    whereClause?: string | null;
  }): Promise<Observation[]> {
    const localRepo = databaseService.getLocalRepo();
    let observations = await localRepo.getObservationsByFormType(
      options.formType,
    );

    if (options.whereClause && options.whereClause.trim()) {
      observations = this.filterObservationsByWhereClause(
        observations,
        options.whereClause,
      );
    }

    return observations;
  }

  /**
   * Filter observations by WHERE clause.
   * Supports both formats (for compatibility with builtinExtensions and queryHelpers):
   * - data.field = 'value' (builtinExtensions)
   * - json_extract(data, '$.field') = 'value' (queryHelpers / AnthroCollect)
   * Skips age_from_dob() conditions (handled in formplayer).
   */
  private filterObservationsByWhereClause(
    observations: Observation[],
    whereClause: string,
  ): Observation[] {
    type Cond = { field: string; operator: string; value: string };
    const conditions: Cond[] = [];

    // Pattern 1: data.field = 'value' or data.field != 'value' (builtinExtensions)
    const dataFieldRegex =
      /data\.(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*'([^']*)'|data\.(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*"([^"]*)"|data\.(\w+)\s*(=|!=|<>|>=|<=|>|<)\s*(\d+)/gi;
    let match;
    while ((match = dataFieldRegex.exec(whereClause)) !== null) {
      const field = match[1] || match[4] || match[7];
      const operator = (match[2] || match[5] || match[8]).replace(/<>/g, '!=');
      const value = (match[3] || match[6] || match[9] || '').replace(
        /''/g,
        "'",
      );
      if (field) conditions.push({ field, operator, value });
    }

    // Pattern 2: json_extract(data, '$.field') = 'value' (queryHelpers)
    const jsonExtractRegex =
      /json_extract\s*\(\s*data\s*,\s*'\$\.(\w+)'\s*\)\s*(=|!=|<>|>=|<=|>|<)\s*'([^']*)'|json_extract\s*\(\s*data\s*,\s*'\$\.(\w+)'\s*\)\s*(=|!=|<>|>=|<=|>|<)\s*"([^"]*)"|json_extract\s*\(\s*data\s*,\s*'\$\.(\w+)'\s*\)\s*(=|!=|<>|>=|<=|>|<)\s*(\d+)/gi;
    while ((match = jsonExtractRegex.exec(whereClause)) !== null) {
      const field = match[1] || match[4] || match[7];
      const operator = (match[2] || match[5] || match[8]).replace(/<>/g, '!=');
      const value = (match[3] || match[6] || match[9] || '').replace(
        /''/g,
        "'",
      );
      if (field) conditions.push({ field, operator, value });
    }

    if (conditions.length === 0) return observations;

    return observations.filter(obs => {
      for (const cond of conditions) {
        const obsValue = (obs.data as Record<string, unknown>)?.[cond.field];
        const numVal = Number(obsValue);
        const strVal = String(obsValue ?? '');
        const condNum = Number(cond.value);
        const isNumeric = !Number.isNaN(numVal) && !Number.isNaN(condNum);
        let matches: boolean;
        if (isNumeric) {
          switch (cond.operator) {
            case '=':
              matches = numVal === condNum;
              break;
            case '!=':
              matches = numVal !== condNum;
              break;
            case '>=':
              matches = numVal >= condNum;
              break;
            case '<=':
              matches = numVal <= condNum;
              break;
            case '>':
              matches = numVal > condNum;
              break;
            case '<':
              matches = numVal < condNum;
              break;
            default:
              matches = strVal === cond.value;
          }
        } else {
          switch (cond.operator) {
            case '=':
              matches = strVal === cond.value;
              break;
            case '!=':
              matches = strVal !== cond.value;
              break;
            default:
              matches = false;
          }
        }
        if (!matches) return false;
      }
      return true;
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

    console.debug('Observation input: ', input);
    if (input.formType === undefined) {
      throw new Error('Form type is required to save observation');
    }
    if (input.data === undefined) {
      throw new Error('Data is required to save observation');
    }
    console.log('Saving observation of type: ' + input.formType);
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

    console.debug('Observation update input: ', input);
    if (input.observationId === undefined) {
      throw new Error('Observation ID is required to update observation');
    }
    if (input.data === undefined) {
      throw new Error('Data is required to update observation');
    }
    console.log('Updating observation with ID: ' + input.observationId);
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
      console.log('=== DATABASE DEBUG INFO ===');

      // Get the local repository
      const localRepo = databaseService.getLocalRepo();
      if (!localRepo) {
        console.error('Repository not available');
        return;
      }

      // Log some test observations
      console.log('Creating test observations...');

      // Create a test observation with person form type
      const testId1 = await localRepo.saveObservation({
        formType: 'person',
        data: { test: 'data1' },
      });
      console.log('Created test observation 1:', testId1);

      // Create another test observation with a different form type
      const testId2 = await localRepo.saveObservation({
        formType: 'test_form',
        data: { test: 'data2' },
      });
      console.log('Created test observation 2:', testId2);

      console.log('=== END DEBUG INFO ===');
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
