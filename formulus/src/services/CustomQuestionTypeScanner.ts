/**
 * CustomQuestionTypeScanner.ts
 *
 * Scans the custom_app's `question_types/` directory on the device filesystem,
 * reads each module's source code (from renderer.js files), and screens it
 * against a blocklist of dangerous patterns before passing it to FormPlayer.
 *
 * This runs on the Formulus RN side (not in the WebView).
 *
 * Security: This is the first line of defense. Source code that contains
 * dangerous API calls is rejected before it ever reaches the WebView.
 *
 * File structure:
 *   question_types/{formatName}/renderer.js
 *
 * Schema usage:
 *   { "type": "string", "format": "{formatName}", ... }
 *   The format name must match the directory name.
 */

import RNFS from 'react-native-fs';

export interface ScannedQuestionType {
  /** The raw JS source code of the module */
  source: string;
}

export interface ScanResult {
  /** Successfully scanned custom question types, keyed by format name (folder name) */
  custom_types: Record<string, ScannedQuestionType>;
  /** Errors encountered during scanning (types that were rejected or couldn't be read) */
  errors: Array<{ name: string; error: string }>;
}

/**
 * Patterns that indicate potentially dangerous code.
 * If any of these are found in the source, the module is rejected.
 */
const BLOCKED_PATTERNS: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\bfetch\s*\(/, description: 'Network request via fetch()' },
  {
    pattern: /\bXMLHttpRequest\b/,
    description: 'Network request via XMLHttpRequest',
  },
  { pattern: /\bWebSocket\b/, description: 'WebSocket connection' },
  { pattern: /\beval\s*\(/, description: 'Dynamic code evaluation via eval()' },
  {
    pattern: /\bnew\s+Function\s*\(/,
    description: 'Dynamic code evaluation via new Function()',
  },
  { pattern: /\bdocument\.cookie\b/, description: 'Cookie access' },
  { pattern: /\blocalStorage\b/, description: 'localStorage access' },
  { pattern: /\bsessionStorage\b/, description: 'sessionStorage access' },
  { pattern: /\bindexedDB\b/, description: 'IndexedDB access' },
  {
    pattern: /\bnavigator\.sendBeacon\b/,
    description: 'Data exfiltration via sendBeacon',
  },
  {
    pattern: /\bimportScripts\s*\(/,
    description: 'Script import via importScripts()',
  },
];

/**
 * Screen source code against the blocklist.
 * Returns null if the source is clean, or a description of the violation.
 */
function screenSource(source: string): string | null {
  for (const { pattern, description } of BLOCKED_PATTERNS) {
    if (pattern.test(source)) {
      return description;
    }
  }
  return null;
}

/**
 * Scan the `question_types/` directory inside the custom app path.
 *
 * For each subdirectory found:
 *  1. Check for a `renderer.js` file
 *  2. Read the file contents as a string
 *  3. Screen the source against the blocklist
 *  4. If clean, include in the result
 *
 * The directory name becomes the format name used in schemas.
 * Example: "ranking/" directory → use "format": "ranking" in schema
 *
 * @param customAppPath - The root path of the custom app (e.g., RNFS.DocumentDirectoryPath + '/app')
 * @returns Scanned question types and any errors
 */
export async function scanCustomQuestionTypes(
  customAppPath: string,
): Promise<ScanResult> {
  const result: ScanResult = {
    custom_types: {},
    errors: [],
  };

  const questionTypesDir = `${customAppPath}/question_types`;

  const dirExists = await RNFS.exists(questionTypesDir);

  // Check if the question_types directory exists
  if (!dirExists) {
    console.log(
      '[CustomQuestionTypeScanner] No question_types/ directory found at:',
      questionTypesDir,
    );
    return result;
  }

  // Read all items in the question_types directory
  let folders: RNFS.ReadDirItem[];
  try {
    folders = await RNFS.readDir(questionTypesDir);
  } catch (err) {
    console.error(
      '[CustomQuestionTypeScanner] Failed to read question_types directory:',
      err,
    );
    return result;
  }

  // Process each subdirectory
  for (const folder of folders) {
    if (!folder.isDirectory()) {
      continue;
    }

    const formatName = folder.name; // e.g., "ranking"
    const rendererPath = `${folder.path}/renderer.js`;

    try {
      // Check if renderer.js exists
      const fileExists = await RNFS.exists(rendererPath);
      if (!fileExists) {
        result.errors.push({
          name: formatName,
          error: `No renderer.js found in question_types/${formatName}/`,
        });
        continue;
      }

      // Read the source code
      const source = await RNFS.readFile(rendererPath, 'utf8');

      if (!source || source.trim().length === 0) {
        result.errors.push({
          name: formatName,
          error: 'renderer.js is empty',
        });
        continue;
      }

      // Screen against the blocklist
      const violation = screenSource(source);
      if (violation) {
        result.errors.push({
          name: formatName,
          error: `Blocked: ${violation}`,
        });
        console.warn(
          `[CustomQuestionTypeScanner] Rejected "${formatName}": ${violation}`,
        );
        continue;
      }

      // Source is clean — include it
      result.custom_types[formatName] = { source };
      console.log(
        `[CustomQuestionTypeScanner] Accepted "${formatName}" (${source.length} bytes)`,
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      result.errors.push({
        name: formatName,
        error: `Failed to read: ${errorMessage}`,
      });
      console.error(
        `[CustomQuestionTypeScanner] Error processing "${formatName}":`,
        errorMessage,
      );
    }
  }

  console.log(
    `[CustomQuestionTypeScanner] Scan complete: ${Object.keys(result.custom_types).length} accepted, ${result.errors.length} errors`,
  );

  return result;
}
