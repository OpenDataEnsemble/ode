import { databaseService } from '../database';
import { Observation } from '../database/repositories/LocalRepoInterface';

/**
 * Interface representing a form type
 */
export interface FormType {
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
  private formTypes: FormType[] = [];
  
  private constructor() {
    // Initialize with some default form types
    // In a real implementation, these would likely be loaded from an API or local storage
    this.formTypes = [
      {
        id: 'person',
        name: 'Person',
        description: 'Form for collecting person information',
        schemaVersion: '1.0',
        schema: require('../webview/personschema.json'),
        uiSchema: require('../webview/personui.json')
      },
      // Add more form types as needed
    ];
  }
  
  /**
   * Get the singleton instance of the FormService
   */
  public static getInstance(): FormService {
    if (!FormService.instance) {
      FormService.instance = new FormService();
    }
    return FormService.instance;
  }
  
  /**
   * Get all available form types
   * @returns Array of form types
   */
  public getFormTypes(): FormType[] {
    // ===== BEGIN TEMPORARY CODE =====
    // This code will be removed once we have the sync implemented
    // It ensures we always have at least one form type available for testing
    if (this.formTypes.length === 0) {
      try {
        // Try to load the person schema and UI schema from the JSON files
        const personSchema = require('../webview/personschema.json');
        const personUiSchema = require('../webview/personui.json');
        const personData = require('../webview/personData.json');
        
        // Create a person form type
        const personFormType: FormType = {
          id: 'person',
          name: 'Person',
          description: 'Form for collecting person information',
          schemaVersion: '1.0',
          schema: personSchema,
          uiSchema: personUiSchema
        };
        
        // Add the person form type
        this.addFormType(personFormType);
        
        console.log('Temporary form type created:', personFormType.id);
      } catch (error) {
        console.error('Error creating temporary form type:', error);
      }
    }
    // ===== END TEMPORARY CODE =====
    
    return this.formTypes;
  }
  
  /**
   * Get a form type by its ID
   * @param id Form type ID
   * @returns Form type or undefined if not found
   */
  public getFormTypeById(id: string): FormType | undefined {
    return this.formTypes.find(formType => formType.id === id);
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
      const allFormTypes = this.getFormTypes();
      let allObservations: any[] = [];
      
      for (const formType of allFormTypes) {
        const observations = await localRepo.getObservationsByFormId(formType.id);
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
  public addFormType(formType: FormType): void {
    // Check if form type with same ID already exists
    const existingIndex = this.formTypes.findIndex(ft => ft.id === formType.id);
    
    if (existingIndex >= 0) {
      // Replace existing form type
      this.formTypes[existingIndex] = formType;
    } else {
      // Add new form type
      this.formTypes.push(formType);
    }
  }
  
  /**
   * Remove a form type
   * @param id Form type ID to remove
   * @returns True if form type was removed, false otherwise
   */
  public removeFormType(id: string): boolean {
    const initialLength = this.formTypes.length;
    this.formTypes = this.formTypes.filter(formType => formType.id !== id);
    return this.formTypes.length < initialLength;
  }

}
