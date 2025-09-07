import { GenerateContext } from './GenerateContext.ts'
import { RenderContext } from './RenderContext.ts'
import { ParseContext } from './ParseContext.ts'
import type { PrettierConfigType } from '../types/PrettierConfig.ts'
import type { OasDocument } from '../oas/document/Document.ts'
import type { ClientSettings } from '../types/Settings.ts'
import type { ResultType } from '../types/Results.ts'
import * as log from '@std/log'
import type { Logger } from '../types/Logger.ts'
import { ResultsHandler } from './ResultsHandler.ts'
import { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import { ResultsLog } from '../helpers/ResultsLog.ts'
import * as Sentry from 'npm:@sentry/node@^10.8.0'
import type { File } from '../dsl/File.ts'
import { join } from '@std/path/join'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { Mapping, Preview } from '../types/Preview.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { JsonFile } from '../dsl/JsonFile.ts'
import type { RenderResult } from './types.ts'

/**
 * Represents the parse phase of the SKMTC pipeline.
 * 
 * The parse phase converts OpenAPI v3 JSON documents into internal OAS objects,
 * handling schema validation, reference resolution, and data transformation.
 */
export type ParsePhase = {
  /** Identifies this as the parse phase */
  type: 'parse'
  /** The parse context containing parsed document and utilities */
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
  oasDocument: OasDocument
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
  previews: Record<string, Record<string, Preview>>
  mappings: Record<string, Record<string, Mapping>>
  prettier?: PrettierConfigType
  basePath: string | undefined
}

/**
 * Arguments for the `toArtifacts` method of CoreContext.
 * 
 * Contains all the necessary configuration for transforming an OpenAPI document
 * into code artifacts through the SKMTC pipeline.
 */
export type ToArtifactsArgs = {
  /** The OpenAPI v3 document to process */
  documentObject: OpenAPIV3.Document
  /** Client settings for customization (optional) */
  settings: ClientSettings | undefined
  /** Function that returns the generator configuration map */
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  /** Prettier configuration for code formatting (optional) */
  prettier?: PrettierConfigType
  /** Whether to suppress console output */
  silent: boolean
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
 *   documentObject: openApiDoc,
 *   settings: clientSettings,
 *   toGeneratorConfigMap: () => generators,
 *   prettier: prettierConfig,
 *   silent: false
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
  
  /** Stack trail for distributed tracing */
  #stackTrail: StackTrail
  
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
    this.#stackTrail = new StackTrail([spanId])

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
              stackTrail: this.#stackTrail.toString()
            }),
          useColors: false
        }),
        ...(logsPath && {
          file: new log.FileHandler('DEBUG', {
            filename,
            // you can change format of output message using any keys in `LogRecord`.
            formatter: logRecord => {
              return skmtcFormatter({
                logRecord,
                stackTrail: this.#stackTrail.toString()
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
  parse(documentObject: OpenAPIV3.Document): { oasDocument: OasDocument } {
    this.#phase = this.#setupParsePhase(documentObject)

    const oasDocument = this.#phase.context.parse()

    return {
      oasDocument
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
   * @param args.documentObject - The OpenAPI v3 document to process
   * @param args.settings - Client settings for customization
   * @param args.toGeneratorConfigMap - Function returning generator configuration
   * @param args.prettier - Optional Prettier configuration for code formatting
   * @param args.silent - Whether to suppress console output during generation
   * @returns Promise resolving to rendered artifacts and metadata
   * 
   * @example Complete pipeline
   * ```typescript
   * const context = new CoreContext({
   *   spanId: 'api-client-gen',
   *   silent: false
   * });
   * 
   * const result = await context.toArtifacts({
   *   documentObject: openApiDoc,
   *   settings: {
   *     basePath: './src/api',
   *     skip: {
   *       models: ['Internal*'],
   *       operations: {
   *         '/health': ['get'],
   *         '/debug/**': ['*']
   *       }
   *     }
   *   },
   *   toGeneratorConfigMap: () => ({
   *     models: {
   *       generator: MyModelGenerator,
   *       settings: { includeValidation: true }
   *     },
   *     operations: {
   *       generator: MyOperationGenerator,
   *       settings: { generateTypes: true }
   *     }
   *   }),
   *   prettier: {
   *     semi: false,
   *     singleQuote: true,
   *     trailingComma: 'all'
   *   },
   *   silent: false
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
  async toArtifacts({ documentObject, settings, toGeneratorConfigMap, prettier }: ToArtifactsArgs): Promise<RenderResult> {
    try {
      const oasDocument = this.trace('parse', () => {
        this.#phase = this.#setupParsePhase(documentObject)

        return this.#phase.context.parse()
      })

      const { files, previews, mappings } = this.trace('generate', () => {
        this.#phase = this.#setupGeneratePhase({
          toGeneratorConfigMap,
          oasDocument,
          settings
        })

        return this.#phase.context.toArtifacts()
      })

      this.logger.debug(`${files.size} files generated`)

      const renderOutput = await this.trace('render', async () => {
        this.#phase = this.#setupRenderPhase({
          files,
          previews,
          mappings,
          prettier,
          basePath: settings?.basePath
        })

        return await this.#phase.context.render()
      })

      return {
        ...renderOutput,
        results: this.#results.toTree()
      }
    } catch (error) {
      console.error(error)

      this.logger.error(error)

      Sentry.captureException(error)

      return {
        artifacts: {},
        files: {},
        previews: {},
        mappings: {},
        results: this.#results.toTree()
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
   * Executes a function with distributed tracing and logging.
   * 
   * This method wraps function execution with tracing capabilities, updating the
   * stack trail for context tracking and logging execution details. It's used
   * throughout the SKMTC pipeline to maintain execution context and debugging information.
   * 
   * @template T - The return type of the traced function
   * @param token - Single token or array of tokens to add to the trace stack
   * @param fn - The function to execute within the trace context
   * @returns The result of executing the traced function
   * 
   * @example Single token tracing
   * ```typescript
   * const result = context.trace('parse-schema', () => {
   *   // Schema parsing logic here
   *   return parsedSchema;
   * });
   * ```
   * 
   * @example Multiple token tracing (nested context)
   * ```typescript
   * const result = context.trace(['components', 'schemas', 'User'], () => {
   *   // Process User schema
   *   return processedUserSchema;
   * });
   * ```
   */
  trace<T>(token: string | string[], fn: () => T): T {
    console.log('trace', token)
    this.logger.info('trace', token)
    return tracer(this.#stackTrail, token, fn, this.logger)
  }

  #setupParsePhase(documentObject: OpenAPIV3.Document): ParsePhase {
    const parseContext = new ParseContext({
      documentObject,
      logger: this.logger,
      stackTrail: this.#stackTrail,
      silent: this.silent
    })

    return { type: 'parse', context: parseContext }
  }

  #setupGeneratePhase({
    oasDocument,
    settings,
    toGeneratorConfigMap
  }: GenerateArgs): GeneratePhase {
    const generateContext = new GenerateContext({
      oasDocument,
      settings,
      logger: this.logger,
      stackTrail: this.#stackTrail,
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
  captureCurrentResult(result: ResultType): void {
    this.#results.capture(this.#stackTrail.toString(), result)
  }

  #setupRenderPhase({ files, previews, mappings, prettier, basePath }: RenderArgs): RenderPhase {
    const renderContext = new RenderContext({
      files,
      previews,
      mappings,
      prettierConfig: prettier,
      basePath,
      logger: this.logger,
      stackTrail: this.#stackTrail,
      captureCurrentResult: this.captureCurrentResult.bind(this)
    })

    return { type: 'render', context: renderContext }
  }
}

/**
 * Arguments for the SKMTC JSON log formatter.
 * 
 * Contains the log record and stack trail information needed to format
 * structured JSON log entries for the SKMTC processing pipeline.
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
 * Custom JSON formatter for SKMTC log entries.
 * 
 * Formats log records into structured JSON that includes stack trail context,
 * making it easier to trace execution and debug issues in the SKMTC pipeline.
 * The formatter flattens log arguments and includes execution context.
 * 
 * @param args - Formatter arguments containing log record and stack trail
 * @returns Formatted JSON string for the log entry
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
export function skmtcFormatter({ logRecord, stackTrail }: JsonFormatterArgs): string {
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
