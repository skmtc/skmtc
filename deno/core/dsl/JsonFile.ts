/**
 * Constructor arguments for {@link JsonFile}.
 */
type JsonFileArgs = {
  /** The file path for the generated JSON file */
  path: string
  /** The JSON content to write to the file */
  content: Record<string, unknown>
}

/**
 * Represents a JSON file in the SKMTC DSL system.
 *
 * The `JsonFile` class is used to generate JSON files as part of the code generation
 * process. It provides a simple interface for creating configuration files, manifests,
 * package.json files, and other JSON-based artifacts with proper formatting.
 *
 * ## Key Features
 *
 * - **JSON Formatting**: Automatically formats JSON with 2-space indentation
 * - **Type Safety**: Accepts any valid JSON-serializable content structure
 * - **Path Management**: Associates content with specific file paths
 * - **String Conversion**: Easy integration with file writing systems
 *
 * @example Basic JSON file creation
 * ```typescript
 * import { JsonFile } from '@skmtc/core';
 *
 * const packageJson = new JsonFile({
 *   path: './package.json',
 *   content: {
 *     name: 'my-api-client',
 *     version: '1.0.0',
 *     type: 'module',
 *     main: './index.js',
 *     dependencies: {
 *       'axios': '^1.0.0'
 *     }
 *   }
 * });
 *
 */
export class JsonFile {
  /** The file type, always 'json' for JSON files */
  fileType: 'json' = 'json'

  /** The file path for this generated JSON file */
  path: string

  /** The JSON content to write to the file */
  content: Record<string, unknown>

  /**
   * Creates a new JsonFile instance.
   *
   * @param args - JSON file configuration
   * @param args.path - The output path for this JSON file
   * @param args.content - The JSON content to write
   *
   * @example
   * ```typescript
   * const configFile = new JsonFile({
   *   path: './config/settings.json',
   *   content: {
   *     theme: 'dark',
   *     language: 'en',
   *     features: ['auth', 'notifications']
   *   }
   * });
   * ```
   */
  constructor({ path, content }: JsonFileArgs) {
    this.path = path
    this.content = content
  }

  /**
   * Converts the JSON content to a formatted string.
   *
   * This method serializes the content object to JSON with 2-space indentation
   * for readable output. The resulting string is suitable for writing directly
   * to a file or including in the generation pipeline.
   *
   * @returns The formatted JSON content as a string
   *
   * @example
   * ```typescript
   * const file = new JsonFile({
   *   path: './data.json',
   *   content: { name: 'test', value: 42 }
   * });
   *
   * console.log(file.toString());
   * // {
   * //   "name": "test",
   * //   "value": 42
   * // }
   * ```
   */
  toString(): string {
    return JSON.stringify(this.content, null, 2)
  }
}
