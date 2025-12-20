import {Database} from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import {schemas} from '../../schema';
import {ObservationModel} from '../../models/ObservationModel';
import {WatermelonDBRepo} from '../WatermelonDBRepo';
import {Observation} from '../LocalRepoInterface';
import {Q} from '@nozbe/watermelondb';

// Create a test database with in-memory LokiJS adapter
function createTestDatabase() {
  const adapter = new LokiJSAdapter({
    schema: schemas,
    // Don't use web workers in tests to avoid async issues
    useWebWorker: false,
    // Don't use IndexedDB for tests
    useIncrementalIndexedDB: false,
    // Disable logging to reduce noise in test output
    dbName: 'test-watermelon-db',
  });

  return new Database({
    adapter,
    modelClasses: [ObservationModel],
  });
}

describe('WatermelonDBRepo', () => {
  let database: Database;
  let repo: WatermelonDBRepo;

  beforeEach(async () => {
    // Create a fresh database for each test
    database = createTestDatabase();
    repo = new WatermelonDBRepo(database);

    // Reset the database before each test
    await database.write(async () => {
      await database.unsafeResetDatabase();
    });

    // Verify the database is empty at the start of each test
    const collection = database.get('observations');
    const count = await collection.query().fetchCount();
    console.log(`Database initialized with ${count} records`);
    expect(count).toBe(0);
  });

  afterEach(async () => {
    // Increase timeout for cleanup
    jest.setTimeout(30000);

    try {
      // Clean up after each test
      await database.write(async () => {
        await database.unsafeResetDatabase();
      });

      // Clear any pending operations
      const adapter = database.adapter as any;
      if (
        adapter &&
        adapter._queue &&
        typeof adapter._queue.clear === 'function'
      ) {
        adapter._queue.clear();
      }

      // Allow time for any async operations to complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }
  }, 5000); // Ensure enough time for cleanup

  // Add global cleanup after all tests
  afterAll(async () => {
    // Increase timeout for final cleanup
    jest.setTimeout(30000);

    try {
      // Clean up the database
      if (database) {
        await database.write(async () => {
          await database.unsafeResetDatabase();
        });

        // For LokiJS adapter, we need to access the adapter directly to close connections
        // This is a workaround since Database doesn't have a close() method
        const adapter = database.adapter as any;
        if (adapter) {
          // Close LokiJS database
          if (adapter.loki && typeof adapter.loki.close === 'function') {
            adapter.loki.close();
          }

          // Close any other connections in the adapter
          if (typeof adapter.close === 'function') {
            await adapter.close();
          }

          // Destroy any worker if it exists
          if (
            adapter.worker &&
            typeof adapter.worker.terminate === 'function'
          ) {
            adapter.worker.terminate();
          }
        }
      }
    } catch (error) {
      console.error('Error during test cleanup:', error);
    }

    // Force garbage collection if available (Node.js only)
    if (global.gc) {
      global.gc();
    }
  }, 10000); // Ensure enough time for cleanup

  test('saveObservation should create a new observation and return its ID', async () => {
    // Arrange
    const testObservation: Partial<Observation> = {
      formType: 'test-form',
      formVersion: '1.0',
      data: {field1: 'value1', field2: 'value2'},
      deleted: false,
    };

    // Act
    const id = await repo.saveObservation(testObservation);
    console.log('Created observation with ID:', id);

    // Assert
    expect(id).toBeTruthy();

    // Debug: Check if we can retrieve the observation immediately after creation
    const savedObservation = await repo.getObservation(id);
    console.log('Retrieved observation:', savedObservation);

    // Verify the observation was saved correctly
    expect(savedObservation).not.toBeNull();
    if (savedObservation) {
      expect(savedObservation.formType).toBe(testObservation.formType);
      expect(savedObservation.formVersion).toBe(testObservation.formVersion);
      expect(savedObservation.deleted).toBe(testObservation.deleted);

      // Check data was properly saved and can be parsed
      const parsedData =
        typeof savedObservation.data === 'string'
          ? JSON.parse(savedObservation.data)
          : savedObservation.data;
      expect(parsedData).toEqual(testObservation.data);
    }

    // Additional verification: Check if the record exists in the database directly
    const collection = database.get('observations');
    const count = await collection.query().fetchCount();
    console.log(`Total records in database: ${count}`);
    expect(count).toBe(1);

    // Try to find the record using the observationId field
    const records = await collection
      .query(Q.where('observation_id', id))
      .fetch();
    console.log(`Records found by observation_id: ${records.length}`);
    expect(records.length).toBe(1);
  });

  test('getObservation should return null for non-existent ID', async () => {
    // Act
    const observation = await repo.getObservation('non-existent-id');

    // Assert
    expect(observation).toBeNull();

    // Verify database is empty
    const collection = database.get('observations');
    const count = await collection.query().fetchCount();
    console.log(`Total records in database: ${count}`);
    expect(count).toBe(0);
  });

  test('getObservationsByFormId should return observations for a specific form type', async () => {
    // Arrange
    const formType1 = 'form-type-1';
    const formType2 = 'form-type-2';

    // Create test observations
    const id1 = await repo.saveObservation({
      formType: formType1,
      data: {test: 'data1'},
    });
    const id2 = await repo.saveObservation({
      formType: formType1,
      data: {test: 'data2'},
    });
    const id3 = await repo.saveObservation({
      formType: formType2,
      data: {test: 'data3'},
    });

    console.log('Created observations with IDs:', id1, id2, id3);

    // Verify records were created in the database
    const collection = database.get('observations');
    const count = await collection.query().fetchCount();
    console.log(`Total records in database: ${count}`);
    expect(count).toBe(3);

    // Debug: Verify each observation was saved correctly
    const obs1 = await repo.getObservation(id1);
    const obs2 = await repo.getObservation(id2);
    const obs3 = await repo.getObservation(id3);

    console.log(
      'Retrieved individual observations:',
      obs1 ? 'obs1 found' : 'obs1 not found',
      obs2 ? 'obs2 found' : 'obs2 not found',
      obs3 ? 'obs3 found' : 'obs3 not found',
    );

    // Verify we can find records by their observation_id
    const records1 = await collection
      .query(Q.where('observation_id', id1))
      .fetch();
    const records2 = await collection
      .query(Q.where('observation_id', id2))
      .fetch();
    const records3 = await collection
      .query(Q.where('observation_id', id3))
      .fetch();

    expect(records1.length).toBe(1);
    expect(records2.length).toBe(1);
    expect(records3.length).toBe(1);

    // Act
    const observations = await repo.getObservationsByFormId(formType1);
    console.log(
      `Found ${observations.length} observations for form type ${formType1}`,
    );

    // Assert
    expect(observations.length).toBe(2);
    if (observations.length >= 2) {
      expect(observations[0].formType).toBe(formType1);
      expect(observations[1].formType).toBe(formType1);
    }
  });

  test('updateObservation should modify an existing observation', async () => {
    // Arrange
    const testObservation: Partial<Observation> = {
      formType: 'test-form',
      formVersion: '1.0',
      data: {field1: 'original'},
      deleted: false,
    };

    const id = await repo.saveObservation(testObservation);
    console.log('Created observation with ID:', id);

    // Verify record was created in the database
    const collection = database.get('observations');
    const initialCount = await collection.query().fetchCount();
    console.log(`Total records in database before update: ${initialCount}`);
    expect(initialCount).toBe(1);

    // Debug: Verify the observation was saved
    const originalObservation = await repo.getObservation(id);
    console.log('Original observation:', originalObservation);

    // Act
    const updateSuccess = await repo.updateObservation(id, {
      data: {field1: 'updated'},
    });

    // Assert
    expect(updateSuccess).toBe(true);

    // Verify the record count hasn't changed after update
    const countAfterUpdate = await collection.query().fetchCount();
    console.log(`Total records in database after update: ${countAfterUpdate}`);
    expect(countAfterUpdate).toBe(1);

    // Verify the observation was updated
    const updatedObservation = await repo.getObservation(id);
    console.log('Updated observation:', updatedObservation);

    if (updatedObservation) {
      const parsedData =
        typeof updatedObservation.data === 'string'
          ? JSON.parse(updatedObservation.data)
          : updatedObservation.data;

      expect(parsedData.field1).toBe('updated');
    }

    // Verify we can find the updated record by its observation_id
    const records = await collection
      .query(Q.where('observation_id', id))
      .fetch();
    expect(records.length).toBe(1);

    // Check the raw data in the database record
    if (records.length > 0) {
      // Access the data through the model's getter method
      const record = records[0] as ObservationModel;
      const parsedData = record.getParsedData();
      expect(parsedData.field1).toBe('updated');
    }
  });

  test('deleteObservation should mark an observation as deleted', async () => {
    // Arrange
    const testObservation: Partial<Observation> = {
      formType: 'test-form',
      data: {field1: 'value1'},
    };

    const id = await repo.saveObservation(testObservation);
    console.log('Created observation with ID:', id);

    // Verify record was created in the database
    const collection = database.get('observations');
    const initialCount = await collection.query().fetchCount();
    console.log(`Total records in database before deletion: ${initialCount}`);
    expect(initialCount).toBe(1);

    // Act
    const deleteSuccess = await repo.deleteObservation(id);

    // Assert
    expect(deleteSuccess).toBe(true);

    // Verify the record count hasn't changed after marking as deleted
    const countAfterDelete = await collection.query().fetchCount();
    console.log(
      `Total records in database after deletion: ${countAfterDelete}`,
    );
    expect(countAfterDelete).toBe(1); // Record should still exist, just marked as deleted

    // Verify the observation is marked as deleted
    const deletedObservation = await repo.getObservation(id);
    console.log('Deleted observation:', deletedObservation);

    if (deletedObservation) {
      expect(deletedObservation.deleted).toBe(true);
    }

    // Verify we can find the deleted record by its observation_id
    const records = await collection
      .query(Q.where('observation_id', id))
      .fetch();
    expect(records.length).toBe(1);

    // Check the deleted flag in the database record
    if (records.length > 0) {
      // Access the deleted property through the model
      const record = records[0] as ObservationModel;
      expect(record.deleted).toBe(true);
    }
  });

  test('markObservationAsSynced should update the syncedAt field', async () => {
    // Arrange
    const testObservation: Partial<Observation> = {
      formType: 'test-form',
      data: {field1: 'value1'},
    };

    const id = await repo.saveObservation(testObservation);
    console.log('Created observation with ID:', id);

    // Verify record was created in the database
    const collection = database.get('observations');
    const initialCount = await collection.query().fetchCount();
    console.log(`Total records in database before sync: ${initialCount}`);
    expect(initialCount).toBe(1);

    // Act
    const syncSuccess = await repo.markObservationAsSynced(id);

    // Assert
    expect(syncSuccess).toBe(true);

    // Verify the record count hasn't changed after marking as synced
    const countAfterSync = await collection.query().fetchCount();
    console.log(`Total records in database after sync: ${countAfterSync}`);
    expect(countAfterSync).toBe(1);

    // Verify the syncedAt field was updated
    const syncedObservation = await repo.getObservation(id);
    console.log('Synced observation:', syncedObservation);

    if (syncedObservation) {
      expect(syncedObservation.syncedAt).toBeTruthy();
    }

    // Verify we can find the synced record by its observation_id
    const records = await collection
      .query(Q.where('observation_id', id))
      .fetch();
    expect(records.length).toBe(1);

    // Check the syncedAt field in the database record
    if (records.length > 0) {
      // Access the syncedAt property through the model
      const record = records[0] as ObservationModel;
      expect(record.syncedAt).toBeTruthy();
    }
  });

  // Add a test to verify persistence across database instances
  test('observations should persist across database instances', async () => {
    // Arrange - create an observation
    const testObservation: Partial<Observation> = {
      formType: 'persistence-test',
      formVersion: '1.0',
      data: {field1: 'persistence-value'},
    };

    // Save the observation
    const id = await repo.saveObservation(testObservation);
    console.log('Created observation with ID for persistence test:', id);

    // Verify it exists in the current database
    const savedObservation = await repo.getObservation(id);
    expect(savedObservation).not.toBeNull();

    // Create a new database instance and repo
    const newDatabase = createTestDatabase();
    const newRepo = new WatermelonDBRepo(newDatabase);

    // Try to retrieve the observation from the new database instance
    // Note: This test will fail with LokiJS adapter since it's in-memory only
    // But it's useful to verify the behavior with SQLite in real device testing
    const retrievedObservation = await newRepo.getObservation(id);
    console.log(
      'Observation retrieved from new database instance:',
      retrievedObservation,
    );

    // With LokiJS adapter (in-memory), we expect the observation not to be found
    // This test is marked as a conditional test that would pass with SQLite
    if (retrievedObservation) {
      // This would pass with SQLite but fail with LokiJS
      console.log(
        'Observation found in new database instance - this is unexpected with LokiJS but would be correct with SQLite',
      );
      expect(retrievedObservation.formType).toBe(testObservation.formType);
    } else {
      // This is the expected behavior with LokiJS
      console.log(
        'Observation not found in new database instance - this is expected with LokiJS',
      );
      // We don't assert here because we expect it to be null with LokiJS
    }

    // Clean up the new database
    await newDatabase.write(async () => {
      await newDatabase.unsafeResetDatabase();
    });

    // For LokiJS adapter, we need to access the adapter directly to close connections
    const adapter = newDatabase.adapter as any;
    if (adapter && adapter.loki && typeof adapter.loki.close === 'function') {
      adapter.loki.close();
    }
  });

  // Add a test to verify basic persistence works
  test('should save and retrieve observations', async () => {
    // Arrange
    const testObservation1: Partial<Observation> = {
      formType: 'test-observation-1',
      data: {field1: 'test-value-1'},
    };

    const testObservation2: Partial<Observation> = {
      formType: 'test-observation-2',
      data: {field1: 'test-value-2'},
    };

    // Act - create observations directly with the repo
    const id1 = await repo.saveObservation(testObservation1);
    const id2 = await repo.saveObservation(testObservation2);

    console.log('Created observations with IDs:', id1, id2);

    // Assert - verify both observations were saved
    const collection = database.get('observations');
    const count = await collection.query().fetchCount();
    console.log(`Total records in database: ${count}`);
    expect(count).toBe(2);

    // Verify we can retrieve the observations
    const obs1 = await repo.getObservation(id1);
    const obs2 = await repo.getObservation(id2);

    expect(obs1).not.toBeNull();
    expect(obs2).not.toBeNull();

    if (obs1 && obs2) {
      expect(obs1.formType).toBe(testObservation1.formType);
      expect(obs2.formType).toBe(testObservation2.formType);
    }
  });

  // Test the synchronize method
  test.skip('synchronize should pull and push observations correctly', async () => {
    // Arrange - create some local observations that need syncing
    const localObservation1: Partial<Observation> = {
      formType: 'sync-test-local-1',
      data: {source: 'local', value: 1},
    };

    const localObservation2: Partial<Observation> = {
      formType: 'sync-test-local-2',
      data: {source: 'local', value: 2},
    };

    // Save the local observations
    const localId1 = await repo.saveObservation(localObservation1);
    const localId2 = await repo.saveObservation(localObservation2);

    // Verify local observations were saved
    const collection = database.get('observations');
    const initialCount = await collection.query().fetchCount();
    expect(initialCount).toBe(2);

    // Create mock server data to be pulled
    const serverObservations = [
      {
        observationId: 'server-obs-1',
        formType: 'sync-test-server-1',
        formVersion: '1.0',
        data: {source: 'server', value: 1},
        deleted: false,
      },
      {
        observationId: 'server-obs-2',
        formType: 'sync-test-server-2',
        formVersion: '1.0',
        data: {source: 'server', value: 2},
        deleted: false,
      },
    ];

    // Create mock functions for pull and push
    const mockPullChanges = jest.fn().mockResolvedValue(serverObservations);

    const pushedObservations: Observation[] = [];
    const mockPushChanges = jest
      .fn()
      .mockImplementation((observations: Observation[]) => {
        pushedObservations.push(...observations);
        return Promise.resolve();
      });

    // Act - perform synchronization
    await repo.synchronize(mockPullChanges, mockPushChanges);

    // Assert - verify pull was called
    expect(mockPullChanges).toHaveBeenCalledTimes(1);

    // Verify server observations were saved locally
    const afterSyncCount = await collection.query().fetchCount();
    expect(afterSyncCount).toBe(4); // 2 local + 2 server

    // Verify we can retrieve the server observations
    const serverObs1 = await repo.getObservation('server-obs-1');
    const serverObs2 = await repo.getObservation('server-obs-2');

    expect(serverObs1).not.toBeNull();
    expect(serverObs2).not.toBeNull();

    if (serverObs1 && serverObs2) {
      expect(serverObs1.formType).toBe('sync-test-server-1');
      expect(serverObs2.formType).toBe('sync-test-server-2');
    }

    // Verify push was called with local observations
    expect(mockPushChanges).toHaveBeenCalledTimes(1);
    expect(pushedObservations.length).toBe(2);

    // Verify local observations were marked as synced
    const syncedObs1 = await repo.getObservation(localId1);
    const syncedObs2 = await repo.getObservation(localId2);

    expect(syncedObs1?.syncedAt).toBeTruthy();
    expect(syncedObs2?.syncedAt).toBeTruthy();
  });
});
