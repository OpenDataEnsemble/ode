/**
 * CustomValidatorRegistry.ts
 *
 * Registry for loaded custom validators.
 * Provides lookup by name and manages the validator lifecycle.
 *
 * Usage:
 *   const registry = new CustomValidatorRegistry();
 *   registry.register('isAdult', validatorFunction);
 *   const validator = registry.get('isAdult');
 */

import type { CustomValidatorFunction } from '../types/CustomValidatorContract';

/**
 * Registry for custom validators.
 * Provides thread-safe lookup and registration of validators.
 */
export class CustomValidatorRegistry {
  private validators: Map<string, CustomValidatorFunction> = new Map();

  /**
   * Register a validator function with a name.
   *
   * @param name - Validator name (must match UI schema reference)
   * @param validator - Validator function
   */
  register(name: string, validator: CustomValidatorFunction): void {
    if (this.validators.has(name)) {
      console.warn(
        `[CustomValidatorRegistry] Validator "${name}" is already registered. Overwriting.`,
      );
    }
    this.validators.set(name, validator);
    console.log(`[CustomValidatorRegistry] Registered validator "${name}"`);
  }

  /**
   * Register multiple validators at once.
   *
   * @param validators - Map of name → validator function
   */
  registerAll(validators: Map<string, CustomValidatorFunction>): void {
    for (const [name, validator] of validators) {
      this.register(name, validator);
    }
  }

  /**
   * Get a validator by name.
   *
   * @param name - Validator name
   * @returns Validator function, or undefined if not found
   */
  get(name: string): CustomValidatorFunction | undefined {
    return this.validators.get(name);
  }

  /**
   * Check if a validator is registered.
   *
   * @param name - Validator name
   * @returns True if validator exists
   */
  has(name: string): boolean {
    return this.validators.has(name);
  }

  /**
   * Get all registered validator names.
   *
   * @returns Array of validator names
   */
  getNames(): string[] {
    return Array.from(this.validators.keys());
  }

  /**
   * Clear all registered validators.
   */
  clear(): void {
    this.validators.clear();
    console.log('[CustomValidatorRegistry] Cleared all validators');
  }
}

// Singleton instance for global access
export const customValidatorRegistry = new CustomValidatorRegistry();
