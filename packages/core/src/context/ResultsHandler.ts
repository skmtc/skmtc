import { type LevelName, LogLevels } from '../deps/jsr.io/@std/log/0.224.8/levels.js'
import type { LogRecord } from '../deps/jsr.io/@std/log/0.224.8/logger.js'
import { BaseHandler } from '../deps/jsr.io/@std/log/0.224.8/base_handler.js'
import type { BaseHandlerOptions } from '../deps/jsr.io/@std/log/0.224.8/base_handler.js'
import type { CoreContext } from './CoreContext.js'
import { match } from 'ts-pattern'

export interface ResultsHandlerOptions extends BaseHandlerOptions {
  context: CoreContext
}

export class ResultsHandler extends BaseHandler {
  context: CoreContext

  #unloadCallback = (() => {
    this.destroy()
  }).bind(this)

  constructor(levelName: LevelName, options: ResultsHandlerOptions) {
    super(levelName, options)

    this.context = options.context
  }

  override setup() {
    this.#resetBuffer()

    addEventListener('unload', this.#unloadCallback)
  }

  override handle(logRecord: LogRecord) {
    super.handle(logRecord)

    // Immediately flush if log level is higher than ERROR
    if (logRecord.level > LogLevels.ERROR) {
      this.flush()
    }
  }

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

  flush() {
    this.#resetBuffer()
  }

  #resetBuffer() {}

  override destroy() {
    this.flush()

    removeEventListener('unload', this.#unloadCallback)
  }
}
