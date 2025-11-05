import type { PrettierConfigType } from '@/types/PrettierConfig.ts'
import invariant from 'npm:tiny-invariant@1.3.3'
import type { FilesRenderResult, RenderResult } from './generateTypes.ts'
import { normalize } from '@std/path/normalize'
import type { Definition } from '@/dsl/Definition.ts'
import type { PickArgs } from './generateTypes.ts'
import type { ResultType } from '@/types/Results.ts'
import { toResolvedArtifactPath } from '@/helpers/toResolvedArtifactPath.ts'
import type * as log from '@std/log'
import type { Logger } from '@/types/Logger.ts'
import { File } from '@/dsl/File.ts'
import type { Preview, Mapping } from '@/types/Preview.ts'
import type { JsonFile } from '@/dsl/JsonFile.ts'
import type { StackTrail } from './StackTrail.ts'

/**
 * Constructor arguments for {@link RenderContext}.
 */
type ConstructorArgs = {
  /** Map of generated files to render */
  files: Map<string, File | JsonFile>
  /** Preview data for generated content */
  previews: Record<string, Record<string, Preview>>
  /** Mapping data for file relationships */
  mappings: Record<string, Record<string, Mapping>>
  /** Optional formatter configuration (using Prettier format for compatibility) */
  prettierConfig?: PrettierConfigType
  /** Base path for resolving file paths */
  basePath: string | undefined
  /** Logger instance for debug information */
  logger: log.Logger
  /** Function to capture result status */
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
}

/**
 * Represents a rendered file with metadata.
 */
type FileObject = {
  /** The rendered file content */
  content: string
  /** The original file path */
  path: string
  /** The resolved destination path */
  destinationPath: string
  /** Number of lines in the rendered content */
  lines: number
  /** Number of characters in the rendered content */
  characters: number
}

/**
 * Output structure for the render operation.
 */
type RenderOutput = {
  /** Map of file paths to rendered content */
  artifacts: Record<string, string>
  /** Map of file paths to metadata */
  files: Record<
    string,
    {
      /** The resolved destination path */
      destinationPath: string
      /** Number of lines in the rendered content */
      lines: number
      /** Number of characters in the rendered content */
      characters: number
    }
  >
}

export class RenderContext {
  /** Map of generated files to render */
  files: Map<string, File | JsonFile>
  /** Preview data for generated content */
  previews: Record<string, Record<string, Preview>>
  /** Mapping data for file relationships */
  mappings: Record<string, Record<string, Mapping>>
  /** Optional formatter configuration (using Prettier format for compatibility) */
  #prettierConfig?: PrettierConfigType
  /** Base path for resolving file paths */
  basePath: string | undefined
  /** Logger instance for debug information */
  logger: Logger
  /** Function to capture result status */
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void

  /**
   * Creates a new RenderContext instance with the specified configuration.
   *
   * Initializes the rendering context with files to render, preview data,
   * formatting configuration, and logging/tracing infrastructure.
   *
   * @param args - Constructor arguments containing all required configuration
   */
  constructor({
    files,
    previews,
    mappings,
    prettierConfig,
    basePath,
    logger,
    captureCurrentResult
  }: ConstructorArgs) {
    this.files = files
    this.previews = previews
    this.mappings = mappings
    this.#prettierConfig = prettierConfig
    this.basePath = basePath
    this.logger = logger
    this.captureCurrentResult = captureCurrentResult
  }

  /**
   * Renders all files in the context to their final formatted form.
   *
   * This is the main rendering method that orchestrates the collation and
   * formatting of all generated files. It processes files through Biome
   * formatting (if configured), resolves paths, and produces the final
   * artifacts ready for writing to the filesystem.
   *
   * @returns Promise resolving to render result containing artifacts, file metadata, previews, and mappings
   *
   * @example
   * ```typescript
   * const renderContext = new RenderContext({
   *   files: generatedFiles,
   *   previews: previewData,
   *   mappings: mappingData,
   *   prettierConfig: { semi: false, singleQuote: true },
   *   basePath: './src/generated',
   *   stackTrail: traceStack,
   *   logger: logger,
   *   captureCurrentResult: resultHandler
   * });
   *
   * const result = await renderContext.render();
   *
   * // Access rendered files
   * Object.entries(result.artifacts).forEach(([path, content]) => {
   *   console.log(`Rendered ${path}: ${result.files[path].lines} lines`);
   * });
   * ```
   */
  render(stackTrail: StackTrail): Omit<RenderResult, 'results'> {
    const result = this.collate(stackTrail)

    const rendered: Omit<RenderResult, 'results'> = {
      artifacts: result.artifacts,
      files: result.files,
      previews: this.previews,
      mappings: this.mappings
    }

    return rendered
  }

  /**
   * Collates all files in the context into a unified render result.
   *
   * This method processes each file in the context through the rendering pipeline,
   * applying Biome formatting and path resolution. It coordinates the parallel
   * processing of all files and aggregates the results into a single output structure.
   *
   * The collation process includes:
   * - File content rendering with optional Biome formatting
   * - Path resolution using base path configuration
   * - Metadata calculation (line count, character count)
   * - Result aggregation into artifacts and file metadata maps
   *
   * @returns Promise resolving to collated files with artifacts and metadata
   *
   * @example
   * ```typescript
   * const collated = await renderContext.collate();
   *
   * // Access rendered file content
   * console.log(collated.artifacts['/path/to/file.ts']);
   *
   * // Access file metadata
   * console.log(collated.files['/path/to/file.ts'].lines);
   * console.log(collated.files['/path/to/file.ts'].characters);
   * ```
   */
  collate(stackTrail: StackTrail): FilesRenderResult {
    const fileEntries = Array.from(this.files.entries())

    const fileObjects: FileObject[] = fileEntries
      .map(([destinationPath, file]) => {
        return stackTrail.trace(destinationPath, st => {
          const renderedFile: FileObject = renderFile({
            content: file.toString(),
            destinationPath,
            basePath: this.basePath,
            prettierConfig: this.#prettierConfig
          })

          this.captureCurrentResult('success', st)

          return renderedFile
        })
      })
      .filter(fileObject => fileObject !== undefined)

    const output: FilesRenderResult = {
      artifacts: {},
      files: {}
    }

    for (const fileObject of fileObjects) {
      output.artifacts[fileObject.path] = fileObject.content
      output.files[fileObject.path] = {
        destinationPath: fileObject.destinationPath,
        lines: fileObject.lines,
        characters: fileObject.characters
      }
    }

    return output
  }

  /**
   * Retrieves a file from the context by its normalized path.
   *
   * This method looks up a file in the context's file map using path normalization
   * to ensure consistent path resolution. It validates that the requested file
   * exists and throws an error if not found.
   *
   * @param filePath - The file path to retrieve (will be normalized)
   * @returns The File or JsonFile instance
   * @throws {Error} When the file is not found in the context
   *
   * @example
   * ```typescript
   * const file = renderContext.getFile('./src/models/User.ts');
   * console.log(file.toString()); // Access file content
   *
   * // Works with various path formats
   * const sameFile = renderContext.getFile('src/models/User.ts');
   * const alsoSameFile = renderContext.getFile('/absolute/path/src/models/User.ts');
   * ```
   */
  getFile(filePath: string): File | JsonFile {
    const normalisedPath = normalize(filePath)

    const currentFile = this.files.get(normalisedPath)

    invariant(currentFile, `File not found during render phase: ${normalisedPath}`)

    return currentFile
  }

  /**
   * Picks a specific definition from a file in the context.
   *
   * This method retrieves a named definition (type, interface, etc.) from
   * a specific file in the context. It validates that the target file is
   * a File type (not JsonFile) and returns the requested definition if found.
   *
   * @param args - Object containing the definition name and export path
   * @param args.name - The name of the definition to retrieve
   * @param args.exportPath - The path to the file containing the definition
   * @returns The Definition instance if found, undefined otherwise
   * @throws {Error} When the file is not found or is not a File type
   *
   * @example
   * ```typescript
   * const userDefinition = renderContext.pick({
   *   name: 'User',
   *   exportPath: './src/models/User.ts'
   * });
   *
   * if (userDefinition) {
   *   console.log(userDefinition.identifier); // Access definition details
   * }
   *
   * // Pick interface definition
   * const apiInterface = renderContext.pick({
   *   name: 'ApiResponse',
   *   exportPath: './src/types/api.ts'
   * });
   * ```
   */
  pick({ name, exportPath }: PickArgs): Definition | undefined {
    const file = this.getFile(exportPath)

    invariant(file instanceof File, `File at "${exportPath}" is not a "File" type`)

    return file.definitions.get(name)
  }
}

/**
 * Arguments for rendering a single file.
 */
type RenderFileArgs = {
  /** The raw file content to render */
  content: string
  /** The destination path for the file */
  destinationPath: string
  /** Optional base path for path resolution */
  basePath?: string
  /** Optional formatter configuration (using Prettier format for compatibility) */
  prettierConfig?: PrettierConfigType
}

/**
 * Renders a single file with formatting and metadata calculation.
 *
 * This function processes a single file through the rendering pipeline,
 * applying Biome formatting if configured and calculating file metadata
 * such as line count and character count. It resolves the final path using
 * the base path configuration.
 *
 * @param args - File rendering arguments
 * @returns Promise resolving to a FileObject with content and metadata
 *
 * @example
 * ```typescript
 * const fileObject = await renderFile({
 *   content: 'const x = 1;',
 *   destinationPath: 'utils.ts',
 *   basePath: './src',
 *   prettierConfig: { semi: false }
 * });
 *
 * console.log(fileObject.path); // './src/utils.ts'
 * console.log(fileObject.content); // 'const x = 1' (formatted)
 * console.log(fileObject.lines); // 1
 * console.log(fileObject.characters); // 11
 * ```
 */
const renderFile = ({ content, destinationPath, basePath }: RenderFileArgs): FileObject => {
  const path = toResolvedArtifactPath({ basePath, destinationPath })

  return {
    content: content,
    path,
    destinationPath,
    lines: content.split('\n').length,
    characters: content.length
  }
}
