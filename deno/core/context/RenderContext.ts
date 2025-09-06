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
 *       logger: this.logger,
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
  files: Map<string, File | JsonFile>
  previews: Record<string, Record<string, Preview>>
  mappings: Record<string, Record<string, Mapping>>
  #prettierConfig?: PrettierConfigType
  basePath: string | undefined
  logger: log.Logger
  #stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
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
    this.logger = logger
    this.#stackTrail = stackTrail
    this.captureCurrentResult = captureCurrentResult
  }

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

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.#stackTrail, token, fn, this.logger)
  }

  getFile(filePath: string): File | JsonFile {
    const normalisedPath = normalize(filePath)

    const currentFile = this.files.get(normalisedPath)

    invariant(currentFile, `File not found during render phase: ${normalisedPath}`)

    return currentFile
  }

  pick({ name, exportPath }: PickArgs): Definition | undefined {
    const file = this.getFile(exportPath)

    invariant(file instanceof File, `File at "${exportPath}" is not a "File" type`)

    return file.definitions.get(name)
  }
}

type RenderFileArgs = {
  content: string
  destinationPath: string
  basePath?: string
  prettierConfig?: PrettierConfigType
}

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
