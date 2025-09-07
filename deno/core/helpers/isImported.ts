import { normalize } from '@std/path/normalize'

/**
 * Determines whether two file paths represent different locations (import required).
 * 
 * This utility function normalizes two file paths and compares them to determine
 * if they represent different files. It's used throughout the SKMTC system to
 * decide when import statements are needed - if two paths are different, an
 * import is required to access symbols from one file in another.
 * 
 * The function handles path normalization to ensure consistent comparisons
 * across different operating systems and path formats (handling './' vs absolute
 * paths, different separators, etc.).
 * 
 * @param pathOne - The first file path to compare
 * @param pathTwo - The second file path to compare
 * @returns `true` if the paths are different (import needed), `false` if they're the same file
 * 
 * @example Basic path comparison
 * ```typescript
 * import { isImported } from '@skmtc/core';
 * 
 * // Same file, no import needed
 * console.log(isImported('./src/user.ts', './src/user.ts')); // false
 * 
 * // Different files, import needed
 * console.log(isImported('./src/user.ts', './src/product.ts')); // true
 * ```
 * 
 * @example Path normalization handling
 * ```typescript
 * // These all represent the same file after normalization
 * console.log(isImported('./src/user.ts', 'src/user.ts')); // false
 * console.log(isImported('src/./user.ts', 'src/user.ts')); // false
 * console.log(isImported('src/models/../user.ts', 'src/user.ts')); // false
 * ```
 * 
 * @example Usage in import decision logic
 * ```typescript
 * class FileGenerator {
 *   addImportIfNeeded(
 *     sourceFile: string,
 *     targetFile: string,
 *     importName: string
 *   ) {
 *     if (isImported(sourceFile, targetFile)) {
 *       // Files are different, add import
 *       this.addImport(sourceFile, targetFile, importName);
 *       console.log(`Added import: ${importName} from ${targetFile}`);
 *     } else {
 *       // Same file, no import needed
 *       console.log(`No import needed - same file: ${sourceFile}`);
 *     }
 *   }
 * }
 * ```
 * 
 * @example Cross-platform path handling
 * ```typescript
 * // Works consistently across platforms
 * const windowsPath = 'src\\models\\user.ts';
 * const unixPath = 'src/models/user.ts';
 * 
 * console.log(isImported(windowsPath, unixPath)); // false (same file)
 * ```
 * 
 * @example In generator context
 * ```typescript
 * class ModelGenerator {
 *   generateModel(modelPath: string, referencePath: string) {
 *     const definition = this.createModelDefinition();
 *     
 *     if (isImported(modelPath, referencePath)) {
 *       // Need to import the referenced model
 *       definition.addImport(referencePath, 'ReferencedModel');
 *     }
 *     
 *     return definition;
 *   }
 * }
 * ```
 */
export const isImported = (pathOne: string, pathTwo: string): boolean => {
  return normalize(pathOne) !== normalize(pathTwo)
}
