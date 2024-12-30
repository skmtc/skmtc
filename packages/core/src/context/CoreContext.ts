import { GenerateContext } from './GenerateContext.js'
import { RenderContext } from './RenderContext.js'
import { ParseContext } from './ParseContext.js'
import type { PrettierConfigType } from '../types/prettierConfig.js'
import type { OasDocument } from '../oas/document/Document.js'
import type { ClientSettings } from '../types/Settings.js'
import type { ResultType } from '../types/Results.js'
import * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js'
import { ResultsHandler } from './ResultsHandler.js'
import { StackTrail } from './StackTrail.js'
import type { GeneratorKey } from '../types/GeneratorKeys.js'
import { tracer } from '../helpers/tracer.js'
import { ResultsLog } from '../helpers/ResultsLog.js'
import * as Sentry from '@sentry/deno'
import type { File } from '../dsl/File.js'
import { join } from '../deps/jsr.io/@std/path/1.0.6/mod.js'
import type { GeneratorType, GeneratorsMap } from '../types/GeneratorType.js'

export type ParsePhase = {
  type: 'parse'
  context: ParseContext
}

export type GeneratePhase = {
  type: 'generate'
  context: GenerateContext
}

export type RenderPhase = {
  type: 'render'
  context: RenderContext
}

export type ExecutionPhase = ParsePhase | GeneratePhase | RenderPhase

type GenerateArgs = {
  oasDocument: OasDocument
  settings: ClientSettings | undefined
  callback: (generatorKey: GeneratorKey) => void
  toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<
    GeneratorType<EnrichmentType>,
    EnrichmentType
  >
}

type CoreContextArgs = {
  spanId: string
  logsPath?: string
}

type RenderArgs = {
  files: Map<string, File>
  previews: Record<string, Record<string, string>>
  prettier?: PrettierConfigType
  basePath: string | undefined
  pinnableGenerators: string[]
}

type TransformArgs = {
  schema: string
  settings: ClientSettings | undefined
  toGeneratorsMap: <EnrichmentType>() => GeneratorsMap<
    GeneratorType<EnrichmentType>,
    EnrichmentType
  >
  prettier?: PrettierConfigType
}

type SetupLoggerArgs = {
  spanId: string
  logsPath?: string
}

export class CoreContext {
  logger: log.Logger
  #phase: ExecutionPhase | undefined
  #results: ResultsLog
  #stackTrail: StackTrail

  constructor({ spanId, logsPath }: CoreContextArgs) {
    this.#stackTrail = new StackTrail([spanId])

    this.#results = new ResultsLog()

    this.logger = this.#setupLogger({ spanId, logsPath })
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

  parse(schema: string) {
    this.#phase = this.#setupParsePhase(schema)

    const oasDocument = this.#phase.context.parse()

    const extensions = this.#phase.context.extentions

    return {
      oasDocument,
      extensions
    }
  }

  transform({ schema, settings, toGeneratorsMap, prettier }: TransformArgs) {
    // Temp workaround to extract generator keys during
    // 'render' by invoking a callback passed during 'generate'
    try {
      const callback = (generatorKey: GeneratorKey) => {
        if (this.#phase?.type === 'render') {
          this.#phase.context.addGeneratorKey({ generatorKey })
        }
      }

      const oasDocument = this.trace('parse', () => {
        this.#phase = this.#setupParsePhase(schema)

        return this.#phase.context.parse()
      })

      const { files, previews } = this.trace('generate', () => {
        this.#phase = this.#setupGeneratePhase({
          toGeneratorsMap,
          oasDocument,
          settings,
          callback
        })

        return this.#phase.context.generate()
      })

      this.logger.debug(`${files.size} files generated`)

      const renderOutput = this.trace('render', () => {
        this.#phase = this.#setupRenderPhase({
          files,
          previews,
          pinnableGenerators: Object.values(toGeneratorsMap())
            .map(({ id, pinnable }) => (pinnable ? id : null))
            .filter(generatorId => generatorId !== null),
          prettier,
          basePath: settings?.basePath
        })

        return this.#phase.context.render()
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
        pinnable: {},
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

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.#stackTrail, token, fn)
  }

  #setupParsePhase(schema: string): ParsePhase {
    const parseContext = new ParseContext({
      schema,
      logger: this.logger,
      stackTrail: this.#stackTrail
    })

    return { type: 'parse', context: parseContext }
  }

  #setupGeneratePhase({
    oasDocument,
    settings,
    callback,
    toGeneratorsMap
  }: GenerateArgs): GeneratePhase {
    const generateContext = new GenerateContext({
      oasDocument,
      settings,
      logger: this.logger,
      callback,
      stackTrail: this.#stackTrail,
      captureCurrentResult: this.captureCurrentResult.bind(this),
      toGeneratorsMap
    })

    return { type: 'generate', context: generateContext }
  }

  captureCurrentResult(result: ResultType): void {
    this.#results.capture(this.#stackTrail.toString(), result)
  }

  #setupRenderPhase({
    files,
    previews,
    prettier,
    basePath,
    pinnableGenerators
  }: RenderArgs): RenderPhase {
    const renderContext = new RenderContext({
      files,
      previews,
      prettier,
      basePath,
      pinnableGenerators,
      logger: this.logger,
      stackTrail: this.#stackTrail,
      captureCurrentResult: this.captureCurrentResult.bind(this)
    })

    return { type: 'render', context: renderContext }
  }
}

export type JsonFormatterArgs = {
  logRecord: log.LogRecord
  stackTrail: string
}

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
