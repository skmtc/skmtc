import * as Sentry from 'npm:@sentry/deno@^9.39.0'
import type { PrettierConfigType } from '../types/PrettierConfig.ts'
import invariant from 'npm:tiny-invariant@1.3.3'
import type { FilesRenderResult, RenderResult } from './types.ts'
import { normalize } from 'jsr:@std/path@^1.0.6'
import type { Definition } from '../dsl/Definition.ts'
import type { PickArgs } from './GenerateContext.ts'
import type { ResultType } from '../types/Results.ts'
import { toResolvedArtifactPath } from '../helpers/toResolvedArtifactPath.ts'
import { tracer } from '../helpers/tracer.ts'
import type { StackTrail } from './StackTrail.ts'
import type * as log from 'jsr:@std/log@^0.224.6'
import { File } from '../dsl/File.ts'
import type { Preview, Mapping } from '../types/Preview.ts'
import * as prettier from 'npm:prettier@^3.6.2'
import type { JsonFile } from '../dsl/JsonFile.ts'

type ConstructorArgs = {
  files: Map<string, File | JsonFile>
  previews: Record<string, Record<string, Preview>>
  mappings: Record<string, Record<string, Mapping>>
  prettierConfig?: PrettierConfigType
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

type RenderOutput = {
  artifacts: Record<string, string>
  files: Record<
    string,
    {
      destinationPath: string
      lines: number
      characters: number
    }
  >
}

export class RenderContext {
  files: Map<string, File | JsonFile>
  previews: Record<string, Record<string, Preview>>
  mappings: Record<string, Record<string, Mapping>>
  #prettierConfig?: PrettierConfigType
  basePath: string | undefined
  logger: log.Logger
  #stackTrail: StackTrail
  captureCurrentResult: (result: ResultType) => void
  constructor({
    files,
    previews,
    mappings,
    prettierConfig,
    basePath,
    logger,
    stackTrail,
    captureCurrentResult
  }: ConstructorArgs) {
    this.files = files
    this.previews = previews
    this.mappings = mappings
    this.#prettierConfig = prettierConfig
    this.basePath = basePath
    this.logger = logger
    this.#stackTrail = stackTrail
    this.captureCurrentResult = captureCurrentResult
  }

  async render(): Promise<Omit<RenderResult, 'results'>> {
    return await Sentry.startSpan({ name: 'Render artifacts' }, async () => {
      const result = await Sentry.startSpan({ name: 'Collate content' }, async () => {
        return await this.collate()
      })

      const rendered: Omit<RenderResult, 'results'> = {
        artifacts: result.artifacts,
        files: result.files,
        previews: this.previews,
        mappings: this.mappings
      }

      return rendered
    })
  }

  async collate(): Promise<FilesRenderResult> {
    const fileEntries = Array.from(this.files.entries())

    const fileObjectPromises: Promise<FileObject>[] = fileEntries
      .map(([destinationPath, file]) => {
        return this.trace(destinationPath, () => {
          const renderedFile: Promise<FileObject> = renderFile({
            content: file.toString(),
            destinationPath,
            basePath: this.basePath,
            prettierConfig: this.#prettierConfig
          })

          this.captureCurrentResult('success')

          return renderedFile
        })
      })
      .filter(fileObject => fileObject !== undefined)

    const fileObjects = await Promise.all(fileObjectPromises)

    const output: FilesRenderResult = {
      artifacts: {},
      files: {}
    }

    for (const fileObject of fileObjects) {
      output.artifacts[fileObject.path] = fileObject.content
      output.files[fileObject.path] = {
        destinationPath: fileObject.destinationPath,
        lines: fileObject.lines,
        characters: fileObject.characters
      }
    }

    return output
  }

  trace<T>(token: string | string[], fn: () => T): T {
    return tracer(this.#stackTrail, token, fn, this.logger)
  }

  getFile(filePath: string): File | JsonFile {
    const normalisedPath = normalize(filePath)

    const currentFile = this.files.get(normalisedPath)

    invariant(currentFile, `File not found during render phase: ${normalisedPath}`)

    return currentFile
  }

  pick({ name, exportPath }: PickArgs): Definition | undefined {
    const file = this.getFile(exportPath)

    invariant(file instanceof File, `File at "${exportPath}" is not a "File" type`)

    return file.definitions.get(name)
  }
}

type RenderFileArgs = {
  content: string
  destinationPath: string
  basePath?: string
  prettierConfig?: PrettierConfigType
}

const renderFile = async ({
  content,
  destinationPath,
  basePath,
  prettierConfig
}: RenderFileArgs): Promise<FileObject> => {
  const path = toResolvedArtifactPath({ basePath, destinationPath })

  const formatted = prettierConfig
    ? await prettier.format(content, { ...prettierConfig, parser: 'typescript' })
    : content

  return {
    content: formatted,
    path,
    destinationPath,
    lines: formatted.split('\n').length,
    characters: formatted.length
  }
}
