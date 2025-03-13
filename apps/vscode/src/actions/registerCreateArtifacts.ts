import { commands, ProgressLocation, window, env } from 'vscode'
import { toRootPath } from '../utilities/getRootPath'
import { readSchemaFile } from '../utilities/readSchemaFile'
import { createArtifacts } from '../api/createArtifacts'
import { join, resolve } from 'node:path'
import { ensureFileSync, writeFileSync } from 'fs-extra'
import { readPrettierFile } from '../utilities/readPrettierFile'
import { readClientConfig } from '../utilities/readClientConfig'
import { writeManifest } from '../utilities/writeManifest'
import { readManifest } from '../utilities/readManifest'
import { unlinkSync } from 'node:fs'
import { format } from 'prettier/standalone'
import typescript from 'prettier/plugins/typescript'
import estree from 'prettier/plugins/estree'
import { ManifestContent } from '@skmtc/core/Manifest'
import { ExtensionStore } from '../types/ExtensionStore'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { readStackConfig } from '../utilities/readStackConfig'
import { ExtensionContext } from 'vscode'

export type PrettierConfigType = {
  printWidth?: number
  tabWidth?: number
  useTabs?: boolean
  semi?: boolean
  singleQuote?: boolean
  quoteProps?: 'as-needed' | 'consistent' | 'preserve'
  jsxSingleQuote?: boolean
  trailingComma?: 'none' | 'es5' | 'all'
  bracketSameLine?: boolean
  bracketSpacing?: boolean
  jsxBracketSameLine?: boolean
  arrowParens?: 'avoid' | 'always'
  rangeStart?: number
  rangeEnd?: number
  requirePragma?: boolean
  insertPragma?: boolean
  proseWrap?: 'always' | 'never' | 'preserve'
  htmlWhitespaceSensitivity?: 'css' | 'strict' | 'ignore'
  vueIndentScriptAndStyle?: boolean
  endOfLine?: 'auto' | 'lf' | 'crlf' | 'cr'
  embeddedLanguageFormatting?: 'auto' | 'off'
  singleAttributePerLine?: boolean
}

type RegisterCreateArtifactsArgs = {
  context: ExtensionContext
  store: ExtensionStore
}

export const registerCreateArtifacts = ({ context, store }: RegisterCreateArtifactsArgs) => {
  return commands.registerCommand('skmtc-vscode.createArtifacts', () => {
    const clientConfig = readClientConfig({ notifyIfMissing: true })

    if (!clientConfig) {
      return
    }

    const stackConfig = readStackConfig({ notifyIfMissing: true })

    if (!stackConfig) {
      return
    }

    window.withProgress(
      {
        location: ProgressLocation.Notification,
        title: `${stackConfig.name}`,
        cancellable: false
      },
      async (progress, token) => {
        // token.onCancellationRequested(() => {
        //   console.log('User canceled the long running operation');
        // });

        progress.report({ message: 'generating artifacts' })

        const { name: stackName } = stackConfig

        if (!stackName) {
          window.showErrorMessage(`stack.json is missing a 'name' field`)
          return
        }

        const schema = readSchemaFile({ notifyIfMissing: true })

        if (!schema) {
          return
        }

        return new Promise<void>(async resolvePromise => {
          const res = await createArtifacts({
            store,
            schema: schema,
            clientConfig,
            prettier: undefined,
            stackName,
            context
          })

          if (!res) {
            window.showErrorMessage(`${stackName}: failed to generate artifacts 4`)
            setTimeout(() => resolvePromise(), 0)
            return
          }

          deletePreviousArtifacts(Object.keys(res.artifacts ?? {}))

          writeManifest(res.manifest)

          const prettier = readPrettierFile()

          const rootPath = toRootPath()

          const filesJsonPath = join(rootPath, '.codesquared', '.settings', 'files.json')

          ensureFileSync(filesJsonPath)

          writeFileSync(filesJsonPath, JSON.stringify(res.artifacts, null, 2))

          for (const [path, content] of Object.entries(res.artifacts ?? {})) {
            const absolutePath = resolve(rootPath, path)

            await writeArtifact({ absolutePath, stackName, content: String(content), prettier })
          }

          setTimeout(() => resolvePromise(), 0)

          const summary = toSummary({ manifest: res.manifest })

          window.showInformationMessage(`${stackName}: ${summary}`)

          store.milestonesDataProvider.refresh()
        })
      }
    )
  })
}

type ToSummaryArgs = {
  manifest: ManifestContent
}

const toSummary = ({ manifest }: ToSummaryArgs) => {
  const { startAt, endAt, files } = manifest
  const duration = endAt - startAt

  const stats = Object.values(files).reduce(
    (acc, { lines }) => ({
      lines: acc.lines + lines,
      files: acc.files + 1
    }),
    { files: 0, lines: 0 }
  )

  const formatter = new Intl.NumberFormat(env.language)

  const toSeconds = new Intl.NumberFormat(env.language, {
    minimumSignificantDigits: 1,
    maximumSignificantDigits: 3,
    style: 'unit',
    unit: 'second'
  })

  const formattedFiles = formatter.format(stats.files)
  const formattedLines = formatter.format(stats.lines)

  if (!duration) {
    return `generated ${formattedFiles} files, ${formattedLines} lines`
  }

  const formattedDuration = toSeconds.format(duration / 1000)

  return `generated ${formattedFiles} files, ${formattedLines} lines in ${formattedDuration}`
}

const deletePreviousArtifacts = (incomingPaths: string[]) => {
  const manifest = readManifest()

  if (!manifest) {
    return
  }

  const rootPath = toRootPath()

  const paths = Object.keys(manifest.files)

  paths.forEach(path => {
    try {
      if (!incomingPaths.includes(path)) {
        unlinkSync(resolve(rootPath, path))
      }
    } catch (error) {
      // Ignore
    }
  })
}

type FormatContentArgs = {
  content: string
  prettier?: PrettierConfigType
}

const formatContent = async ({ content, prettier }: FormatContentArgs) => {
  if (!prettier) {
    return content
  }

  try {
    return await format(content, {
      parser: 'typescript',
      plugins: [estree, typescript],
      ...prettier
    })
  } catch (e) {
    console.error(e)

    return content
  }
}

type WriteArtifactArgs = {
  stackName: string
  absolutePath: string
  content: string
  prettier: PrettierConfigType | undefined
}

const writeArtifact = async ({ absolutePath, stackName, content, prettier }: WriteArtifactArgs) => {
  try {
    ensureFileSync(absolutePath)

    const formattedContent = prettier ? await formatContent({ content, prettier }) : content

    const fileHash = await getFileHash(absolutePath)

    const contentHash = getStringHash(formattedContent)

    if (fileHash === contentHash) {
      return
    }

    writeFileSync(absolutePath, formattedContent)
  } catch (e: unknown) {
    const message = e && typeof e === 'object' && 'message' in e ? e.message : 'Unknown error'

    window.showErrorMessage(`${stackName}: failed to write file ${absolutePath}: ${message}`)
  }
}

const getStringHash = (input: string) => {
  return crypto.createHash('sha256').update(input).digest('hex')
}

const getFileHash = (path: string) => {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const rs = fs.createReadStream(path)

    rs.on('error', reject)
    rs.on('data', chunk => hash.update(chunk))
    rs.on('end', () => resolve(hash.digest('hex')))
  })
}
