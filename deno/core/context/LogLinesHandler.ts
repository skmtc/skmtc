import { type LevelName, LogLevels } from '@std/log/levels'
import type { LogRecord } from '@std/log/logger'
import { BaseHandler } from '@std/log/base-handler'
import type { LogLine, LogLineLevel } from '@/types/LogLine.ts'
import { toSerializedError } from '@/types/SerializedError.ts'

/** Configuration options for the {@link LogLinesHandler}. */
export type LogLinesHandlerOptions = {
  /** The trail of the subject being generated, or `undefined` outside one. */
  toTrail: () => string | undefined
}

/**
 * Keeps each log record at or above its level as a {@link LogLine}, in
 * memory, for `toArtifacts` to return.
 */
export class LogLinesHandler extends BaseHandler {
  #toTrail: () => string | undefined
  #lines: LogLine[] = []

  constructor(levelName: LevelName, { toTrail }: LogLinesHandlerOptions) {
    super(levelName)

    this.#toTrail = toTrail
  }

  /** The lines kept so far, in the order they were logged. */
  get lines(): LogLine[] {
    return this.#lines
  }

  /**
   * Records `logRecord` as a structured line. Overrides `handle` because
   * `BaseHandler.handle` formats the record to a string before `log`.
   *
   * @override
   */
  override handle(logRecord: LogRecord): void {
    if (this.level > logRecord.level) {
      return
    }

    // Taken now: the trail object changes after the subject's callback returns.
    const trail = this.#toTrail()
    const error = logRecord.args.find(arg => arg instanceof Error)

    this.#lines.push({
      seq: this.#lines.length,
      level: toLogLineLevel(logRecord.level),
      ...(trail === undefined ? {} : { trail }),
      message: logRecord.msg,
      ...(error === undefined ? {} : { error: toSerializedError(error) }),
      time: logRecord.datetime.getTime()
    })
  }

  /** Not used: {@link handle} records the structured line. */
  override log(_msg: string): void {}
}

const toLogLineLevel = (level: number): LogLineLevel => {
  if (level >= LogLevels.ERROR) return 'ERROR'
  if (level >= LogLevels.WARN) return 'WARN'
  if (level >= LogLevels.INFO) return 'INFO'
  return 'DEBUG'
}
