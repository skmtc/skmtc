import { GenerateContext } from '@/context/GenerateContext.ts'
import { RenderContext } from '@/context/RenderContext.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import type { OasDocument } from '@/oas/document/Document.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { ResultType } from '@/types/Results.ts'
import * as log from '@std/log'
import type { Logger } from '@/types/Logger.ts'
import { ResultsHandler } from '@/context/ResultsHandler.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { ResultsLog } from '@/helpers/ResultsLog.ts'
import type { File } from '@/dsl/File.ts'
import { join } from '@std/path/join'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { Mapping, Preview } from '@/types/Preview.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { JsonFile } from '@/dsl/JsonFile.ts'
import type { ToArtifactsResult } from './generateTypes.ts'
import { bold, gray, red, yellow, blue } from '@std/fmt/colors'
import type { SkmtcParsedDocument, SkmtcDocumentInput } from '@/types/SkmtcDocument.ts'
import type { AttributionState } from '@/types/AttributionState.ts'
import type { SupportedSubjects } from '@/types/SupportedSubjects.ts'
import type { ParseIssue } from '@/context/ParseIssue.ts'

/**
 * Represents the parse phase of the SKMTC pipeline.
 *
 * The parse phase converts OpenAPI v3 JSON documents into internal OAS objects,
 * handling schema validation, reference resolution, and data transformation.
 */
export type ParsePhase = {
  /** Identifies this as the parse phase */
  type: 'parse'
  /** The unified parse context — handles both OAS and GQL via its
   * internal protocol-discriminated state. */
  context: ParseContext
}

/**
 * Represents the generate phase of the SKMTC pipeline.
 *
 * The generate phase transforms parsed OAS objects into generator-specific artifacts,
 * applying templates, handling references, and preparing output files.
 */
export type GeneratePhase = {
  /** Identifies this as the generate phase */
  type: 'generate'
  /** The generate context for artifact creation and processing */
  context: GenerateContext
}

/**
 * Represents the render phase of the SKMTC pipeline.
 *
 * The render phase takes generator artifacts and renders them to formatted files,
 * applying code formatting, file system operations, and final output generation.
 */
export type RenderPhase = {
  /** Identifies this as the render phase */
  type: 'render'
  /** The render context for file output and formatting */
  context: RenderContext
}

/**
 * Union type representing any phase of the SKMTC pipeline execution.
 *
 * Each execution phase contains its type identifier and associated context,
 * allowing for type-safe phase handling and context access throughout the pipeline.
 */
export type ExecutionPhase = ParsePhase | GeneratePhase | RenderPhase

type GenerateArgs = {
  document: SkmtcParsedDocument
  settings: ClientSettings | undefined
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
}

type CoreContextArgs = {
  spanId: string
  logsPath?: string
  silent: boolean
}

type RenderArgs = {
  files: Map<string, File | JsonFile>
  previews: Record<string, Preview>
  mappings: Record<string, Mapping>
  basePath: string | undefined
  attribution: AttributionState | undefined
}

/**
 * Arguments for the `toArtifacts` method of CoreContext.
 *
 * Contains all the necessary configuration for transforming a
 * source document into code artifacts through the SKMTC parse +
 * generate + render phases.
 *
 * On the OAS side `document.value` is the *raw* OpenAPI v3 document —
 * `CoreContext.toArtifacts` runs the parse phase itself. On the GQL
 * side `document.value` is a pre-parsed {@link GqlDocument}, since SDL
 * parsing lives in the `parsers/graphql` sub-export to keep the
 * `graphql` npm dependency optional for consumers.
 */
export type ToArtifactsArgs = {
  /** Stack trail for distributed tracing */
  stackTrail: StackTrail
  /**
   * Source document. OAS variant carries the raw OpenAPI v3 JSON; GQL
   * variant carries a pre-parsed {@link GqlDocument}. The generate
   * phase reads the post-parse {@link SkmtcDocument}; both model and
   * operation generators dispatch on `document.type`.
   */
  document: SkmtcDocumentInput
  /** Client settings for customization (optional) */
  settings: ClientSettings | undefined
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  /** Whether to suppress console output */
  silent: boolean
  /**
   * Optional attribution (gen-maps) **emission** config. Capture is
   * always on; when `postPass` is set, the pipeline emits sidecars + a
   * generation map alongside the usual artifacts. See
   * {@link AttributionState}.
   */
  attribution?: AttributionState
}

type SetupLoggerArgs = {
  spanId: string
  logsPath?: string
}

/**
 * The main orchestration class for the SKMTC transformation pipeline.
 *
 * `CoreContext` manages the three-phase process of transforming OpenAPI v3 documents
 * into code artifacts. It coordinates parsing, generation, and rendering phases while
 * providing logging, tracing, and error handling capabilities.
 *
 * ## Pipeline Phases
 *
 * 1. **Parse Phase**: Uses {@link ParseContext} to convert OpenAPI JSON into OAS objects
 * 2. **Generate Phase**: Uses {@link GenerateContext} to transform OAS objects with generators
 * 3. **Render Phase**: Uses {@link RenderContext} to format and prepare final artifacts
 *
 * @example Basic usage
 * ```typescript
 * import { CoreContext } from '@skmtc/core';
 *
 * const context = new CoreContext({
 *   spanId: 'user-api-generation',
 *   logsPath: './logs',
 *   silent: false
 * });
 *
 * const result = await context.toArtifacts({
 *   document: { type: 'oas', value: openApiDoc },
 *   settings: clientSettings,
 *   toGeneratorConfigMap: () => generators,
 *   silent: false,
 *   stackTrail: new StackTrail(['gen'])
 * });
 * ```
 *
 * @example Using individual phases
 * ```typescript
 * const context = new CoreContext({
 *   spanId: 'custom-pipeline',
 *   silent: true
 * });
 *
 * // Parse phase only
 * const { oasDocument } = context.parse(openApiDoc);
 *
 * // Then use document for custom processing
 * console.log('Parsed schemas:', Object.keys(oasDocument.components.schemas));
 * ```
 */
export class CoreContext {
  /** Logger instance for the context */
  logger: Logger

  /** Current execution phase for pipeline tracking */
  #phase: ExecutionPhase | undefined

  /** Results log for tracking generation outcomes */
  #results: ResultsLog

  /** Whether to suppress console output */
  silent: boolean

  /**
   * Creates a new CoreContext instance.
   *
   * @param args - Configuration for the context
   * @param args.spanId - Unique identifier for this transformation span
   * @param args.logsPath - Optional directory path for log files
   * @param args.silent - Whether to suppress console output
   *
   * @example
   * ```typescript
   * // Basic context with console logging
   * const context = new CoreContext({
   *   spanId: 'my-generation',
   *   silent: false
   * });
   *
   * // Context with file logging
   * const context = new CoreContext({
   *   spanId: 'batch-job-123',
   *   logsPath: './logs/generation',
   *   silent: true
   * });
   * ```
   */
  constructor({ spanId, logsPath, silent }: CoreContextArgs) {
    this.#results = new ResultsLog()

    this.logger = this.#setupLogger({ spanId, logsPath })

    this.silent = silent
  }

  #setupLogger({ spanId, logsPath }: SetupLoggerArgs) {
    const filename = join(logsPath ?? '', `${spanId}.txt`)

    log.setup({
      handlers: {
        [`${spanId}-logs`]: new log.ConsoleHandler('DEBUG', {
          formatter: logRecord =>
            skmtcFormatter({
              logRecord,
              stackTrail: 'SKIPPED'
            }),
          useColors: true
        }),
        ...(logsPath && {
          file: new log.FileHandler('DEBUG', {
            filename,
            // JSON format for file logs (easier to parse and analyze)
            formatter: logRecord => {
              return skmtcJsonFormatter({
                logRecord,
                stackTrail: 'SKIPPED'
              })
            }
          })
        }),
        [`${spanId}-results`]: new ResultsHandler('WARN', {
          formatter: ({ levelName }) => levelName,
          context: this
        })
      },
      loggers: {
        [spanId]: {
          level: 'DEBUG',
          handlers: [`${spanId}-logs`, `${spanId}-results`, 'file']
        }
      }
    })

    return log.getLogger(spanId)
  }

  /**
   * Parses an OpenAPI v3 document into internal OAS objects.
   *
   * This method executes only the parse phase of the pipeline, converting
   * the raw OpenAPI JSON into structured OAS objects that can be used for
   * generation or custom processing.
   *
   * @param documentObject - The OpenAPI v3 document to parse
   * @returns An object containing the parsed OAS document
   *
   * @example
   * ```typescript
   * import { CoreContext } from '@skmtc/core';
   *
   * const context = new CoreContext({
   *   spanId: 'parse-only',
   *   silent: true
   * });
   *
   * const { oasDocument } = context.parse(openApiDoc);
   *
   * // Access parsed components
   * console.log('Models:', Object.keys(oasDocument.components.schemas));
   * console.log('Paths:', Object.keys(oasDocument.paths));
   *
   * // Use for custom processing
   * const userModel = oasDocument.components.schemas['User'];
   * if (userModel && !userModel.isRef()) {
   *   console.log('User properties:', Object.keys(userModel.properties));
   * }
   * ```
   */
  parse(documentObject: OpenAPIV3.Document, stackTrail: StackTrail): { oasDocument: OasDocument } {
    this.#phase = this.#setupParsePhase({ type: 'oas', value: documentObject })

    const parsed = this.#phase.context.parse(stackTrail)
    if (parsed.type !== 'oas') {
      // Unreachable: input was tagged 'oas' so the parsed branch must match.
      throw new Error('CoreContext.parse: expected OAS parsed document')
    }

    return {
      oasDocument: parsed.value
    }
  }

  /**
   * Executes the complete transformation pipeline to generate code artifacts.
   *
   * This method orchestrates all three phases:
   * 1. **Parse**: Convert OpenAPI document to OAS objects
   * 2. **Generate**: Transform OAS objects using generators
   * 3. **Render**: Format and prepare final artifacts
   *
   * The result includes both the generated code files and comprehensive metadata
   * about the generation process, including file mappings, previews, and results.
   *
   * @param args - Configuration for the artifact generation
   * @param args.document - The source document, discriminated by protocol
   *   (`{ type: 'oas', value: OpenAPIV3.Document }` or
   *   `{ type: 'gql', value: GqlDocument }`)
   * @param args.settings - Client settings for customization
   * @param args.toGeneratorConfigMap - Function returning generator configuration
   * @param args.silent - Whether to suppress console output during generation
   * @param args.stackTrail - Stack trail for distributed tracing
   * @returns Promise resolving to rendered artifacts and metadata
   *
   * @example Complete pipeline
   * ```typescript
   * import { CoreContext, StackTrail, toModelEntry, toOasOperationEntry } from '@skmtc/core';
   *
   * const context = new CoreContext({
   *   spanId: 'api-client-gen',
   *   silent: false
   * });
   *
   * const result = context.toArtifacts({
   *   document: { type: 'oas', value: openApiDoc },
   *   settings: {
   *     basePath: './src/api'
   *   },
   *   toGeneratorConfigMap: () => ({
   *     'typescript-models': toModelEntry({
   *       id: 'typescript-models',
   *       transform: ({ context, refName, acc }) => acc
   *     }),
   *     'api-client': toOasOperationEntry({
   *       id: 'api-client',
   *       transform: ({ context, operation, acc }) => acc
   *     })
   *   }),
   *   silent: false,
   *   stackTrail: new StackTrail(['gen'])
   * });
   *
   * // Access generated artifacts
   * console.log('Generated files:', Object.keys(result.artifacts));
   *
   * // Write to filesystem
   * for (const [path, content] of Object.entries(result.artifacts)) {
   *   await Deno.writeTextFile(path, content);
   * }
   *
   * // Access metadata
   * console.log('Generation results:', result.results);
   * console.log('File mappings:', result.files);
   * ```
   *
   * @throws Will throw an error if any phase of the pipeline fails
   */
  toArtifacts({
    document,
    settings,
    toGeneratorConfigMap,
    stackTrail,
    attribution
  }: ToArtifactsArgs): ToArtifactsResult {
    try {
      // Parse phase: one unified ParseContext handles both protocols
      // via its internal protocol-discriminated state. `parse()` returns
      // a SkmtcParsedDocument; we collect issues from `context.issues`.
      const phase = this.#setupParsePhase(document)
      this.#phase = phase
      const parsedDocument: SkmtcParsedDocument = stackTrail.trace('parse', st =>
        phase.context.parse(st)
      )

      const { files, previews, mappings } = stackTrail.trace('generate', st => {
        this.#phase = this.#setupGeneratePhase({
          toGeneratorConfigMap,
          document: parsedDocument,
          settings
        })

        return this.#phase.context.toArtifacts(st)
      })

      // Render is a single capture pass: it renders each File once and,
      // when `attribution.postPass` is configured, simultaneously captures
      // the producer occurrence tree and emits sidecars + the generation
      // map (folded into `RenderContext.render`). No separate pre-render
      // post-pass, no re-render — the old `_rendered` cache that faked
      // "render once" across two passes is gone.
      const renderOutput = stackTrail.trace('render', st => {
        this.#phase = this.#setupRenderPhase({
          files,
          previews,
          mappings,
          basePath: settings?.basePath,
          attribution
        })

        return this.#phase.context.render(st)
      })

      return {
        ...renderOutput,
        results: this.#results.toTree(),
        parseIssues: phase.context.issues
      }
    } catch (error) {
      console.error(error)

      this.logger.error(error)

      // Surface the fatal error as a synthesized parse-issue so
      // downstream consumers (CLI `generate`, the manifest writer)
      // can tell a successful 0-file run apart from a crashed run.
      // Before this, the catch returned `parseIssues: []` and an
      // empty `artifacts`, which read on the CLI side as "everything
      // generated, just nothing emitted" — silent failure.
      //
      // We pull whatever parse-phase issues were already recorded
      // before the throw, so any incremental diagnostics aren't lost,
      // and append the top-level failure on the end. Protocol is
      // hardcoded to 'oas' because the synthesized issue is
      // post-protocol-dispatch and we don't have a discriminator at
      // this catch site; OAS is the more common case and the
      // location format ('toArtifacts') is unambiguous regardless.
      const priorIssues = this.#phase?.type === 'parse' ? this.#phase.context.issues : []
      const message = error instanceof Error ? error.message : String(error)
      const fatalIssue = {
        protocol: 'oas' as const,
        level: 'error' as const,
        type: 'INVALID_SCHEMA' as const,
        location: 'toArtifacts',
        message: `Top-level toArtifacts failure: ${message}`,
        cause: error
      }

      return {
        artifacts: {},
        files: {},
        previews: {},
        mappings: {},
        results: this.#results.toTree(),
        parseIssues: [...priorIssues, fatalIssue]
      }
    } finally {
      this.logger.handlers.forEach(handler => {
        if (handler instanceof log.FileHandler) {
          handler.flush()
        }
      })
    }
  }

  /**
   * Capability-only sibling of {@link toArtifacts}: parse the document, then
   * evaluate each generator's `isSupported` over its subjects — no transform,
   * no render. Returns the subjects each generator supports, plus parse issues.
   */
  toSupportedSubjects({
    document,
    settings,
    toGeneratorConfigMap,
    stackTrail
  }: Pick<
    ToArtifactsArgs,
    'document' | 'settings' | 'toGeneratorConfigMap' | 'stackTrail'
  >): { subjects: SupportedSubjects; parseIssues: ParseIssue[] } {
    try {
      const phase = this.#setupParsePhase(document)
      this.#phase = phase
      const parsedDocument: SkmtcParsedDocument = stackTrail.trace('parse', st =>
        phase.context.parse(st)
      )

      const subjects = stackTrail.trace('generate', () => {
        const generatePhase = this.#setupGeneratePhase({
          toGeneratorConfigMap,
          document: parsedDocument,
          settings
        })
        this.#phase = generatePhase

        return generatePhase.context.toSupportedSubjects()
      })

      return { subjects, parseIssues: phase.context.issues }
    } catch (error) {
      this.logger.error(error)

      const priorIssues = this.#phase?.type === 'parse' ? this.#phase.context.issues : []
      const message = error instanceof Error ? error.message : String(error)

      return {
        subjects: {},
        parseIssues: [
          ...priorIssues,
          {
            protocol: 'oas' as const,
            level: 'error' as const,
            type: 'INVALID_SCHEMA' as const,
            location: 'toSupportedSubjects',
            message: `Top-level toSupportedSubjects failure: ${message}`,
            cause: error
          }
        ]
      }
    }
  }

  #setupParsePhase(input: SkmtcDocumentInput): ParsePhase {
    const parseContext = new ParseContext({
      input,
      logger: this.logger,
      silent: this.silent
    })

    return { type: 'parse', context: parseContext }
  }

  #setupGeneratePhase({ document, settings, toGeneratorConfigMap }: GenerateArgs): GeneratePhase {
    const generateContext = new GenerateContext({
      document,
      settings,
      logger: this.logger,
      captureCurrentResult: this.captureCurrentResult.bind(this),
      toGeneratorConfigMap
    })

    return { type: 'generate', context: generateContext }
  }

  /**
   * Captures a result at the current execution position in the stack trail.
   *
   * This method records processing results (success, warning, error, etc.) at the
   * current location in the document traversal stack. Results are associated with
   * the current stack trail position, enabling detailed error reporting and
   * debugging of OpenAPI processing issues.
   *
   * @param result - The type of result to capture (success, warning, error, etc.)
   *
   * @example Capturing a warning result
   * ```typescript
   * context.captureCurrentResult('warning');
   * // Result captured at current stack position like: "components.schemas.User.properties.email"
   * ```
   *
   * @example Usage during schema processing
   * ```typescript
   * context.trace(['components', 'schemas', 'User'], () => {
   *   try {
   *     processUserSchema();
   *     context.captureCurrentResult('success');
   *   } catch (error) {
   *     context.captureCurrentResult('error');
   *   }
   * });
   * ```
   */
  captureCurrentResult(result: ResultType, stackTrail: StackTrail): void {
    this.#results.capture(stackTrail.toString(), result)
  }

  #setupRenderPhase({ files, previews, mappings, basePath, attribution }: RenderArgs): RenderPhase {
    const renderContext = new RenderContext({
      files,
      previews,
      mappings,
      basePath,
      logger: this.logger,
      captureCurrentResult: this.captureCurrentResult.bind(this),
      attribution
    })

    return { type: 'render', context: renderContext }
  }
}

/**
 * Arguments for the SKMTC log formatter.
 *
 * Contains the log record and stack trail information needed to format
 * human-readable log entries for the SKMTC processing pipeline.
 */
export type JsonFormatterArgs = {
  /** The Deno log record containing log level, message, and metadata */
  logRecord: {
    /** The log level name */
    levelName: string
    /** The timestamp when the log was created */
    datetime: Date
    /** The log message */
    msg: string
    /** Additional log arguments */
    args: unknown[]
  }
  /** String representation of the current stack trail position */
  stackTrail: string
}

/**
 * Custom pretty-print formatter for SKMTC log entries.
 *
 * Formats log records into human-readable, color-coded output with properly
 * formatted stack traces, making it easier to trace execution and debug issues
 * in the SKMTC pipeline.
 *
 * @param args - Formatter arguments containing log record and stack trail
 * @returns Formatted string for the log entry
 *
 * @example Usage in logger setup
 * ```typescript
 * const handler = new ConsoleHandler("DEBUG", {
 *   formatter: (logRecord) => skmtcFormatter({
 *     logRecord,
 *     stackTrail: context.stackTrail.toString()
 *   })
 * });
 * ```
 *
 * @example Output format
 * ```
 * [ERROR] 2024-01-16 10:32:59.772
 * Error: Invariant failed: Expected object schema
 *     at invariant (file:///.../bundle.js:4445:9)
 *     at new Table (file:///.../bundle.js:17632:5)
 * ```
 */
export function skmtcFormatter({ logRecord, stackTrail }: JsonFormatterArgs): string {
  const { levelName, datetime, msg } = logRecord

  // Format timestamp as readable date/time
  const timestamp = datetime.toISOString().replace('T', ' ').replace('Z', '')

  // Choose color based on log level
  let levelColor: (str: string) => string
  switch (levelName) {
    case 'ERROR':
      levelColor = red
      break
    case 'WARN':
      levelColor = yellow
      break
    case 'INFO':
      levelColor = blue
      break
    case 'DEBUG':
      levelColor = gray
      break
    default:
      levelColor = (str: string) => str
  }

  // Format the header with colored level
  const header = `${levelColor(bold(`[${levelName}]`))} ${gray(timestamp)}`

  // Add stack trail if it's not "SKIPPED"
  const stackTrailLine = stackTrail !== 'SKIPPED' ? `\n${gray('Stack:')} ${stackTrail}` : ''

  // Format the message (preserve multi-line errors and stack traces)
  const formattedMessage = msg

  return `${header}${stackTrailLine}\n${formattedMessage}\n`
}

/**
 * JSON formatter for SKMTC file logs.
 *
 * Formats log records into structured JSON for file-based logging,
 * making it easier to parse and analyze logs programmatically.
 *
 * @param args - Formatter arguments containing log record and stack trail
 * @returns Formatted JSON string for the log entry
 *
 * @example Output format
 * ```json
 * {
 *   "stackTrail": "components.schemas.User.properties.email",
 *   "level": "INFO",
 *   "datetime": 1645123456789,
 *   "message": "Processing email property",
 *   "args": { "format": "email", "required": true }
 * }
 * ```
 */
export function skmtcJsonFormatter({ logRecord, stackTrail }: JsonFormatterArgs): string {
  return JSON.stringify({
    stackTrail,
    level: logRecord.levelName,
    datetime: logRecord.datetime.getTime(),
    message: logRecord.msg,
    args: flattenArgs(logRecord.args)
  })
}

function flattenArgs(args: unknown[]): unknown {
  if (args.length === 1) {
    return args[0]
  } else if (args.length > 1) {
    return args
  }
}
