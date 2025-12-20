import {FormService as FormServiceType, FormSpec} from '../FormService';
import {Observation} from '../../database/repositories/LocalRepoInterface';

// Mock JSON schema files
jest.mock(
  '../../webview/personschema.json',
  () => ({
    type: 'object',
    properties: {name: {type: 'string'}, age: {type: 'number'}},
    required: ['name'],
  }),
  {virtual: true},
);

jest.mock(
  '../../webview/personui.json',
  () => ({
    elements: [
      {type: 'Control', scope: '#/properties/name'},
      {type: 'Control', scope: '#/properties/age'},
    ],
  }),
  {virtual: true},
);

// Mock personData.json for the temporary block in getFormTypes
jest.mock(
  '../../webview/personData.json',
  () => ({name: 'Test Person', age: 30}),
  {virtual: true},
);

// Mock databaseService and its LocalRepo
const mockGetObservationsByFormId = jest.fn();
const mockDeleteObservation = jest.fn();
const mockSaveObservation = jest.fn();
const mockGetObservationsCount = jest.fn(); // Assuming this might be useful or part of a fuller repo mock

jest.mock('../../database', () => ({
  databaseService: {
    getLocalRepo: jest.fn(() => ({
      getObservationsByFormId: mockGetObservationsByFormId,
      deleteObservation: mockDeleteObservation,
      saveObservation: mockSaveObservation,
      getObservationsCount: mockGetObservationsCount,
    })),
  },
}));

describe('FormService', () => {
  let formServiceInstance: FormServiceType;
  let ActualFormServiceClass: typeof FormServiceType;

  beforeEach(async () => {
    // Reset modules to ensure a fresh instance of FormService for each test,
    // as it's a singleton and we are also resetting its internal state (formTypes) via API.
    jest.resetModules();
    // Re-require FormService after resetting modules to get the new instance and class
    const FormServiceModule = require('../FormService');
    ActualFormServiceClass = FormServiceModule.FormService; // Capture the fresh class
    formServiceInstance = await ActualFormServiceClass.getInstance(); // Use it to get instance

    // Clear all mock implementations and calls
    mockGetObservationsByFormId.mockClear();
    mockDeleteObservation.mockClear();
    mockSaveObservation.mockClear();
    mockGetObservationsCount.mockClear();

    // Ensure getLocalRepo itself is reset if its return value needs to change per test
    // (though here we consistently return the same set of mocks)
    const {databaseService} = require('../../database');
    databaseService.getLocalRepo.mockClear();
  });

  describe('getInstance', () => {
    test('should return a FormService instance', () => {
      expect(formServiceInstance).toBeInstanceOf(ActualFormServiceClass);
    });

    test('should return the same instance on multiple calls', () => {
      const instance1 = ActualFormServiceClass.getInstance();
      const instance2 = ActualFormServiceClass.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('constructor and getFormTypes (initial state)', () => {
    test('should initialize with a default "person" form type', () => {
      const formSpecs = formServiceInstance.getFormSpecs();
      expect(formSpecs.length).toBeGreaterThan(0);
      const personForm = formSpecs.find(ft => ft.id === 'person');
      expect(personForm).toBeDefined();
      expect(personForm?.name).toBe('Person');
      expect(personForm?.schema).toEqual({
        type: 'object',
        properties: {name: {type: 'string'}, age: {type: 'number'}},
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
      schema: {type: 'object', properties: {field: {type: 'string'}}},
      uiSchema: {elements: [{type: 'Control', scope: '#/properties/field'}]},
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
        schema: {type: 'object', properties: {newField: {type: 'boolean'}}},
        uiSchema: {elements: []},
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

    test('should remove an existing form type and return true, ensuring temporary block does not re-add', () => {
      const result = formServiceInstance.removeFormSpec('person');
      expect(result).toBe(true);
      expect(formServiceInstance.getFormSpecById('person')).toBeUndefined();

      // Spy on console.error to ensure the temporary block's error path is hit
      const consoleErrorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Mock the require calls within the temporary block of getFormTypes to throw an error,
      // preventing it from re-adding the 'person' form.
      // These jest.doMock calls are scoped by jest.resetModules() in beforeEach.
      jest.doMock(
        '../../webview/personschema.json',
        () => {
          throw new Error('Mocked schema load failure for removeFormType test');
        },
        {virtual: true},
      );
      jest.doMock(
        '../../webview/personui.json',
        () => {
          throw new Error(
            'Mocked ui schema load failure for removeFormType test',
          );
        },
        {virtual: true},
      );
      jest.doMock(
        '../../webview/personData.json',
        () => {
          throw new Error('Mocked data load failure for removeFormType test');
        },
        {virtual: true},
      );

      // The `doMock` calls should affect subsequent `require` calls from any module, including FormService's internals,
      // because jest.resetModules() in beforeEach clears the cache, and FormService instance is fresh.

      const formSpecs = formServiceInstance.getFormSpecs(); // This call will trigger the temporary block with erroring mocks
      expect(formSpecs.length).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalled();

      // Restore console spy. No need to manually restore jest.doMock'd modules;
      // jest.resetModules() in the next beforeEach will handle it.
      consoleErrorSpy.mockRestore();
      // Clean up the doMocks specific to this test case to prevent leakage
      jest.dontMock('../../webview/personschema.json');
      jest.dontMock('../../webview/personui.json');
      jest.dontMock('../../webview/personData.json');
    });

    test('should return false if form type ID does not exist', () => {
      const initialLength = formServiceInstance.getFormSpecs().length;
      const result = formServiceInstance.removeFormSpec('nonexistent');
      expect(result).toBe(false);
      expect(formServiceInstance.getFormSpecs().length).toBe(initialLength);
    });
  });

  describe('getObservationsByFormType', () => {
    test('should call localRepo.getObservationsByFormId and return its result', async () => {
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
      mockGetObservationsByFormId.mockResolvedValue(mockObservations);

      const result = await formServiceInstance.getObservationsByFormType(
        'person',
      );

      expect(mockGetObservationsByFormId).toHaveBeenCalledWith('person');
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

  describe('resetDatabase', () => {
    test('should delete all observations for all known form types', async () => {
      const personObservations: Observation[] = [
        {
          id: 'p_obs1',
          formType: 'person',
          data: {},
          observationId: 'p_obs1',
          formVersion: '1',
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncedAt: new Date(),
        },
      ];
      const anotherObservations: Observation[] = [
        {
          id: 'a_obs1',
          formType: 'another',
          data: {},
          observationId: 'a_obs1',
          formVersion: '1',
          deleted: false,
          createdAt: new Date(),
          updatedAt: new Date(),
          syncedAt: new Date(),
        },
      ];

      formServiceInstance.addFormSpec({
        id: 'another',
        name: 'Another',
        description: '',
        schemaVersion: '1.0',
        schema: {},
        uiSchema: {},
      }); // Now 'person' and 'another' form types exist

      mockGetObservationsByFormId.mockImplementation(async (formId: string) => {
        if (formId === 'person') return personObservations;
        if (formId === 'another') return anotherObservations;
        return [];
      });
      mockDeleteObservation.mockResolvedValue(undefined);

      await formServiceInstance.resetDatabase();

      expect(mockGetObservationsByFormId).toHaveBeenCalledWith('person');
      expect(mockGetObservationsByFormId).toHaveBeenCalledWith('another');
      expect(mockDeleteObservation).toHaveBeenCalledWith('p_obs1');
      expect(mockDeleteObservation).toHaveBeenCalledWith('a_obs1');
      expect(mockDeleteObservation).toHaveBeenCalledTimes(2);
    });

    test('should throw error if localRepo is not available', async () => {
      const {databaseService: mockedDBService} = require('../../database');
      mockedDBService.getLocalRepo.mockReturnValue(undefined); // Simulate repo not being available

      // Re-initialize formService with the modified mock
      const FormServiceModule = require('../FormService');
      const FreshFormServiceClass = FormServiceModule.FormService;
      const freshFormServiceInstance = FreshFormServiceClass.getInstance();

      await expect(freshFormServiceInstance.resetDatabase()).rejects.toThrow(
        'Database repository is not available',
      );
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
        data: {test: 'data1'},
      });
      expect(mockSaveObservation).toHaveBeenCalledWith({
        formType: 'test_form',
        data: {test: 'data2'},
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

  // Test for the temporary block in getFormTypes if constructor fails to load initial form
  describe('getFormTypes temporary block', () => {
    beforeEach(async () => {
      jest.resetModules(); // Important: reset modules before changing mocks
      // Simulate the constructor's require for personschema.json failing
      jest.doMock(
        '../../webview/personschema.json',
        () => {
          throw new Error(
            'Simulated error: Failed to load personschema.json in constructor',
          );
        },
        {virtual: true},
      );

      // Other mocks should still be in place or re-mocked if necessary
      jest.doMock('../../webview/personui.json', () => ({elements: []}), {
        virtual: true,
      });
      jest.doMock('../../webview/personData.json', () => ({}), {virtual: true});
      jest.doMock('../../database', () => ({
        databaseService: {
          getLocalRepo: jest.fn(() => ({
            getObservationsByFormId: mockGetObservationsByFormId,
            deleteObservation: mockDeleteObservation,
            saveObservation: mockSaveObservation,
            getObservationsCount: mockGetObservationsCount,
          })),
        },
      }));

      const FormServiceModule = require('../FormService');
      ActualFormServiceClass = FormServiceModule.FormService; // Update the class reference
      formServiceInstance = await ActualFormServiceClass.getInstance(); // This instance will have an empty formTypes array initially
    });

    test('should load temporary person form if initial formTypes is empty due to constructor schema load failure', async () => {
      // formServiceInstance from the describe's beforeEach has formTypes = [] due to constructor mock failure.

      // These mocks are for the require() calls *inside* the getFormTypes() method of that instance.
      // Due to hoisting, these should be active for the subsequent call to getFormTypes().
      jest.doMock(
        '../../webview/personschema.json',
        () => ({
          type: 'object',
          properties: {tempName: {type: 'string'}},
        }),
        {virtual: true},
      );
      // Ensure UI and Data schemas match the new tempName property for consistency in the temporary block
      jest.doMock(
        '../../webview/personui.json',
        () => ({
          elements: [{type: 'Control', scope: '#/properties/tempName'}],
        }),
        {virtual: true},
      );
      jest.doMock(
        '../../webview/personData.json',
        () => ({tempName: 'Temp Data'}),
        {virtual: true},
      );
      // The databaseService mock from the describe's beforeEach should still be in effect.

      const consoleLogSpy = jest
        .spyOn(console, 'log')
        .mockImplementation(() => {});

      // Call getFormTypes() on the instance that had its constructor fail.
      const formSpecs = await formServiceInstance.getFormSpecs();

      expect(formSpecs.length).toBe(1);
      expect(formSpecs[0].id).toBe('person');
      // Schema should match the one mocked above for the temporary block's internal require
      expect(formSpecs[0].schema).toEqual({
        type: 'object',
        properties: {tempName: {type: 'string'}},
      });
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Temporary form type created:',
        'person',
      );

      consoleLogSpy.mockRestore();

      // Clean up mocks to prevent leakage to other tests, though beforeEach's resetModules should handle it.
      jest.dontMock('../../webview/personschema.json');
      jest.dontMock('../../webview/personui.json');
      jest.dontMock('../../webview/personData.json');
    });
  });
});
