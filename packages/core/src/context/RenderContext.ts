import * as Sentry from '@sentry/deno'
import type { PrettierConfigType } from '../types/prettierConfig.js'
import invariant from 'tiny-invariant'
import type { AddGeneratorKeyArgs, FilesRenderResult, RenderResult } from './types.js'
import { normalize } from '../deps/jsr.io/@std/path/1.0.6/mod.js'
import type { Definition } from '../dsl/Definition.js'
import type { PickArgs } from './GenerateContext.js'
import type { GeneratorKey } from '../types/GeneratorKeys.js'
import type { ManifestEntry } from '../types/Manifest.js'
import type { ResultType } from '../types/Results.js'
import { toResolvedArtifactPath } from '../helpers/toResolvedArtifactPath.js'
import { tracer } from '../helpers/tracer.js'
import type { StackTrail } from './StackTrail.js'
import type * as log from '../deps/jsr.io/@std/log/0.224.8/mod.js'
import type { File } from '../dsl/File.js'
import type { Preview } from '../types/Preview.js'

type ConstructorArgs = {
  files: Map<string, File>
  previews: Record<string, Record<string, Preview>>
  prettier?: PrettierConfigType
  basePath: string | undefined
  pinnableGenerators: string[]
  stackTrail: StackTrail
  logger: log.Logger
  captureCurrentResult: (result: ResultType) => void
}

type FileObject = {
  content: string
  path: string
  hash: 'PLACEHOLDER'
  destinationPath: string
  numberOfLines: number
  numberOfCharacters: number
  generatorKeys: GeneratorKey[]
}

export class RenderContext {
  files: Map<string, File>
  previews: Record<string, Record<string, Preview>>
  private prettier?: PrettierConfigType
  basePath: string | undefined
  currentDestinationPath: string | 'PRE_RENDER' | 'POST_RENDER'
  pinnableGenerators: string[]
  logger: log.Logger
  #stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
  constructor({
    files,
    previews,
    prettier,
    basePath,
    pinnableGenerators,
    logger,
    stackTrail,
    captureCurrentResult
  }: ConstructorArgs) {
    this.currentDestinationPath = 'PRE_RENDER'
    this.files = files
    this.previews = previews
    this.prettier = prettier
    this.basePath = basePath
    this.pinnableGenerators = pinnableGenerators
    this.logger = logger
    this.#stackTrail = stackTrail
    this.captureCurrentResult = captureCurrentResult
  }

  render(): Omit<RenderResult, 'results'> {
    return Sentry.startSpan({ name: 'Render artifacts' }, () => {
      const result = Sentry.startSpan({ name: 'Collate content' }, () => {
        return this.collate()
      })

      const pinnable = Sentry.startSpan({ name: 'Generate pinnable' }, () => {
        return generatePinnable({
          pinnableGenerators: this.pinnableGenerators,
          files: result.files
        })
      })

      const rendered: Omit<RenderResult, 'results'> = {
        artifacts: result.artifacts,
        files: result.files,
        previews: this.previews,
        pinnable
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
        files: {},
        pinnable: {}
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
    numberOfLines: content.split('\n').length,
    numberOfCharacters: content.length,
    generatorKeys,
    hash: 'PLACEHOLDER'
  }
}

type GeneratePinnableArgs = {
  pinnableGenerators: string[]
  files: Record<string, ManifestEntry>
}

const generatePinnable = ({
  pinnableGenerators,
  files
}: GeneratePinnableArgs): Record<GeneratorKey, string> => {
  const output: Record<GeneratorKey, string[]> = {}
  Object.values(files).forEach(entry => {
    entry.generatorKeys.forEach(generatorKey => {
      if (!output[generatorKey]) {
        output[generatorKey] = []
      }
      output[generatorKey].push(entry.destinationPath)
    })
  })

  const pinnableEntries = Object.entries(output)
    .map(([generatorKey, files]) => {
      if (files.length !== 1) {
        return null
      }

      const isPinnable = pinnableGenerators.reduce((acc, pinnableGenerator) => {
        if (generatorKey.startsWith(pinnableGenerator)) {
          return true
        }

        return acc
      }, false)

      return isPinnable ? [generatorKey, files[0]] : null
    })
    .filter((generatorKey): generatorKey is [GeneratorKey, string] => generatorKey !== null)

  return Object.fromEntries(pinnableEntries)
}
