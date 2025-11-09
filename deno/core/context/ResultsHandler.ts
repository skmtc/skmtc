import { type LevelName, LogLevels } from '@std/log/levels'
import type { LogRecord } from '@std/log/logger'
import { BaseHandler } from '@std/log/base-handler'
import type { CoreContext } from '@/context/CoreContext.ts'
import { StackTrail } from './StackTrail.ts'

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
    let resultType: 'warning' | 'error';
    switch (levelName) {
      case 'WARN':
        resultType = 'warning';
        break;
      case 'ERROR':
        resultType = 'error';
        break;
      default:
        throw new Error(`Unexpected log level name: ${levelName}`);
    }

    this.context.captureCurrentResult(
      resultType,
      new StackTrail(['SKIPPED'])
    );
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
