import { getDatabase } from './database';
import { profileActivity } from '../profiles/ProfileActivity';
import { LocalRepoInterface } from './repositories/LocalRepoInterface';
import { WatermelonDBRepo } from './repositories/WatermelonDBRepo';

/**
 * Service class to provide access to the database repositories
 */
class DatabaseService {
  private static instance: DatabaseService;
  private localRepo: LocalRepoInterface;

  private constructor() {
    this.localRepo = new WatermelonDBRepo(getDatabase());
  }

  /**
   * Get the singleton instance of the DatabaseService
   */
  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  /**
   * Get the local repository implementation
   */
  public getLocalRepo(): LocalRepoInterface {
    profileActivity.assertAvailable();
    return this.localRepo;
  }
}

// Export a singleton instance
export const databaseService = DatabaseService.getInstance();
