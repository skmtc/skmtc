import { type LevelName, LogLevels } from '@std/log/levels'
import type { LogRecord } from '@std/log/logger'
import { BaseHandler } from '@std/log/base-handler'
import type { CoreContext } from './CoreContext.ts'
import { match } from 'npm:ts-pattern@^5.8.0'

/**
 * Base log handler interface for extending Deno standard library handlers.
 */
export interface LogHandlerBase {
  handle(logRecord: LogRecord): void
}

/**
 * Configuration options for the {@link ResultsHandler}.
 */
export interface ResultsHandlerOptions {
  /** The CoreContext instance to capture results to */
  context: CoreContext
  /** Formatter function for log messages */
  formatter?: (logRecord: LogRecord) => string
}

/**
 * Custom log handler that captures warning and error results for SKMTC processing.
 * 
 * The `ResultsHandler` extends Deno's standard library BaseHandler to provide
 * specialized logging behavior for the SKMTC pipeline. It integrates with the
 * CoreContext to capture warnings and errors as structured results that can be
 * analyzed and reported after processing completes.
 * 
 * This handler ensures that important processing issues are captured and stored
 * in the context's results system rather than just being logged to the console.
 * 
 * ## Key Features
 * 
 * - **Result Capture**: Automatically captures WARN and ERROR logs as results
 * - **Immediate Flushing**: Critical errors trigger immediate flush
 * - **Lifecycle Management**: Proper setup and cleanup with event handlers
 * - **Context Integration**: Seamlessly integrates with CoreContext results system
 * 
 * @example Setting up the handler
 * ```typescript
 * import { getLogger } from '@std/log';
 * import { ResultsHandler, CoreContext } from '@skmtc/core';
 * 
 * const context = new CoreContext({
 *   // ... context options
 * });
 * 
 * const handler = new ResultsHandler('WARN', {
 *   context: context,
 *   formatter: '[{levelName}] {msg}'
 * });
 * 
 * const logger = getLogger();
 * logger.addHandler(handler);
 * 
 * // Now warnings and errors will be captured as results
 * logger.warning('Schema validation issue detected');
 * logger.error('Failed to process operation');
 * ```
 * 
 * @example Integration in pipeline
 * ```typescript
 * class ProcessingPipeline {
 *   async process(document: OasDocument) {
 *     const context = new CoreContext(options);
 *     
 *     // Set up results handler
 *     const handler = new ResultsHandler('WARN', { context });
 *     const logger = getLogger();
 *     logger.addHandler(handler);
 *     
 *     try {
 *       const result = await this.processDocument(document, context);
 *       
 *       // Check captured results
 *       if (context.results.hasWarnings()) {
 *         console.log('Processing completed with warnings');
 *       }
 *       
 *       return result;
 *     } finally {
 *       handler.destroy();
 *     }
 *   }
 * }
 * ```
 */
export class ResultsHandler extends BaseHandler implements LogHandlerBase {
  /** The CoreContext instance for capturing results */
  context: CoreContext

  /** Bound callback for cleanup on process unload */
  #unloadCallback = (() => {
    this.destroy()
  }).bind(this)

  /**
   * Creates a new ResultsHandler instance.
   * 
   * @param levelName - The minimum log level to handle
   * @param options - Handler configuration including CoreContext
   * 
   * @example
   * ```typescript
   * const context = new CoreContext(contextOptions);
   * const handler = new ResultsHandler('WARN', {
   *   context,
   *   formatter: '[{levelName}] {msg}'
   * });
   * ```
   */
  constructor(levelName: LevelName, options: ResultsHandlerOptions) {
    super(levelName, options)

    this.context = options.context
  }

  /**
   * Sets up the handler with event listeners.
   * 
   * Registers cleanup callbacks for process termination to ensure
   * proper resource cleanup and result flushing.
   * 
   * @override
   */
  override setup() {
    this.#resetBuffer()

    addEventListener('unload', this.#unloadCallback)
  }

  /**
   * Handles incoming log records.
   * 
   * Processes log records through the base handler and triggers
   * immediate flushing for critical errors above ERROR level.
   * 
   * @param logRecord - The log record to handle
   * 
   * @override
   */
  override handle(logRecord: LogRecord) {
    super.handle(logRecord)

    // Immediately flush if log level is higher than ERROR
    if (logRecord.level > LogLevels.ERROR) {
      this.flush()
    }
  }

  /**
   * Captures log messages as results in the context.
   * 
   * Converts log level names to result types and captures them
   * in the associated CoreContext for later analysis.
   * 
   * @param levelName - The log level name ('WARN' or 'ERROR')
   * 
   * @throws {Error} When an unsupported log level is provided
   * 
   * @example
   * ```typescript
   * // This is called automatically by the logging system
   * handler.log('WARN'); // Captures as 'warning' result
   * handler.log('ERROR'); // Captures as 'error' result
   * ```
   */
  log(levelName: string) {
    this.context.captureCurrentResult(
      match(levelName)
        .with('WARN', () => 'warning' as const)
        .with('ERROR', () => 'error' as const)
        .otherwise(() => {
          throw new Error(`Unexpected log level name: ${levelName}`)
        })
    )
  }

  /**
   * Flushes any buffered content.
   * 
   * This implementation resets the internal buffer. Override
   * this method in subclasses to implement custom flushing behavior.
   * 
   * @override
   */
  flush() {
    this.#resetBuffer()
  }

  /**
   * Resets the internal buffer.
   * 
   * @private
   */
  #resetBuffer() {}

  /**
   * Destroys the handler and cleans up resources.
   * 
   * Flushes any remaining content and removes event listeners
   * to prevent memory leaks.
   * 
   * @override
   * 
   * @example
   * ```typescript
   * const handler = new ResultsHandler('WARN', { context });
   * 
   * try {
   *   // Use handler
   *   logger.addHandler(handler);
   *   await processDocument();
   * } finally {
   *   // Always clean up
   *   handler.destroy();
   * }
   * ```
   */
  override destroy() {
    this.flush()

    removeEventListener('unload', this.#unloadCallback)
  }
}
