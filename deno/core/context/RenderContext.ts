import invariant from 'npm:tiny-invariant@1.3.3'
import type { FilesRenderResult, RenderResult } from './generateTypes.ts'
import { normalize } from '@std/path/normalize'
import type { DefinitionBase } from '@/dsl/Definition.ts'
import type { PickArgs } from './generateTypes.ts'
import type { ResultType } from '@/types/Results.ts'
import { toResolvedArtifactPath } from '@/helpers/toResolvedArtifactPath.ts'
import type * as log from '@std/log'
import type { Logger } from '@/types/Logger.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import type { Preview, Mapping } from '@/types/Preview.ts'
import type { JsonFile } from '@/dsl/JsonFile.ts'
import type { StackTrail } from './StackTrail.ts'
import { CaptureSink, type CaptureChannel } from '@/anchors/CaptureSink.ts'
import { postPass } from '@/anchors/postPass.ts'
import { entriesForSidecar } from '@/anchors/generationMap.ts'
import type { GenerationMapEntry } from '@/anchors/generationMap.ts'
import type { AttributionState } from '@/types/AttributionState.ts'
import type { Sidecar } from '@/anchors/sidecar.ts'
import type { Span } from '@/anchors/types.ts'

/**
 * One file's render output retained for the attribution post-pass:
 * the file's own path, the rendered text, and the byte spans the
 * `CaptureSink` resolved. Populated by {@link RenderContext.collate}
 * during the single capture render, consumed by {@link RenderContext.render}.
 */
type FileCapture = {
  destinationPath: string
  filePath: string
  source: string
  spans: Span[]
}

/**
 * Result of the render phase: artifacts + file metadata + previews +
 * mappings, plus the attribution sidecars / generation-map when the run
 * configured `attribution.postPass`.
 */
type RenderPhaseResult = Omit<RenderResult, 'results'> & {
  sidecars?: Record<string, Sidecar>
  generationMap?: GenerationMapEntry[]
}

/**
 * Constructor arguments for {@link RenderContext}.
 */
type ConstructorArgs = {
  /** Map of generated files to render */
  files: Map<string, FileBase>
  /** Preview data for generated content */
  previews: Record<string, Preview>
  /** Mapping data for file relationships */
  mappings: Record<string, Mapping>
  /** Base path for resolving file paths */
  basePath: string | undefined
  /** Logger instance for debug information */
  logger: log.Logger
  /** Function to capture result status */
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
  /**
   * Attribution (gen-maps) emission config. When `postPass` is set, the
   * single render pass also captures the producer occurrence tree and
   * emits sidecars + a generation map. Capture is skipped entirely when
   * absent — plain render, the capture interval never opens.
   */
  attribution?: AttributionState
  /**
   * Shared attribution capture channel — the same object the run's
   * `GenerateContext` holds, so snippets see the sink this context
   * publishes during the capturing render. Wired by `CoreContext`.
   */
  captureChannel?: CaptureChannel
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
  files: Map<string, FileBase>
  /** Preview data for generated content */
  previews: Record<string, Preview>
  /** Mapping data for file relationships */
  mappings: Record<string, Mapping>
  /** Base path for resolving file paths */
  basePath: string | undefined
  /** Logger instance for debug information */
  logger: Logger
  /** Function to capture result status */
  captureCurrentResult: (result: ResultType, stackTrail: StackTrail) => void
  /** Attribution (gen-maps) emission config; see {@link ConstructorArgs}. */
  attribution: AttributionState | undefined
  /**
   * Shared attribution capture channel — the same object the
   * `GenerateContext` exposes to snippets as `captureSink`. `render` opens
   * the capture interval by setting `channel.sink` and closes it in
   * `finally`. Optional: a capturing render without a channel records no
   * occurrences (snippets read their own context's channel).
   */
  #captureChannel: CaptureChannel | undefined

  /**
   * Active capture sink for the in-progress render pass, or `undefined`
   * when rendering without attribution. `collate` checks this to decide
   * whether to capture; set + cleared by `render`.
   */
  #sink: CaptureSink | undefined
  /**
   * Per-file render output retained during a capturing render, consumed
   * by `render` to build sidecars. Reset each capturing render.
   */
  #captures: FileCapture[] = []

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
    basePath,
    logger,
    captureCurrentResult,
    attribution,
    captureChannel
  }: ConstructorArgs) {
    this.files = files
    this.previews = previews
    this.mappings = mappings
    this.basePath = basePath
    this.logger = logger
    this.captureCurrentResult = captureCurrentResult
    this.attribution = attribution
    this.#captureChannel = captureChannel
  }

  /**
   * Renders all files in the context to their final form.
   *
   * This is the main rendering method that orchestrates the collation of
   * all generated files. It resolves paths and produces the final
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
  render(stackTrail: StackTrail): RenderPhaseResult {
    const postPassConfig = this.attribution?.postPass

    // No emission configured → plain render, no capture: the capture
    // interval never opens, so every snippet's `toString` wrapper takes
    // the pass-through path.
    if (!postPassConfig) {
      const result = this.collate(stackTrail)
      return {
        artifacts: result.artifacts,
        files: result.files,
        previews: this.previews,
        mappings: this.mappings
      }
    }

    // Capturing render: open the capture interval by publishing a sink on
    // the shared channel for the single `collate` walk, and close it in
    // `finally`. Snippets' self-installed `toString` wrappers observe into
    // the sink; `collate` routes each File's render through it.
    const sink = new CaptureSink()
    this.#sink = sink
    this.#captures = []
    if (this.#captureChannel) {
      this.#captureChannel.sink = sink
    }

    let result: FilesRenderResult
    try {
      result = this.collate(stackTrail)
    } finally {
      if (this.#captureChannel) {
        this.#captureChannel.sink = undefined
      }
      this.#sink = undefined
    }

    // Build one sidecar per captured File from the spans the sink
    // resolved (no re-render, no `toString`). Keyed by destination path,
    // matching the file map. Accumulate the flat generation map.
    const { parser, schemaSrc, generatorMeta } = postPassConfig
    const sidecars: Record<string, Sidecar> = {}
    const generationMap: GenerationMapEntry[] = []
    for (const capture of this.#captures) {
      const sidecar = postPass({
        filePath: capture.filePath,
        source: capture.source,
        spans: capture.spans,
        schemaSrc,
        parser,
        generatorMeta
      })
      sidecars[capture.destinationPath] = sidecar
      generationMap.push(...entriesForSidecar(sidecar))
    }
    this.#captures = []

    return {
      artifacts: result.artifacts,
      files: result.files,
      previews: this.previews,
      mappings: this.mappings,
      sidecars,
      generationMap
    }
  }

  /**
   * Collates all files in the context into a unified render result.
   *
   * This method processes each file in the context through the rendering pipeline,
   * applying path resolution. It coordinates the parallel processing of all files
   * and aggregates the results into a single output structure.
   *
   * The collation process includes:
   * - File content rendering
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
          // When capturing, route a File's render through the sink so the
          // occurrence tree + spans are recorded for this one render.
          // JsonFile (and the non-capturing path) render plainly — the
          // installed wrapper is inert while the sink is not in a
          // `captureFile` call.
          let content: string
          if (this.#sink && file instanceof CodeFileBase) {
            const captured = this.#sink.captureFile(() => file.toString())
            content = captured.text
            this.#captures.push({
              destinationPath,
              filePath: file.path,
              source: captured.text,
              spans: captured.spans
            })
          } else {
            content = file.toString()
          }

          const renderedFile: FileObject = renderFile({
            content,
            destinationPath,
            basePath: this.basePath
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
  getFile(filePath: string): FileBase {
    const normalizedPath = normalize(filePath)

    const currentFile = this.files.get(normalizedPath)

    invariant(currentFile, `File not found during render phase: ${normalizedPath}`)

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
  pick({ name, exportPath }: PickArgs): DefinitionBase | undefined {
    const file = this.getFile(exportPath)

    invariant(file instanceof CodeFileBase, `File at "${exportPath}" is not a code file`)

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
}

/**
 * Renders a single file with metadata calculation.
 *
 * This function processes a single file through the rendering pipeline,
 * calculating file metadata such as line count and character count. It
 * resolves the final path using the base path configuration.
 *
 * @param args - File rendering arguments
 * @returns A FileObject with content and metadata
 *
 * @example
 * ```typescript
 * const fileObject = renderFile({
 *   content: 'const x = 1;',
 *   destinationPath: 'utils.ts',
 *   basePath: './src'
 * });
 *
 * console.log(fileObject.path); // './src/utils.ts'
 * console.log(fileObject.content); // 'const x = 1;'
 * console.log(fileObject.lines); // 1
 * console.log(fileObject.characters); // 12
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
