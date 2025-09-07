import * as Sentry from 'npm:@sentry/node@^10.8.0'
import type { PrettierConfigType } from '../types/PrettierConfig.ts'
import invariant from 'npm:tiny-invariant@1.3.3'
import type { FilesRenderResult, RenderResult } from './types.ts'
import { normalize } from '@std/path/normalize'
import type { Definition } from '../dsl/Definition.ts'
import type { PickArgs } from './GenerateContext.ts'
import type { ResultType } from '../types/Results.ts'
import { toResolvedArtifactPath } from '../helpers/toResolvedArtifactPath.ts'
import { tracer } from '../helpers/tracer.ts'
import type { StackTrail } from './StackTrail.ts'
import type * as log from '@std/log'
import { File } from '../dsl/File.ts'
import type { Preview, Mapping } from '../types/Preview.ts'
import * as prettier from 'npm:prettier@^3.6.2'
import type { JsonFile } from '../dsl/JsonFile.ts'

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
  /** Optional Prettier configuration for code formatting */
  prettierConfig?: PrettierConfigType
  /** Base path for resolving file paths */
  basePath: string | undefined
  /** Stack trail for distributed tracing */
  stackTrail: StackTrail
  /** Logger instance for debug information */
  logger: log.Logger
  /** Function to capture result status */
  captureCurrentResult: (result: ResultType) => void
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

/**
 * The rendering context for the final phase of the SKMTC transformation pipeline.
 * 
 * `RenderContext` is responsible for taking the generated artifacts from the generation
 * phase and rendering them into their final form with proper formatting, path resolution,
 * and file preparation. It handles code formatting via Prettier, path normalization,
 * and produces the final artifacts ready for writing to the filesystem.
 * 
 * This context represents the culmination of the three-phase SKMTC pipeline, transforming
 * generator outputs into production-ready code files with proper formatting and structure.
 * 
 * ## Key Features
 * 
 * - **Code Formatting**: Automatic Prettier formatting for generated TypeScript/JavaScript code
 * - **Path Resolution**: Intelligent path resolution with base path support
 * - **Content Collation**: Combines all generated content into organized file structures
 * - **Metadata Generation**: Tracks file statistics (lines, characters) and relationships
 * - **Error Tracking**: Comprehensive error handling with Sentry integration
 * - **Performance Monitoring**: Built-in tracing and performance measurement
 * 
 * @example Basic rendering usage
 * ```typescript
 * import { RenderContext } from '@skmtc/core';
 * 
 * const renderContext = new RenderContext({
 *   files: generatedFiles,
 *   previews: previewData,
 *   mappings: mappingData,
 *   prettierConfig: {
 *     semi: false,
 *     singleQuote: true,
 *     trailingComma: 'all'
 *   },
 *   basePath: './src/generated',
 *   stackTrail: traceStack,
 *   logger: myLogger,
 *   captureCurrentResult: (result) => console.log(result)
 * });
 * 
 * const rendered = await renderContext.render();
 * 
 * // Access rendered files
 * Object.entries(rendered.artifacts).forEach(([path, content]) => {
 *   console.log(`Rendered ${path}: ${rendered.files[path].lines} lines`);
 *   // Write to filesystem
 *   await Deno.writeTextFile(path, content);
 * });
 * ```
 * 
 * @example With custom Prettier configuration
 * ```typescript
 * const renderContext = new RenderContext({
 *   files: generatedFiles,
 *   previews: {},
 *   mappings: {},
 *   prettierConfig: {
 *     parser: 'typescript',
 *     printWidth: 120,
 *     tabWidth: 2,
 *     semi: true,
 *     singleQuote: true,
 *     trailingComma: 'es5',
 *     bracketSpacing: true,
 *     arrowParens: 'avoid'
 *   },
 *   basePath: './packages/api-client/src',
 *   stackTrail: stack,
 *   logger: logger,
 *   captureCurrentResult: resultHandler
 * });
 * 
 * const result = await renderContext.render();
 * 
 * // All TypeScript files are automatically formatted
 * console.log('Formatted files:', Object.keys(result.artifacts).length);
 * ```
 * 
 * @example Processing render results
 * ```typescript
 * const rendered = await renderContext.render();
 * 
 * // Analyze file statistics
 * const totalLines = Object.values(rendered.files)
 *   .reduce((sum, file) => sum + file.lines, 0);
 * const totalChars = Object.values(rendered.files)
 *   .reduce((sum, file) => sum + file.characters, 0);
 * 
 * console.log(`Generated ${Object.keys(rendered.artifacts).length} files`);
 * console.log(`Total lines: ${totalLines}`);
 * console.log(`Total characters: ${totalChars}`);
 * 
 * // Check for large files
 * const largeFiles = Object.entries(rendered.files)
 *   .filter(([_, metadata]) => metadata.lines > 1000)
 *   .map(([path, metadata]) => ({ path, lines: metadata.lines }));
 * 
 * if (largeFiles.length > 0) {
 *   console.log('Large files detected:', largeFiles);
 * }
 * 
 * // Access preview and mapping data
 * console.log('Previews available:', Object.keys(rendered.previews));
 * console.log('Mappings available:', Object.keys(rendered.mappings));
 * ```
 * 
 * @example Integration with CoreContext
 * ```typescript
 * // Typically used within CoreContext.toArtifacts()
 * class CustomCoreContext extends CoreContext {
 *   async renderWithPostProcessing(
 *     files: Map<string, File | JsonFile>,
 *     previews: Record<string, Record<string, Preview>>,
 *     mappings: Record<string, Record<string, Mapping>>
 *   ) {
 *     const renderContext = new RenderContext({
 *       files,
 *       previews,
 *       mappings,
 *       prettierConfig: this.prettierConfig,
 *       basePath: this.settings?.basePath,
 *       stackTrail: this.stackTrail,
 *       logger: this.#logger,
 *       captureCurrentResult: this.captureCurrentResult.bind(this)
 *     });
 *     
 *     const rendered = await renderContext.render();
 *     
 *     // Post-process rendered files
 *     const processedArtifacts: Record<string, string> = {};
 *     
 *     for (const [path, content] of Object.entries(rendered.artifacts)) {
 *       // Add file headers, license notices, etc.
 *       const processedContent = this.addFileHeader(content, path);
 *       processedArtifacts[path] = processedContent;
 *     }
 *     
 *     return {
 *       ...rendered,
 *       artifacts: processedArtifacts
 *     };
 *   }
 * }
 * ```
 * 
 * @example Error handling during rendering
 * ```typescript
 * try {
 *   const renderContext = new RenderContext({
 *     files: generatedFiles,
 *     previews: {},
 *     mappings: {},
 *     prettierConfig: prettierConfig,
 *     basePath: './invalid-path', // This might cause issues
 *     stackTrail: stack,
 *     logger: logger,
 *     captureCurrentResult: (result) => {
 *       if (result === 'error') {
 *         console.error('Render error detected');
 *       }
 *     }
 *   });
 *   
 *   const result = await renderContext.render();
 *   
 *   // Check if any files failed to render
 *   const failedFiles = Object.entries(result.files)
 *     .filter(([path, metadata]) => metadata.lines === 0)
 *     .map(([path]) => path);
 *   
 *   if (failedFiles.length > 0) {
 *     console.warn('Files with no content:', failedFiles);
 *   }
 *   
 * } catch (error) {
 *   console.error('Render operation failed:', error);
 *   // Sentry automatically captures the error
 * }
 * ```
 */
export class RenderContext {
  /** Map of generated files to render */
  files: Map<string, File | JsonFile>
  /** Preview data for generated content */
  previews: Record<string, Record<string, Preview>>
  /** Mapping data for file relationships */
  mappings: Record<string, Record<string, Mapping>>
  /** Optional Prettier configuration for code formatting */
  #prettierConfig?: PrettierConfigType
  /** Base path for resolving file paths */
  basePath: string | undefined
  /** Logger instance for debug information */
  #logger: log.Logger
  /** Stack trail for distributed tracing */
  #stackTrail: StackTrail
  /** Function to capture result status */
  captureCurrentResult: (result: ResultType) => void
  
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
    stackTrail,
    captureCurrentResult
  }: ConstructorArgs) {
    this.files = files
    this.previews = previews
    this.mappings = mappings
    this.#prettierConfig = prettierConfig
    this.basePath = basePath
    this.#logger = logger
    this.#stackTrail = stackTrail
    this.captureCurrentResult = captureCurrentResult
  }

  /**
   * Renders all files in the context to their final formatted form.
   * 
   * This is the main rendering method that orchestrates the collation and
   * formatting of all generated files. It processes files through Prettier
   * formatting (if configured), resolves paths, and produces the final
   * artifacts ready for writing to the filesystem.
   * 
   * The method is wrapped in Sentry tracing spans for performance monitoring
   * and includes both collation and artifact preparation phases.
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
  async render(): Promise<Omit<RenderResult, 'results'>> {
    return await Sentry.startSpan({ name: 'Render artifacts' }, async () => {
      const result = await Sentry.startSpan({ name: 'Collate content' }, async () => {
        return await this.collate()
      })

      const rendered: Omit<RenderResult, 'results'> = {
        artifacts: result.artifacts,
        files: result.files,
        previews: this.previews,
        mappings: this.mappings
      }

      return rendered
    })
  }

  /**
   * Collates all files in the context into a unified render result.
   * 
   * This method processes each file in the context through the rendering pipeline,
   * applying Prettier formatting and path resolution. It coordinates the parallel
   * processing of all files and aggregates the results into a single output structure.
   * 
   * The collation process includes:
   * - File content rendering with optional Prettier formatting
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
  async collate(): Promise<FilesRenderResult> {
    const fileEntries = Array.from(this.files.entries())

    const fileObjectPromises: Promise<FileObject>[] = fileEntries
      .map(([destinationPath, file]) => {
        return this.trace(destinationPath, () => {
          const renderedFile: Promise<FileObject> = renderFile({
            content: file.toString(),
            destinationPath,
            basePath: this.basePath,
            prettierConfig: this.#prettierConfig
          })

          this.captureCurrentResult('success')

          return renderedFile
        })
      })
      .filter(fileObject => fileObject !== undefined)

    const fileObjects = await Promise.all(fileObjectPromises)

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
   * Executes a function within a tracing context for performance monitoring.
   * 
   * This method wraps function execution with distributed tracing capabilities,
   * allowing performance monitoring and debugging of the rendering pipeline.
   * It integrates with the stack trail to provide hierarchical tracing.
   * 
   * @template T - The return type of the traced function
   * @param token - Trace identifier (string or array of strings)
   * @param fn - Function to execute within the trace context
   * @returns The result of executing the traced function
   * 
   * @example
   * ```typescript
   * const result = renderContext.trace('format-file', () => {
   *   return prettier.format(content, prettierConfig);
   * });
   * 
   * // With hierarchical tracing
   * const result = renderContext.trace(['render', 'format'], () => {
   *   return complexFormattingOperation();
   * });
   * ```
   */
  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.#stackTrail, token, fn, this.#logger)
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
  /** Optional Prettier configuration for formatting */
  prettierConfig?: PrettierConfigType
}

/**
 * Renders a single file with formatting and metadata calculation.
 * 
 * This function processes a single file through the rendering pipeline,
 * applying Prettier formatting if configured and calculating file metadata
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
const renderFile = async ({
  content,
  destinationPath,
  basePath,
  prettierConfig
}: RenderFileArgs): Promise<FileObject> => {
  const path = toResolvedArtifactPath({ basePath, destinationPath })

  const formatted = prettierConfig
    ? await prettier.format(content, { ...prettierConfig, parser: 'typescript' })
    : content

  return {
    content: formatted,
    path,
    destinationPath,
    lines: formatted.split('\n').length,
    characters: formatted.length
  }
}
