/**
 * builtinExtensions.ts
 *
 * Built-in extension functions that are always available in Formplayer.
 * These provide core functionality for dynamic choice lists and other features.
 */

// Extend window interface to include getObservationsByQuery if not already defined
declare global {
  interface Window {
    formulus?: {
      getObservationsByQuery?(options: {
        formType: string;
        isDraft?: boolean;
        includeDeleted?: boolean;
        whereClause?: string | null;
      }): Promise<any[]>;
    };
  }
}

/**
 * Calculate age from date of birth (matches calculateAge function logic)
 * @param dateOfBirth - ISO date string
 * @returns Age in years, or null if invalid
 */
function calculateAge(dateOfBirth: string | null | undefined): number | null {
  if (!dateOfBirth) return null;

  const birthDate = new Date(dateOfBirth);
  if (isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && today.getDate() < birthDate.getDate())
  ) {
    age--;
  }

  return age;
}

/**
 * Get dynamic choice list by querying local observations.
 *
 * This function queries the native Formulus database via the WebView bridge,
 * then filters and formats the results based on the provided configuration.
 *
 * @param queryName - Name of the query (typically a form type like 'household')
 * @param params - Query parameters including:
 *   - _config.valueField: Path to extract value (e.g., 'data.hh_village_name')
 *   - _config.labelField: Path to extract label (default: same as valueField)
 *   - _config.distinct: Whether to return unique values only
 *   - _config.distinctField: Field to use for uniqueness check
 *   - where: SQL-like WHERE clause for filtering (e.g., "data.hh_village = 'kopria'")
 *   - whereClause: Same as where (alternative name)
 *   - ageFromDob: If true, will calculate age from dob field and filter in JavaScript (fallback)
 * @param formData - Current form data (for template resolution in WHERE clauses)
 * @returns Array of choice items with {const, title} format
 */
export async function getDynamicChoiceList(
  queryName: string,
  params: Record<string, any> = {},
  _formData: Record<string, any> = {},
): Promise<Array<{ const: any; title: string }>> {
  // Check if Formulus bridge is available
  if (!window.formulus?.getObservationsByQuery) {
    console.error('getDynamicChoiceList: getObservationsByQuery not available');
    return [];
  }

  try {
    // Extract configuration
    const config = params._config || {};
    const valueField = config.valueField || 'observationId';
    const labelField = config.labelField || valueField;
    const distinct = config.distinct || false;

    // Build WHERE clause from params (excluding _config)
    // Support both 'where' and 'whereClause' for compatibility
    let whereClause = params.where || params.whereClause || null;

    // Get filter params (excluding _config, where, and whereClause)
    const filterParams = Object.entries(params).filter(
      ([key]) => key !== '_config' && key !== 'where' && key !== 'whereClause',
    );

    // Build WHERE clause from filter params if we have any
    if (filterParams.length > 0) {
      // Check if any filter values are null/undefined/empty - if so, return empty result
      const hasEmptyValue = filterParams.some(
        ([_, value]) => value === null || value === undefined || value === '',
      );

      if (hasEmptyValue) {
        // Return empty choices when dependency values are not yet selected
        return [];
      }

      const conditions = filterParams
        .map(([fieldPath, value]) => {
          // Escape single quotes in values
          const escapedValue = String(value).replace(/'/g, "''");
          return `data.${fieldPath} = '${escapedValue}'`;
        })
        .join(' AND ');

      // Combine with existing WHERE clause if present
      if (whereClause) {
        whereClause = `${whereClause} AND ${conditions}`;
      } else {
        whereClause = conditions;
      }
    }

    // Helper to extract nested value from object path (e.g., 'data.hh_village_name')
    const getNestedValue = (obj: any, path: string): any => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    // Check if WHERE clause uses age_from_dob() syntax
    const usesAgeFromDob = whereClause && /age_from_dob\(/i.test(whereClause);
    const originalWhereClause = whereClause;

    // If using age_from_dob(), we need to filter in JavaScript after fetching
    // Remove age_from_dob conditions from SQL WHERE clause and filter in JS instead
    if (usesAgeFromDob && whereClause) {
      // Extract non-age conditions to keep in SQL WHERE clause
      // Pattern matches: age_from_dob(...) with optional NOT before it
      const agePattern =
        /(NOT\s+)?age_from_dob\([^)]+\)\s*(>=|<=|>|<|=|!=)\s*\d+/gi;
      const nonAgeConditions: string[] = [];

      // Split by AND/OR and keep non-age conditions
      // Handle parentheses and complex logic
      const parts = whereClause.split(/\s+(AND|OR)\s+/i);
      for (let i = 0; i < parts.length; i += 2) {
        const condition = parts[i].trim();
        // Remove leading/trailing parentheses and NOT
        const cleanCondition = condition
          .replace(/^NOT\s+/i, '')
          .replace(/^\(+|\)+$/g, '')
          .trim();
        if (
          cleanCondition &&
          !agePattern.test(condition) &&
          !agePattern.test(cleanCondition)
        ) {
          nonAgeConditions.push(cleanCondition);
        }
      }

      // Rebuild WHERE clause without age conditions
      if (nonAgeConditions.length > 0) {
        whereClause = nonAgeConditions.join(' AND ');
      } else {
        whereClause = null; // No non-age conditions, fetch all and filter in JS
      }
    }

    // Query observations via bridge
    let observations = await window.formulus.getObservationsByQuery({
      formType: queryName,
      isDraft: false,
      includeDeleted: false,
      whereClause: whereClause,
    });

    // If age_from_dob() was used, filter by calculated age in JavaScript
    if (usesAgeFromDob && originalWhereClause) {
      // Parse the WHERE clause to extract age conditions
      // Pattern: age_from_dob(data.dob) >= 18 or NOT age_from_dob(data.dob) >= 18
      const ageConditionPattern =
        /(NOT\s+)?age_from_dob\(([^)]+)\)\s*(>=|<=|>|<|=|!=)\s*(\d+)/gi;
      const ageConditions: Array<{
        dobField: string;
        operator: string;
        threshold: number;
        negated: boolean;
        position: number;
        beforeText: string;
      }> = [];

      // Find all age conditions and their positions
      let match;
      while ((match = ageConditionPattern.exec(originalWhereClause)) !== null) {
        const hasNot = !!(match[1] && match[1].trim().toUpperCase() === 'NOT');
        const beforeText = originalWhereClause.substring(0, match.index);

        ageConditions.push({
          dobField: match[2].trim(),
          operator: match[3],
          threshold: parseInt(match[4], 10),
          negated: hasNot,
          position: match.index,
          beforeText: beforeText,
        });
      }

      if (ageConditions.length > 0) {
        try {
          observations = observations.filter((obs: any) => {
            // Get dob field (usually data.dob, but could be different)
            const dobField = ageConditions[0].dobField;
            const dob = getNestedValue(obs, dobField);
            const age = calculateAge(dob);

            if (age === null) return false;

            // Helper to evaluate a single age condition
            const evaluateCondition = (
              condition: (typeof ageConditions)[0],
            ): boolean => {
              let result: boolean;
              switch (condition.operator) {
                case '>=':
                  result = age >= condition.threshold;
                  break;
                case '<=':
                  result = age <= condition.threshold;
                  break;
                case '>':
                  result = age > condition.threshold;
                  break;
                case '<':
                  result = age < condition.threshold;
                  break;
                case '=':
                  result = age === condition.threshold;
                  break;
                case '!=':
                  result = age !== condition.threshold;
                  break;
                default:
                  result = true;
              }
              return condition.negated ? !result : result;
            };

            // Parse the WHERE clause structure to determine logic between conditions
            if (ageConditions.length === 1) {
              // Single condition
              return evaluateCondition(ageConditions[0]);
            } else {
              // Multiple conditions - need to parse the WHERE clause structure
              // Check the text between conditions to determine AND/OR logic
              const results: boolean[] = [];
              const logics: string[] = [];

              for (let i = 0; i < ageConditions.length; i++) {
                const condition = ageConditions[i];
                results.push(evaluateCondition(condition));

                if (i < ageConditions.length - 1) {
                  // Check text between this condition and the next
                  const nextCondition = ageConditions[i + 1];
                  const betweenText = originalWhereClause.substring(
                    condition.position +
                      (originalWhereClause
                        .substring(condition.position)
                        .match(
                          /age_from_dob\([^)]+\)\s*(>=|<=|>|<|=|!=)\s*\d+/i,
                        )?.[0]?.length || 0),
                    nextCondition.position,
                  );

                  // Check for OR (takes precedence in parsing)
                  if (/\bOR\b/i.test(betweenText)) {
                    logics.push('OR');
                  } else if (/\bAND\b/i.test(betweenText)) {
                    logics.push('AND');
                  } else {
                    // Default to AND if no explicit operator
                    logics.push('AND');
                  }
                }
              }

              // Evaluate results based on logic operators
              // Handle parentheses by checking if conditions are grouped
              // For complex queries like (A AND B) OR C, we need to respect grouping

              // Check if there are parentheses grouping conditions
              const firstConditionStart = ageConditions[0].position;
              const beforeFirst = originalWhereClause.substring(
                0,
                firstConditionStart,
              );
              const lastCondition = ageConditions[ageConditions.length - 1];
              const lastConditionEnd =
                lastCondition.position +
                (originalWhereClause
                  .substring(lastCondition.position)
                  .match(/age_from_dob\([^)]+\)\s*(>=|<=|>|<|=|!=)\s*\d+/i)?.[0]
                  ?.length || 0);
              const afterLast = originalWhereClause.substring(lastConditionEnd);

              // Check for NOT wrapping the entire block
              const notBefore = /NOT\s*\(/i.test(beforeFirst.trim().slice(-10));
              const closingParenAfter = /^\s*\)/.test(afterLast);
              const hasOpeningParen = /\(\s*$/.test(
                beforeFirst.trim().slice(-5),
              );

              // Check if conditions are grouped in parentheses
              const isGrouped = hasOpeningParen && closingParenAfter;

              // Evaluate based on logic operators
              let finalResult: boolean;

              if (logics.length === 0) {
                // Single condition
                finalResult = results[0];
              } else if (logics.every(l => l === 'AND')) {
                // All AND: all must be true
                finalResult = results.every(r => r);
              } else if (logics.every(l => l === 'OR')) {
                // All OR: at least one must be true
                finalResult = results.some(r => r);
              } else {
                // Mixed AND/OR - need to respect grouping
                // For (A AND B) OR C pattern:
                // - If grouped and first logic is AND, evaluate grouped part first
                if (
                  isGrouped &&
                  logics[0] === 'AND' &&
                  logics.some(l => l === 'OR')
                ) {
                  // Find where OR starts (after grouped AND conditions)
                  const orIndex = logics.findIndex(l => l === 'OR');
                  if (orIndex > 0) {
                    // Evaluate grouped AND conditions: (A AND B)
                    const groupedResult = results
                      .slice(0, orIndex + 1)
                      .every(r => r);
                    // Then OR with remaining conditions: OR C
                    const remainingResults = results.slice(orIndex + 1);
                    finalResult =
                      groupedResult || remainingResults.some(r => r);
                  } else {
                    // Fallback: OR all results
                    finalResult = results.some(r => r);
                  }
                } else {
                  // Fallback: evaluate sequentially (left to right)
                  finalResult = results[0];
                  for (let i = 0; i < logics.length; i++) {
                    if (logics[i] === 'OR') {
                      finalResult = finalResult || results[i + 1];
                    } else {
                      finalResult = finalResult && results[i + 1];
                    }
                  }
                }
              }

              // Handle NOT wrapping
              if (notBefore && closingParenAfter) {
                // NOT (conditions) - negate the entire result
                return !finalResult;
              }

              return finalResult;
            }
          });
        } catch (_filterError: unknown) {
          // If filtering fails, return empty array (better than crashing)
          observations = [];
        }
      }
    }

    // Map observations to choice items
    let choices = observations.map((obs: any) => {
      const value = getNestedValue(obs, valueField);
      const label = getNestedValue(obs, labelField);
      return {
        const: value,
        title: label || String(value),
      };
    });

    // Filter out null/undefined values
    choices = choices.filter(
      choice => choice.const != null && choice.const !== '',
    );

    // Apply distinct if requested
    if (distinct) {
      const seen = new Set();
      choices = choices.filter(choice => {
        const key = String(choice.const);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return choices;
  } catch (error: unknown) {
    console.error('getDynamicChoiceList error:', error);
    return [];
  }
}

/**
 * Get all built-in extension functions as a Map
 * @returns Map of function name to function
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
export function getBuiltinExtensions(): Map<string, Function> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  const functions = new Map<string, Function>();
  functions.set('getDynamicChoiceList', getDynamicChoiceList);
  return functions;
}
