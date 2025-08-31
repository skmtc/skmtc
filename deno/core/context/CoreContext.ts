import { GenerateContext } from './GenerateContext.ts'
import { RenderContext } from './RenderContext.ts'
import { ParseContext } from './ParseContext.ts'
import type { PrettierConfigType } from '../types/PrettierConfig.ts'
import type { OasDocument } from '../oas/document/Document.ts'
import type { ClientSettings } from '../types/Settings.ts'
import type { ResultType } from '../types/Results.ts'
import * as log from '@std/log'
import { ResultsHandler } from './ResultsHandler.ts'
import { StackTrail } from './StackTrail.ts'
import { tracer } from '../helpers/tracer.ts'
import { ResultsLog } from '../helpers/ResultsLog.ts'
import * as Sentry from 'npm:@sentry/deno@^10.8.0'
import type { File } from '../dsl/File.ts'
import { join } from '@std/path/join'
import type { GeneratorsMapContainer } from '../types/GeneratorType.ts'
import type { Mapping, Preview } from '../types/Preview.ts'
import type { OpenAPIV3 } from 'openapi-types'
import type { JsonFile } from '../dsl/JsonFile.ts'

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

type ToArtifactsArgs = {
  documentObject: OpenAPIV3.Document
  settings: ClientSettings | undefined
  toGeneratorConfigMap: <EnrichmentType = undefined>() => GeneratorsMapContainer<EnrichmentType>
  prettier?: PrettierConfigType
  silent: boolean
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
  silent: boolean
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

  parse(documentObject: OpenAPIV3.Document) {
    this.#phase = this.#setupParsePhase(documentObject)

    const oasDocument = this.#phase.context.parse()

    return {
      oasDocument
    }
  }

  async toArtifacts({ documentObject, settings, toGeneratorConfigMap, prettier }: ToArtifactsArgs) {
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
