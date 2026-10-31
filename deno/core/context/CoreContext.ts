import { GenerateContext } from '@/context/GenerateContext.ts'
import { toInspection } from '@/run/toInspection.ts'
import { RenderContext } from '@/context/RenderContext.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import type { OasDocument } from '@/oas/document/Document.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { ResultType } from '@/types/Results.ts'
import * as log from '@std/log'
import type { Logger } from '@/types/Logger.ts'
import { ResultsHandler } from '@/context/ResultsHandler.ts'
import { LogLinesHandler } from '@/context/LogLinesHandler.ts'
import type { LogLineLevel } from '@/types/LogLine.ts'
import type { StackTrail } from '@/context/StackTrail.ts'
import { ResultsLog } from '@/helpers/ResultsLog.ts'
import type { FileBase } from '@/dsl/FileBase.ts'
import type { CaptureChannel } from '@/anchors/CaptureSink.ts'
import { join } from '@std/path/join'
import type { GeneratorsMapContainer } from '@/types/GeneratorType.ts'
import type { Preview } from '@/types/Preview.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { JsonFile } from '@/dsl/JsonFile.ts'
import type { ToArtifactsResult } from './generateTypes.ts'
import { bold, gray, red, yellow, blue } from '@std/fmt/colors'
import type { SkmtcParsedDocument, SkmtcDocumentInput } from '@/types/SkmtcDocument.ts'
import type { AttributionState } from '@/types/AttributionState.ts'
import type { SupportedSubjects } from '@/types/SupportedSubjects.ts'
import type { EnrichmentDefaults } from '@/types/EnrichmentDefaults.ts'
import type { ParseIssue } from '@/context/ParseIssue.ts'
import { toSerializedError } from '@/types/SerializedError.ts'

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
  captureChannel: CaptureChannel
}

type CoreContextArgs = {
  spanId: string
  logsPath?: string
  silent: boolean
  /** The lowest level kept in the returned `logs`. Defaults to `'WARN'`. */
  logLevel?: LogLineLevel
}

type RenderArgs = {
  files: Map<string, FileBase>
  previews: Record<string, Preview>
  basePath: string | undefined
  attribution: AttributionState | undefined
  captureChannel: CaptureChannel
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
  /**
   * When `true`, serialize the live `inspectedFiles` graph into the result's
   * `inspection` field (see {@link toInspection}). Off by default; the pipeline
   * is otherwise untouched.
   */
  inspect?: boolean
}

type SetupLoggerArgs = {
  spanId: string
  logsPath?: string
  logLines: LogLinesHandler
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

  /** Keeps this run's log lines for `toArtifacts` to return. */
  #logLines: LogLinesHandler

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
  constructor({ spanId, logsPath, silent, logLevel = 'WARN' }: CoreContextArgs) {
    this.#results = new ResultsLog()

    this.#logLines = new LogLinesHandler(logLevel, {
      toTrail: () => this.currentSubjectTrail?.toString()
    })

    this.logger = this.#setupLogger({ spanId, logsPath, logLines: this.#logLines })

    this.silent = silent
  }

  /**
   * Builds this run's own `Logger`. It does not call `log.setup` or
   * `log.getLogger`, which replace or share process-global state, so a
   * host's loggers and other runs' loggers are left alone.
   */
  #setupLogger({ spanId, logsPath, logLines }: SetupLoggerArgs): Logger {
    const fileHandlers = logsPath
      ? [
          new log.FileHandler('DEBUG', {
            filename: join(logsPath, `${spanId}.txt`),
            // JSON format for file logs (easier to parse and analyze)
            formatter: logRecord =>
              skmtcJsonFormatter({ logRecord, stackTrail: this.#toLogTrail() })
          })
        ]
      : []

    fileHandlers.forEach(handler => handler.setup())

    return new log.Logger(spanId, 'DEBUG', {
      handlers: [
        new log.ConsoleHandler('DEBUG', {
          formatter: logRecord => skmtcFormatter({ logRecord, stackTrail: this.#toLogTrail() }),
          useColors: true
        }),
        ...fileHandlers,
        logLines,
        new ResultsHandler('WARN', {
          formatter: ({ levelName }) => levelName,
          context: this
        })
      ]
    })
  }

  /**
   * The trail of the subject being generated, or `undefined` outside one
   * (parse, render, and generate work that is not a subject's variant).
   */
  get currentSubjectTrail(): StackTrail | undefined {
    return this.#phase?.type === 'generate' ? this.#phase.context.currentSubjectTrail : undefined
  }

  /** The trail a log line prints: the subject's, or `'SKIPPED'` outside one. */
  #toLogTrail(): string {
    return this.currentSubjectTrail?.toString() ?? 'SKIPPED'
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
   *       transform: ({ context, refName }) => {}
   *     }),
   *     'api-client': toOasOperationEntry({
   *       id: 'api-client',
   *       transform: ({ context, operation }) => {}
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
    attribution,
    inspect
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

      // The shared attribution capture channel: snippets constructed
      // during generate hold the GenerateContext, whose `captureSink`
      // reads this slot; RenderContext flips it around the one capturing
      // render. One object per run wires the two phases together.
      const captureChannel: CaptureChannel = { sink: undefined }

      const { files, previews, inspection, enrichmentWarnings } = stackTrail.trace(
        'generate',
        st => {
          const generatePhase = this.#setupGeneratePhase({
            toGeneratorConfigMap,
            document: parsedDocument,
            settings,
            captureChannel
          })
          this.#phase = generatePhase

          const generated = generatePhase.context.toArtifacts(st)

          // Opt-in snapshot of the live files graph, taken after generate populates
          // it and before render replaces the phase. Off unless `inspect` is set.
          return {
            ...generated,
            inspection: inspect ? toInspection(generatePhase.context.inspectedFiles) : undefined
          }
        }
      )

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
          basePath: settings?.basePath,
          attribution,
          captureChannel
        })

        return this.#phase.context.render(st)
      })

      return {
        ...renderOutput,
        results: this.#results.toTree(),
        parseIssues: phase.context.issues,
        enrichmentWarnings,
        inspection,
        logs: [...this.#logLines.lines]
      }
    } catch (error) {
      console.error(error)

      this.logger.error(toSerializedError(error).message, error)

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
        cause: toSerializedError(error)
      }

      return {
        artifacts: {},
        files: {},
        previews: {},
        results: this.#results.toTree(),
        parseIssues: [...priorIssues, fatalIssue],
        enrichmentWarnings: [],
        logs: [...this.#logLines.lines]
      }
    } finally {
      this.logger.handlers.forEach(handler => {
        if (handler instanceof log.FileHandler) {
          handler.destroy()
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
  }: Pick<ToArtifactsArgs, 'document' | 'settings' | 'toGeneratorConfigMap' | 'stackTrail'>): {
    subjects: SupportedSubjects
    parseIssues: ParseIssue[]
  } {
    try {
      const phase = this.#setupParsePhase(document)
      this.#phase = phase
      const parsedDocument: SkmtcParsedDocument = stackTrail.trace('parse', st =>
        phase.context.parse(st)
      )

      const subjects = stackTrail.trace('generate', () => {
        // Capability probing never renders, so the capture interval never
        // opens — a throwaway channel satisfies the wiring.
        const generatePhase = this.#setupGeneratePhase({
          toGeneratorConfigMap,
          document: parsedDocument,
          settings,
          captureChannel: { sink: undefined }
        })
        this.#phase = generatePhase

        return generatePhase.context.toSupportedSubjects()
      })

      return { subjects, parseIssues: phase.context.issues }
    } catch (error) {
      this.logger.error(toSerializedError(error).message, error)

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
            cause: toSerializedError(error)
          }
        ]
      }
    }
  }

  /**
   * Seed-values sibling of {@link toSupportedSubjects}: parse the document, then
   * call each generator's `toEnrichmentDefaults` over its supported subjects —
   * no transform, no render. Returns the default enrichment values keyed by the
   * `client.json#settings.enrichments` routing, plus parse issues. Fails open
   * like {@link toArtifacts}: a bad schema surfaces as a `parseIssue` and the
   * defaults map is returned empty.
   */
  toEnrichmentDefaults({
    document,
    settings,
    toGeneratorConfigMap,
    stackTrail
  }: Pick<ToArtifactsArgs, 'document' | 'settings' | 'toGeneratorConfigMap' | 'stackTrail'>): {
    enrichmentDefaults: EnrichmentDefaults
    parseIssues: ParseIssue[]
  } {
    try {
      const phase = this.#setupParsePhase(document)
      this.#phase = phase
      const parsedDocument: SkmtcParsedDocument = stackTrail.trace('parse', st =>
        phase.context.parse(st)
      )

      const enrichmentDefaults = stackTrail.trace('generate', () => {
        // Seeding never renders, so the capture interval never opens — a
        // throwaway channel satisfies the wiring.
        const generatePhase = this.#setupGeneratePhase({
          toGeneratorConfigMap,
          document: parsedDocument,
          settings,
          captureChannel: { sink: undefined }
        })
        this.#phase = generatePhase

        return generatePhase.context.toEnrichmentDefaults()
      })

      return { enrichmentDefaults, parseIssues: phase.context.issues }
    } catch (error) {
      this.logger.error(toSerializedError(error).message, error)

      const priorIssues = this.#phase?.type === 'parse' ? this.#phase.context.issues : []
      const message = error instanceof Error ? error.message : String(error)

      return {
        enrichmentDefaults: {},
        parseIssues: [
          ...priorIssues,
          {
            protocol: 'oas' as const,
            level: 'error' as const,
            type: 'INVALID_SCHEMA' as const,
            location: 'toEnrichmentDefaults',
            message: `Top-level toEnrichmentDefaults failure: ${message}`,
            cause: toSerializedError(error)
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

  #setupGeneratePhase({
    document,
    settings,
    toGeneratorConfigMap,
    captureChannel
  }: GenerateArgs): GeneratePhase {
    const generateContext = new GenerateContext({
      document,
      settings,
      logger: this.logger,
      captureCurrentResult: this.captureCurrentResult.bind(this),
      toGeneratorConfigMap,
      captureChannel
    })

    return { type: 'generate', context: generateContext }
  }

  /**
   * Captures a result at `stackTrail`. Each frame of the trail becomes one
   * level of the `manifest.results` tree.
   *
   * @param result - The type of result to capture (success, warning, error, etc.)
   * @param stackTrail - The trail the result belongs to
   *
   * @example
   * ```typescript
   * stackTrail.trace(['/pets', 'get'], opTrail => {
   *   context.captureCurrentResult('success', opTrail)
   * })
   * // manifest.results: { …, '/pets': { get: 'success' } }
   * ```
   */
  captureCurrentResult(result: ResultType, stackTrail: StackTrail): void {
    this.#results.capture(stackTrail, result)
  }

  #setupRenderPhase({
    files,
    previews,
    basePath,
    attribution,
    captureChannel
  }: RenderArgs): RenderPhase {
    const renderContext = new RenderContext({
      files,
      previews,
      basePath,
      logger: this.logger,
      captureCurrentResult: this.captureCurrentResult.bind(this),
      attribution,
      captureChannel
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
  const formattedMessage = toMessageWithStack(logRecord)

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
  const serializable = args.map(arg => (arg instanceof Error ? toSerializedError(arg) : arg))

  if (serializable.length === 1) {
    return serializable[0]
  } else if (serializable.length > 1) {
    return serializable
  }
}

/**
 * `msg`, followed by the stack of the first `Error` in `args`. A line
 * logged as `logger.error(error.message, error)` prints the stack alone,
 * which starts with the message.
 */
function toMessageWithStack({ msg, args }: JsonFormatterArgs['logRecord']): string {
  const error = args.find(arg => arg instanceof Error)

  if (error?.stack === undefined) {
    return msg
  }

  return error.message === msg ? error.stack : `${msg}\n${error.stack}`
}
