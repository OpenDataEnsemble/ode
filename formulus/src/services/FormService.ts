import { databaseService } from '../database';
import { Observation } from '../database/repositories/LocalRepoInterface';
import RNFS from 'react-native-fs';

/**
 * Interface representing a form type
 */
export interface FormSpec {
  id: string;
  name: string;
  description: string;
  schemaVersion: string;
  schema: any;
  uiSchema: any;
}

/**
 * Service for managing form-related operations
 */
export class FormService {
  private static instance: FormService;
  private formSpecs: FormSpec[] = [];
  private static initializationPromise: Promise<void> | null = null;
  
  private constructor() {
    console.log('FormService: Instance created - use await getInstance() to access singleton instance');
  }

  private async _initialize(): Promise<void> {
    console.log('FormService: Starting initialization...');
    try {
      const specs = await this.getFormspecsFromStorage();
      this.formSpecs = specs;
      console.log(`FormService: ${specs.length} form specs loaded successfully`);
    } catch (error) {
      console.error('Failed to load default form types during FormService construction:', error);
      this.formSpecs = []; // Initialize with empty array if loading fails
    }
  }

  private async loadFormspec(formDir: RNFS.ReadDirItem): Promise<FormSpec | null> {
    if (!formDir.isDirectory()) {
      console.log('Skipping non-directory:', formDir.name);
      return null;
    }
    console.log('Loading form spec:', formDir.path);
    let schema: any;
    try {
      const filePath = formDir.path + '/schema.json';
      const fileContent = await RNFS.readFile(filePath, 'utf8');
      schema = JSON.parse(fileContent);
    } catch (error) {
      console.error('Failed to load schema for form spec:', formDir.name, error);
      return null;
    }
    let uiSchema: any;
    try {
      const uiSchemaPath = formDir.path + '/ui.json';
      const uiSchemaContent = await RNFS.readFile(uiSchemaPath, 'utf8');
      uiSchema = JSON.parse(uiSchemaContent);
    } catch (error) {
      console.error('Failed to load uiSchema for form spec:', formDir.name, error);
      return null;
    }
    return {
      id: formDir.name,
      name: formDir.name,
      description: 'Form for collecting ' + formDir.name + ' observations',
      schemaVersion: '1.0', //TODO: Fix this
      schema: schema,
      uiSchema: uiSchema
    };
  }

  private async getFormspecsFromStorage(): Promise<FormSpec[]> {
    try {
      const formSpecsDir = RNFS.DocumentDirectoryPath + '/forms';
      const formSpecFolders = await RNFS.readDir(formSpecsDir);
      console.log('FormSpec folders:', formSpecFolders.map(f => f.name));
      const formSpecs = await Promise.all(formSpecFolders.map(async formDir => {
        return this.loadFormspec(formDir);
      }));
      var errorCount = formSpecs.length !== formSpecFolders.length;
      if (errorCount) {
        console.warn(`${errorCount} form specs did not load correctly!`);
      }
      return formSpecs.filter((s): s is FormSpec => s !== null);
    } catch (error) {
      console.error('Failed to load form types from storage:', error);
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
      FormService.initializationPromise = FormService.instance._initialize().catch(error => {
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
   * Get a form type by its ID
   * @param id Form type ID
   * @returns Form type or undefined if not found
   */
  public getFormSpecById(id: string): FormSpec | undefined {
    const found = this.formSpecs.find(formSpec => formSpec.id === id);
    if (found) {
      console.log('FormService: Found form spec for', id, 'sending schema and uiSchema');
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
  public async getObservationsByFormType(formTypeId: string): Promise<Observation[]> {
    const localRepo = databaseService.getLocalRepo();
    return await localRepo.getObservationsByFormId(formTypeId);
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
   * Reset the database by deleting all observations
   * @returns Promise that resolves when the database is reset
   */
  public async resetDatabase(): Promise<void> {
    const localRepo = databaseService.getLocalRepo();
    if (!localRepo) {
      throw new Error('Database repository is not available');
    }
    
    try {
      // Get all observations across all form types
      const allFormSpecs = this.getFormSpecs();
      let allObservations: any[] = [];
      
      for (const formSpec of allFormSpecs) {
        const observations = await localRepo.getObservationsByFormId(formSpec.id);
        allObservations = [...allObservations, ...observations];
      }
      
      // Delete each observation
      for (const observation of allObservations) {
        await localRepo.deleteObservation(observation.id);
      }
      
      console.log(`Database reset complete. Deleted ${allObservations.length} observations.`);
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
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
      const testId1 = await localRepo.saveObservation({ formType: 'person', data: { test: 'data1' } });
      console.log('Created test observation 1:', testId1);
      
      // Create another test observation with a different form type
      const testId2 = await localRepo.saveObservation({ formType: 'test_form', data: { test: 'data2' } });
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
