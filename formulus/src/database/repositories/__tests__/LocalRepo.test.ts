import {LocalRepoInterface, Observation} from '../LocalRepoInterface';

/**
 * Mock implementation of LocalRepoInterface for testing
 * This allows us to test the repository pattern without relying on WatermelonDB
 */
class MockLocalRepo implements LocalRepoInterface {
  private observations: Map<string, Observation> = new Map();
  private nextId: number = 1;

  async saveObservation(observation: Partial<Observation>): Promise<string> {
    const id = `obs_${this.nextId++}`;
    const now = new Date();

    const newObservation: Observation = {
      id,
      observationId: id, // Use the same ID for observationId
      formType: observation.formType || '',
      formVersion: observation.formVersion || '1.0',
      data: observation.data || {},
      deleted: observation.deleted || false,
      createdAt: now,
      updatedAt: now,
      syncedAt: observation.syncedAt || (null as any),
    };

    this.observations.set(id, newObservation);
    return id;
  }

  async getObservation(id: string): Promise<Observation | null> {
    return this.observations.get(id) || null;
  }

  async getObservationsByFormId(formId: string): Promise<Observation[]> {
    return Array.from(this.observations.values()).filter(
      obs => obs.formType === formId && !obs.deleted,
    );
  }

  async updateObservation(
    id: string,
    observation: Partial<Observation>,
  ): Promise<boolean> {
    const existingObservation = this.observations.get(id);
    if (!existingObservation) {
      return false;
    }

    const updatedObservation = {
      ...existingObservation,
      ...observation,
      updatedAt: new Date(),
    };

    this.observations.set(id, updatedObservation);
    return true;
  }

  async deleteObservation(id: string): Promise<boolean> {
    const existingObservation = this.observations.get(id);
    if (!existingObservation) {
      return false;
    }

    const deletedObservation = {
      ...existingObservation,
      deleted: true,
      updatedAt: new Date(),
    };

    this.observations.set(id, deletedObservation);
    return true;
  }

  async markObservationAsSynced(id: string): Promise<boolean> {
    const existingObservation = this.observations.get(id);
    if (!existingObservation) {
      return false;
    }

    const syncedObservation = {
      ...existingObservation,
      syncedAt: new Date(),
      updatedAt: new Date(),
    };

    this.observations.set(id, syncedObservation);
    return true;
  }
}

describe('LocalRepo', () => {
  let repo: LocalRepoInterface;

  beforeEach(() => {
    // Create a fresh mock repository for each test
    repo = new MockLocalRepo();
  });

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

    // Assert
    expect(id).toBeTruthy();

    // Verify the observation was saved correctly
    const savedObservation = await repo.getObservation(id);
    expect(savedObservation).not.toBeNull();
    expect(savedObservation?.formType).toBe(testObservation.formType);
    expect(savedObservation?.formVersion).toBe(testObservation.formVersion);
    expect(savedObservation?.deleted).toBe(testObservation.deleted);

    // Check data was properly saved and can be parsed
    const parsedData =
      typeof savedObservation?.data === 'string'
        ? JSON.parse(savedObservation?.data)
        : savedObservation?.data;
    expect(parsedData).toEqual(testObservation.data);
  });

  test('getObservation should return null for non-existent ID', async () => {
    // Act
    const observation = await repo.getObservation('non-existent-id');

    // Assert
    expect(observation).toBeNull();
  });

  test('getObservationsByFormId should return observations for a specific form type', async () => {
    // Arrange
    const formType1 = 'form-type-1';
    const formType2 = 'form-type-2';

    // Create test observations
    await repo.saveObservation({formType: formType1, data: {test: 'data1'}});
    await repo.saveObservation({formType: formType1, data: {test: 'data2'}});
    await repo.saveObservation({formType: formType2, data: {test: 'data3'}});

    // Act
    const observations = await repo.getObservationsByFormId(formType1);

    // Assert
    expect(observations.length).toBe(2);
    expect(observations[0].formType).toBe(formType1);
    expect(observations[1].formType).toBe(formType1);
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

    // Act
    const updateSuccess = await repo.updateObservation(id, {
      data: {field1: 'updated'},
    });

    // Assert
    expect(updateSuccess).toBe(true);

    // Verify the observation was updated
    const updatedObservation = await repo.getObservation(id);
    const parsedData =
      typeof updatedObservation?.data === 'string'
        ? JSON.parse(updatedObservation?.data)
        : updatedObservation?.data;

    expect(parsedData.field1).toBe('updated');
  });

  test('deleteObservation should mark an observation as deleted', async () => {
    // Arrange
    const testObservation: Partial<Observation> = {
      formType: 'test-form',
      data: {field1: 'value1'},
    };

    const id = await repo.saveObservation(testObservation);

    // Act
    const deleteSuccess = await repo.deleteObservation(id);

    // Assert
    expect(deleteSuccess).toBe(true);

    // Verify the observation is marked as deleted
    const deletedObservation = await repo.getObservation(id);
    expect(deletedObservation?.deleted).toBe(true);
  });

  test('markObservationAsSynced should update the syncedAt field', async () => {
    // Arrange
    const testObservation: Partial<Observation> = {
      formType: 'test-form',
      data: {field1: 'value1'},
    };

    const id = await repo.saveObservation(testObservation);

    // Act
    const syncSuccess = await repo.markObservationAsSynced(id);

    // Assert
    expect(syncSuccess).toBe(true);

    // Verify the syncedAt field was updated
    const syncedObservation = await repo.getObservation(id);
    expect(syncedObservation?.syncedAt).toBeTruthy();
  });
});
