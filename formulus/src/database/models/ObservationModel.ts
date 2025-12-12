import {Model} from '@nozbe/watermelondb';
import {field, text, date, readonly} from '@nozbe/watermelondb/decorators';

/**
 * Model representing a completed form observation in WatermelonDB
 */
export class ObservationModel extends Model {
  static table = 'observations';

  // Define fields with decorators
  @text('observation_id') observationId!: string; // Same as Model.id
  @text('form_type') formType!: string;
  @text('form_version') formVersion!: string;
  @field('deleted') deleted!: boolean;
  @text('data') data!: string;
  @text('geolocation') geolocation!: string; // JSON string of ObservationGeolocation or null
  @readonly @date('created_at') createdAt!: Date;
  @readonly @date('updated_at') updatedAt!: Date;
  @date('synced_at') syncedAt!: Date;

  /**
   * Get the parsed data object
   */
  getParsedData(): any {
    try {
      return JSON.parse(this.data);
    } catch (error) {
      console.error('Error parsing observation data:', error);
      return null;
    }
  }
}
