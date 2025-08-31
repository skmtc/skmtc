import { type LevelName, LogLevels } from '@std/log/levels'
import type { LogRecord } from '@std/log/logger'
import { BaseHandler } from '@std/log/base-handler'
import type { BaseHandlerOptions } from '@std/log/base-handler'
import type { CoreContext } from './CoreContext.ts'
import { match } from 'npm:ts-pattern@^5.8.0'

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
