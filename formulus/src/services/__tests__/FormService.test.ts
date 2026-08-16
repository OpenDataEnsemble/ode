import { FormService as FormServiceType, FormSpec } from '../FormService';
import { Observation } from '../../database/repositories/LocalRepoInterface';

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/test/path',
  exists: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  readFile: jest.fn(),
  writeFile: jest.fn(),
  readDir: jest.fn(),
}));

function setupFormSpecsFromFsMocks() {
  const RNFS = require('react-native-fs');
  const formsPath = '/test/path/forms';
  RNFS.exists.mockImplementation(async (p: string) => p === formsPath);
  RNFS.readDir.mockImplementation(async (p: string) => {
    if (p === formsPath) {
      return [
        {
          name: 'person',
          path: `${formsPath}/person`,
          isDirectory: () => true,
        },
      ];
    }
    return [];
  });
  RNFS.readFile.mockImplementation(async (path: string) => {
    if (path.endsWith('/schema.json')) {
      return JSON.stringify({
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name'],
      });
    }
    if (path.endsWith('/ui.json')) {
      return JSON.stringify({
        elements: [
          { type: 'Control', scope: '#/properties/name' },
          { type: 'Control', scope: '#/properties/age' },
        ],
      });
    }
    return '{}';
  });
}

// Mock JSON schema files
jest.mock(
  '../../webview/personschema.json',
  () => ({
    type: 'object',
    properties: { name: { type: 'string' }, age: { type: 'number' } },
    required: ['name'],
  }),
  { virtual: true },
);

jest.mock(
  '../../webview/personui.json',
  () => ({
    elements: [
      { type: 'Control', scope: '#/properties/name' },
      { type: 'Control', scope: '#/properties/age' },
    ],
  }),
  { virtual: true },
);

// Mock personData.json for the temporary block in getFormTypes
jest.mock(
  '../../webview/personData.json',
  () => ({ name: 'Test Person', age: 30 }),
  { virtual: true },
);

// Mock databaseService and its LocalRepo
const mockGetObservationsByFormId = jest.fn();
const mockGetObservationsByFormType = jest.fn();
const mockQueryObservations = jest.fn();
const mockDeleteObservation = jest.fn();
const mockSaveObservation = jest.fn();
const mockGetObservationsCount = jest.fn(); // Assuming this might be useful or part of a fuller repo mock

// Must mock DatabaseService (not database/index): FormService imports DatabaseService,
// which would otherwise load database.ts and instantiate SQLiteAdapter (JSI) in Node.
jest.mock('../../database/DatabaseService', () => ({
  databaseService: {
    getLocalRepo: jest.fn(() => ({
      getObservationsByFormId: mockGetObservationsByFormId,
      getObservationsByFormType: mockGetObservationsByFormType,
      getObservation: jest.fn(),
      listObservationsPage: jest.fn(),
      queryObservations: mockQueryObservations,
      deleteObservation: mockDeleteObservation,
      saveObservation: mockSaveObservation,
      getObservationsCount: mockGetObservationsCount,
    })),
  },
}));

describe('FormService', () => {
  let formServiceInstance: FormServiceType;
  let ActualFormServiceClass: typeof FormServiceType;

  afterEach(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});

    // Reset modules to ensure a fresh instance of FormService for each test,
    // as it's a singleton and we are also resetting its internal state (formTypes) via API.
    jest.resetModules();
    setupFormSpecsFromFsMocks();
    // Re-require FormService after resetting modules to get the new instance and class
    const FormServiceModule = require('../FormService');
    ActualFormServiceClass = FormServiceModule.FormService; // Capture the fresh class
    formServiceInstance = await ActualFormServiceClass.getInstance(); // Use it to get instance

    // Clear all mock implementations and calls
    mockGetObservationsByFormId.mockClear();
    mockGetObservationsByFormType.mockClear();
    mockDeleteObservation.mockClear();
    mockSaveObservation.mockClear();
    mockGetObservationsCount.mockClear();

    // Ensure getLocalRepo itself is reset if its return value needs to change per test
    // (though here we consistently return the same set of mocks)
    const { databaseService } = require('../../database/DatabaseService');
    databaseService.getLocalRepo.mockClear();
  });

  describe('getInstance', () => {
    test('should return a FormService instance', () => {
      expect(formServiceInstance).toBeInstanceOf(ActualFormServiceClass);
    });

    test('should return the same instance on multiple calls', async () => {
      const instance1 = await ActualFormServiceClass.getInstance();
      const instance2 = await ActualFormServiceClass.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('constructor and getFormTypes (initial state)', () => {
    test('should initialize with a default "person" form type', () => {
      const formSpecs = formServiceInstance.getFormSpecs();
      expect(formSpecs.length).toBeGreaterThan(0);
      const personForm = formSpecs.find(ft => ft.id === 'person');
      expect(personForm).toBeDefined();
      expect(personForm?.name).toBe('person');
      expect(personForm?.schema).toEqual({
        type: 'object',
        properties: { name: { type: 'string' }, age: { type: 'number' } },
        required: ['name'],
      });
    });
  });

  describe('getFormSpecById', () => {
    test('should return the correct form type for a valid ID', () => {
      formServiceInstance.addFormSpec({
        id: 'person',
        name: 'Person',
        description: 'Form for collecting person information',
        schemaVersion: '1.0',
        schema: require('./personschema.json'),
        uiSchema: require('./personui.json'),
      });
      const formSpec = formServiceInstance.getFormSpecById('person');
      expect(formSpec).toBeDefined();
      expect(formSpec?.schema).toBeDefined();
      expect(formSpec?.uiSchema).toBeDefined();
      expect(formSpec?.id).toBe('person');
    });

    test('should return undefined for a non-existent ID', () => {
      const formSpec = formServiceInstance.getFormSpecById('nonexistent');
      expect(formSpec).toBeUndefined();
    });
  });

  describe('addFormSpec', () => {
    const newFormType: FormSpec = {
      id: 'testForm',
      name: 'Test Form',
      description: 'A test form',
      schemaVersion: '1.0',
      schema: { type: 'object', properties: { field: { type: 'string' } } },
      uiSchema: {
        elements: [{ type: 'Control', scope: '#/properties/field' }],
      },
    };

    test('should add a new form type', () => {
      formServiceInstance.addFormSpec(newFormType);
      const formSpecs = formServiceInstance.getFormSpecs();
      expect(formSpecs.find(ft => ft.id === 'testForm')).toEqual(newFormType);
      // The default 'person' form + the new 'testForm'
      // However, the temporary block in getFormSpecs might re-add 'person' if it was removed or if list was empty.
      // For simplicity, let's check that our new form is present and the count increased if 'person' was there.
      // A more robust test would clear all forms first if possible, or account for the temporary block logic.
      // Given the current structure, if 'person' is always there, length becomes 2.
      expect(formServiceInstance.getFormSpecs().length).toBe(2);
    });

    test('should update an existing form type if ID matches', () => {
      const updatedPersonForm: FormSpec = {
        id: 'person',
        name: 'Updated Person Form',
        description: 'Updated description',
        schemaVersion: '1.1',
        schema: {
          type: 'object',
          properties: { newField: { type: 'boolean' } },
        },
        uiSchema: { elements: [] },
      };
      formServiceInstance.addFormSpec(updatedPersonForm);
      const formSpec = formServiceInstance.getFormSpecById('person');
      expect(formSpec?.name).toBe('Updated Person Form');
      expect(formSpec?.schemaVersion).toBe('1.1');
      const formSpecs = formServiceInstance.getFormSpecs();
      expect(formSpecs.length).toBe(1); // Still only person, but updated
    });
  });

  describe('removeFormSpec', () => {
    // Assuming removeFormSpec is implemented in FormService.ts as:
    // public removeFormSpec(id: string): boolean {
    //   const initialLength = this.formSpecs.length;
    //   this.formSpecs = this.formSpecs.filter(fs => fs.id !== id);
    //   return this.formSpecs.length < initialLength;
    // }

    test('should remove an existing form type and return true', () => {
      const result = formServiceInstance.removeFormSpec('person');
      expect(result).toBe(true);
      expect(formServiceInstance.getFormSpecById('person')).toBeUndefined();
    });

    test('should return false if form type ID does not exist', () => {
      const initialLength = formServiceInstance.getFormSpecs().length;
      const result = formServiceInstance.removeFormSpec('nonexistent');
      expect(result).toBe(false);
      expect(formServiceInstance.getFormSpecs().length).toBe(initialLength);
    });
  });

  describe('getObservationsByFormType', () => {
    test('should call localRepo.getObservationsByFormType and return its result', async () => {
      const mockObservations: Observation[] = [
        {
          id: 'obs1',
          formType: 'person',
          data: {},
          observationId: 'obs1',
          formVersion: '1',
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncedAt: new Date(),
        },
      ];
      mockGetObservationsByFormType.mockResolvedValue(mockObservations);

      const result =
        await formServiceInstance.getObservationsByFormType('person');

      expect(mockGetObservationsByFormType).toHaveBeenCalledWith('person');
      expect(result).toEqual(mockObservations);
    });
  });

  describe('deleteObservation', () => {
    test('should call localRepo.deleteObservation', async () => {
      mockDeleteObservation.mockResolvedValue(undefined);
      await formServiceInstance.deleteObservation('obs1');
      expect(mockDeleteObservation).toHaveBeenCalledWith('obs1');
    });
  });

  describe('debugDatabase', () => {
    test('should call localRepo.saveObservation for test data', async () => {
      mockSaveObservation.mockResolvedValue('new_id');
      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await formServiceInstance.debugDatabase();

      expect(mockSaveObservation).toHaveBeenCalledWith({
        formType: 'person',
        data: { test: 'data1' },
      });
      expect(mockSaveObservation).toHaveBeenCalledWith({
        formType: 'test_form',
        data: { test: 'data2' },
      });
      expect(mockSaveObservation).toHaveBeenCalledTimes(2);

      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });

    test('should handle errors gracefully if saveObservation fails', async () => {
      mockSaveObservation.mockRejectedValue(new Error('DB save failed'));
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      await formServiceInstance.debugDatabase(); // Should not throw

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error debugging database:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });
});
