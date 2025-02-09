import * as Sentry from 'npm:@sentry/deno@8.47.0'
import type { PrettierConfigType } from '../types/prettierConfig.ts'
import invariant from 'npm:tiny-invariant@1.3.3'
import type { AddGeneratorKeyArgs, FilesRenderResult, RenderResult } from './types.ts'
import { normalize } from 'jsr:@std/path@1.0.6'
import type { Definition } from '../dsl/Definition.ts'
import type { PickArgs } from './GenerateContext.ts'
import type { GeneratorKey } from '../types/GeneratorKeys.ts'
import type { ResultType } from '../types/Results.ts'
import { toResolvedArtifactPath } from '../helpers/toResolvedArtifactPath.ts'
import { tracer } from '../helpers/tracer.ts'
import type { StackTrail } from './StackTrail.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import type { File } from '../dsl/File.ts'
import type { Preview } from '../types/Preview.ts'

type ConstructorArgs = {
  files: Map<string, File>
  previews: Record<string, Record<string, Preview>>
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
  generatorKeys: GeneratorKey[]
}

export class RenderContext {
  files: Map<string, File>
  previews: Record<string, Record<string, Preview>>
  private prettier?: PrettierConfigType
  basePath: string | undefined
  currentDestinationPath: string | 'PRE_RENDER' | 'POST_RENDER'
  logger: log.Logger
  #stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
  constructor({
    files,
    previews,
    prettier,
    basePath,
    logger,
    stackTrail,
    captureCurrentResult
  }: ConstructorArgs) {
    this.currentDestinationPath = 'PRE_RENDER'
    this.files = files
    this.previews = previews
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
        previews: this.previews
      }

      return rendered
    })
  }

  private collate(): FilesRenderResult {
    const fileEntries = Array.from(this.files.entries())

    const fileObjects: FileObject[] = fileEntries
      .map(([destinationPath, file]) => {
        return this.trace(destinationPath, () => {
          // Set the current destination path to be used by
          // addGeneratorKey method to apply generator keys
          // to Correct file

          // @TODO: Could this be combined with the tracer call above?
          this.currentDestinationPath = destinationPath

          const renderedFile: FileObject = renderFile({
            content: file.toString(),
            generatorKeys: Array.from(file.generatorKeys).filter(Boolean),
            destinationPath,
            basePath: this.basePath,
            prettier: this.prettier
          })

          this.captureCurrentResult('success')

          return renderedFile
        })
      })
      .filter(fileObject => fileObject !== undefined)

    this.currentDestinationPath = 'POST_RENDER'

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

  addGeneratorKey({ generatorKey }: AddGeneratorKeyArgs) {
    const path = this.currentDestinationPath

    invariant(
      !['PRE_RENDER', 'POST_RENDER'].includes(path),
      `Cannot add generator key during ${path} phase`
    )

    const currentFile = this.getFile(path)

    currentFile.generatorKeys.add(generatorKey)
  }

  pick({ name, exportPath }: PickArgs): Definition | undefined {
    return this.getFile(exportPath).definitions.get(name)
  }
}

type RenderFileArgs = {
  content: string
  generatorKeys: GeneratorKey[]
  destinationPath: string
  basePath?: string
  prettier?: PrettierConfigType
}

const renderFile = ({
  content,
  generatorKeys,
  destinationPath,
  basePath
}: RenderFileArgs): FileObject => {
  return {
    content,
    path: toResolvedArtifactPath({ basePath, destinationPath }),
    destinationPath,
    lines: content.split('\n').length,
    characters: content.length,
    generatorKeys
  }
}
