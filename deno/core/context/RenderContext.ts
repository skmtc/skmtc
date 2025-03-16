import * as Sentry from 'npm:@sentry/deno@8.47.0'
import type { PrettierConfigType } from '../types/prettierConfig.ts'
import invariant from 'npm:tiny-invariant@1.3.3'
import type { FilesRenderResult, RenderResult } from './types.ts'
import { normalize } from 'jsr:@std/path@1.0.6'
import type { Definition } from '../dsl/Definition.ts'
import type { PickArgs } from './GenerateContext.ts'
import type { ResultType } from '../types/Results.ts'
import { toResolvedArtifactPath } from '../helpers/toResolvedArtifactPath.ts'
import { tracer } from '../helpers/tracer.ts'
import type { StackTrail } from './StackTrail.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { File } from '../dsl/File.ts'
import type { Preview } from '../types/Preview.ts'
import type { SchemaOption } from '../types/SchemaOptions.ts'
type ConstructorArgs = {
  files: Map<string, File>
  previews: Record<string, Record<string, Preview>>
  schemaOptions: SchemaOption[]
  prettier?: PrettierConfigType
  basePath: string | undefined
  stackTrail: StackTrail
  logger: log.Logger
  captureCurrentResult: (result: ResultType) => void
}

type FileObject = {
  content: string
  path: string
  destinationPath: string
  lines: number
  characters: number
}

export class RenderContext {
  files: Map<string, File>
  previews: Record<string, Record<string, Preview>>
  schemaOptions: SchemaOption[]
  private prettier?: PrettierConfigType
  basePath: string | undefined
  logger: log.Logger
  #stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
  constructor({
    files,
    previews,
    schemaOptions,
    prettier,
    basePath,
    logger,
    stackTrail,
    captureCurrentResult
  }: ConstructorArgs) {
    this.files = files
    this.previews = previews
    this.schemaOptions = schemaOptions
    this.prettier = prettier
    this.basePath = basePath
    this.logger = logger
    this.#stackTrail = stackTrail
    this.captureCurrentResult = captureCurrentResult
  }

  render(): Omit<RenderResult, 'results'> {
    return Sentry.startSpan({ name: 'Render artifacts' }, () => {
      const result = Sentry.startSpan({ name: 'Collate content' }, () => {
        return this.collate()
      })

      const rendered: Omit<RenderResult, 'results'> = {
        artifacts: result.artifacts,
        files: result.files,
        previews: this.previews,
        schemaOptions: this.schemaOptions
      }

      return rendered
    })
  }

  private collate(): FilesRenderResult {
    const fileEntries = Array.from(this.files.entries())

    const fileObjects: FileObject[] = fileEntries
      .map(([destinationPath, file]) => {
        return this.trace(destinationPath, () => {
          const renderedFile: FileObject = renderFile({
            content: file.toString(),
            destinationPath,
            basePath: this.basePath,
            prettier: this.prettier
          })

          this.captureCurrentResult('success')

          return renderedFile
        })
      })
      .filter(fileObject => fileObject !== undefined)

    return fileObjects.reduce<FilesRenderResult>(
      (acc, { content, path, ...fileMeta }) => ({
        ...acc,
        artifacts: {
          ...acc.artifacts,
          [path]: content
        },
        files: {
          ...acc.files,
          [path]: {
            ...fileMeta
          }
        }
      }),
      {
        artifacts: {},
        files: {}
      }
    )
  }

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.#stackTrail, token, fn)
  }

  getFile(filePath: string): File {
    const normalisedPath = normalize(filePath)

    const currentFile = this.files.get(normalisedPath)

    invariant(currentFile, `File not found during render phase: ${normalisedPath}`)

    return currentFile
  }

  pick({ name, exportPath }: PickArgs): Definition | undefined {
    return this.getFile(exportPath).definitions.get(name)
  }
}

type RenderFileArgs = {
  content: string
  destinationPath: string
  basePath?: string
  prettier?: PrettierConfigType
}

const renderFile = ({ content, destinationPath, basePath }: RenderFileArgs): FileObject => {
  return {
    content,
    path: toResolvedArtifactPath({ basePath, destinationPath }),
    destinationPath,
    lines: content.split('\n').length,
    characters: content.length
  }
}
