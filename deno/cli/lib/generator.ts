import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { join } from '@std/path/join'
import { ensureFile } from '@std/fs/ensure-file'
import { exists } from '@std/fs/exists'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { OperationGenerator } from '@/lib/operation-generator.ts'
import { ModelGenerator } from '@/lib/model-generator.ts'
import { KotlinModelGenerator } from '@/lib/kotlin-model-generator.ts'
import { PackageDenoJson } from '@/lib/package-deno-json.ts'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import {
  packageDenoJson as packageDenoJsonSchema,
  type PackageDenoJson as PackageDenoJsonContents
} from '@skmtc/core/DenoJson'
import type { Manager } from '@/lib/manager.ts'
import type { Project } from '@/lib/project.ts'
import invariant from 'tiny-invariant'
import { toBareSpecifiers, type SourceFile } from '@/lib/to-bare-specifiers.ts'
import { Jsr } from '@/lib/jsr.ts'
import { CoreConflictError, readCoreRange, reconcileCorePin } from '@/lib/stack-core.ts'

type GeneratorArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}

type CreateArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}

type CloneArgs = {
  denoJson: RootDenoJson
  manager: Manager
  /**
   * When `true`, skip the `@skmtc/core` check that refuses a clone
   * whose generator needs a different core from the project's other
   * generators. Use this only when the operator has explicitly
   * acknowledged the skew (e.g. a `--force` flag at the CLI level).
   */
  force?: boolean
}

type CloneGeneratorsArgs = CloneArgs & {
  generators: Generator[]
}

type CloneResult = {
  /** Module name with scope, e.g. `@skmtc/gen-zod`. */
  moduleName: string
  /** The concrete JSR version that was downloaded. */
  version: string
}

/**
 * A published version, downloaded and rewritten in memory. Nothing is
 * written until every generator in the command has one and the core check
 * passes.
 */
type CloneDownload = {
  version: string
  /** The `@skmtc/core` range the version's `deno.json` names, `null` when none. */
  range: string | null
  /** Every file that is not a source file, as published. */
  otherFiles: SourceFile[]
  /** Source files with each versioned specifier rewritten to a bare one. */
  sourceFiles: SourceFile[]
  /** The published `deno.json`. */
  packageDenoJson: PackageDenoJsonContents
  /** The published imports, plus a pin for each bare name they did not name. */
  imports: Record<string, string>
}

type WriteCloneArgs = {
  denoJson: RootDenoJson
  manager: Manager
  download: CloneDownload
  /** Every generator the command clones: a clone resolves each one through the root. */
  cloning: string[]
  /** Delete the generator's folder first: `--force` over an existing clone. */
  replace: boolean
}

/** A JSR package name, so the folder a replace deletes is always one folder in the project. */
const PACKAGE_NAME = /^[a-z0-9][a-z0-9-]*$/

/**
 * A generator the command names is already cloned into the project. A clone
 * is a one-time copy for local edits, so replacing it takes `--force`.
 */
export class AlreadyClonedError extends Error {
  readonly generatorIds: string[]

  constructor(clones: { generatorId: string; folder: string }[]) {
    super(
      [
        `Already cloned: ${clones.map(({ generatorId, folder }) => `${generatorId} (${folder})`).join(', ')}.`,
        'Pass --force to replace it with the published version. This deletes the folder and its edits.'
      ].join('\n')
    )
    this.name = 'AlreadyClonedError'
    this.generatorIds = clones.map(({ generatorId }) => generatorId)
  }
}

type InstallArgs = {
  denoJson: RootDenoJson
}

type AddArgs = {
  project: Project
  generatorType: 'operation' | 'model'
  language?: 'typescript' | 'kotlin'
}

type PathOptions = {
  relative?: boolean
}

export class Generator {
  projectName: string
  scopeName: string
  packageName: string
  version: string

  private constructor({ projectName, scopeName, packageName, version }: GeneratorArgs) {
    this.projectName = projectName
    this.scopeName = scopeName
    this.packageName = packageName
    this.version = version
  }

  static create({ projectName, scopeName, packageName, version }: CreateArgs) {
    return new Generator({ projectName, scopeName, packageName, version })
  }

  install({ denoJson }: InstallArgs) {
    denoJson.addImport(this.toModuleName(), this.toFullName())
  }

  async add({ project, generatorType, language = 'typescript' }: AddArgs) {
    const generatorPath = join(toProjectPath(project.name), this.packageName)
    await this.createFiles(generatorPath, project.manager)

    switch (generatorType) {
      case 'operation': {
        invariant(
          language === 'typescript',
          `--lang ${language} is not yet supported for operation generators`
        )

        const operationGenerator = new OperationGenerator(this)
        await operationGenerator.createOperationFiles(generatorPath)
        break
      }
      case 'model': {
        if (language === 'kotlin') {
          const kotlinModelGenerator = new KotlinModelGenerator(this)
          await kotlinModelGenerator.createModelFiles(generatorPath)
          break
        }

        const modelGenerator = new ModelGenerator(this)
        await modelGenerator.createModelFiles(generatorPath)
        break
      }
    }

    project.rootDenoJson.addImport(this.toModuleName(), this.toModPath({ relative: true }))
    project.rootDenoJson.addWorkspace(this.toPath({ relative: true }))
  }

  async createFiles(generatorPath: string, manager: Manager) {
    await Deno.mkdir(generatorPath, { recursive: true })

    await ensureFile(join(generatorPath, 'mod.ts'))

    const packageDenoJson = PackageDenoJson.create(
      {
        path: join(generatorPath, 'deno.json'),
        contents: {
          name: this.toModuleName(),
          version: this.version,
          exports: './mod.ts',
          // Generator doctrine as live diagnostics: deno lint (and the
          // Deno LSP) picks the plugin up from here, so violations
          // surface at edit time with the rule text in the hint.
          lint: { plugins: ['jsr:@skmtc/lint-plugin@^0.1.0'] }
        }
      },
      manager
    )

    await packageDenoJson.write()
  }

  /**
   * Clones a published JSR package into the project as an editable
   * local generator. Source of truth is JSR (the same registry
   * `install` uses) — the package's full file tree is downloaded at
   * the version resolved from `this.version`'s semver constraint, then
   * written under `<project>/<packageName>/`.
   *
   * JSR serves published source with each bare import resolved to a
   * versioned `jsr:` / `npm:` specifier. Those are rewritten back to
   * bare specifiers (see {@link toBareSpecifiers}), and a bare name the
   * package's `deno.json#imports` doesn't pin is added there with the
   * version it replaced. Names the project's root `deno.json` pins are
   * then dropped from the clone's `deno.json`, so the root decides their
   * version — one `@skmtc/core` for the project, and a peer that was
   * cloned earlier resolves to its local copy. The root gains only the
   * clone itself.
   *
   * Returns the concrete resolved version so callers can surface it
   * to the user (e.g. `skmtc clone … → @scope/pkg@0.0.55`).
   */
  async clone({ denoJson, manager, force }: CloneArgs): Promise<CloneResult> {
    const [result] = await cloneGenerators({ generators: [this], denoJson, manager, force })
    return result
  }

  async download(): Promise<CloneDownload> {
    const { files, version } = await Jsr.download(this)

    const packageDenoJson = parseOrExplain(
      packageDenoJsonSchema,
      JSON.parse(files['/deno.json'] ?? '{}'),
      `deno.json of ${this.toModuleName()}@${version}`
    )
    const publishedImports = packageDenoJson.imports ?? {}

    const downloaded = Object.entries(files).map(([path, content]) => ({ path, content }))
    const bare = await toBareSpecifiers({
      files: downloaded.filter(({ path }) => isSourceFile(path)),
      imports: publishedImports
    })

    return {
      version,
      range: await readCoreRange(packageDenoJson),
      otherFiles: downloaded.filter(({ path }) => !isSourceFile(path)),
      sourceFiles: bare.files,
      packageDenoJson,
      imports: { ...publishedImports, ...bare.pins }
    }
  }

  async writeClone({
    denoJson,
    manager,
    download,
    cloning,
    replace
  }: WriteCloneArgs): Promise<CloneResult> {
    const { version } = download

    if (replace) {
      invariant(PACKAGE_NAME.test(this.packageName), `Not a package name: ${this.packageName}`)
      // Files the new version dropped must not survive the replace.
      await Deno.remove(this.toPath({ relative: false }), { recursive: true })
    }

    // Pin the local generator to the actual version we just pulled, so
    // subsequent `skmtc list` / `doctor` calls can report it accurately.
    this.version = version

    const toClonePath = (path: string) => {
      return join(toProjectPath(this.projectName), this.packageName, path)
    }

    const writeFile = async ({ path, content }: SourceFile) => {
      await ensureFile(toClonePath(path))
      await Deno.writeTextFile(toClonePath(path), content)
    }

    await Promise.all([...download.otherFiles, ...download.sourceFiles].map(writeFile))

    // The root decides every name it pins, and every generator this command
    // clones resolves to its local copy through the root, whatever the order.
    const rootImports = denoJson.contents.imports ?? {}

    PackageDenoJson.create(
      {
        path: toClonePath('deno.json'),
        contents: {
          ...download.packageDenoJson,
          imports: Object.fromEntries(
            Object.entries(download.imports).filter(
              ([key]) => !(key in rootImports) && !cloning.includes(key)
            )
          )
        }
      },
      manager
    )

    denoJson.addImport(this.toModuleName(), this.toModPath({ relative: true }))
    denoJson.addWorkspace(this.toPath({ relative: true }))

    return { moduleName: this.toModuleName(), version }
  }

  static fromName({ projectName, scopeName, packageName, version }: FromNameArgs): Generator {
    const generator = Generator.create({ projectName, scopeName, packageName, version })

    return generator
  }

  remove(project: Project) {
    const packageSource = project.rootDenoJson.contents.imports?.[this.toModuleName()]

    invariant(packageSource, 'Package source not found')

    project.rootDenoJson.removeGenerator(this)
  }

  toFullName() {
    return `jsr:${this.toModuleName()}@${this.version}`
  }

  toModuleName() {
    return `${this.scopeName}/${this.packageName}`
  }

  toPath({ relative }: PathOptions) {
    if (relative) {
      return `./${this.packageName}`
    }

    return join(toProjectPath(this.projectName), this.packageName)
  }

  toModPath({ relative }: PathOptions) {
    return `${this.toPath({ relative })}/mod.ts`
  }
}

const isSourceFile = (path: string): boolean => /\.[cm]?[jt]sx?$/.test(path)

/**
 * Clones several published generators with one core check. The generator
 * stack decides the project's core (#333): every version is downloaded and
 * its sources rewritten first, and the core pin is planned once for all of
 * them plus the generators that stay. The old copies of the generators
 * being cloned do not count, so one command moves a set of clones to a new
 * core together (#375). No file is written until all of that passes; then
 * the clones are written one at a time, and a failed write leaves the ones
 * before it complete.
 */
export const cloneGenerators = async ({
  generators,
  denoJson,
  manager,
  force
}: CloneGeneratorsArgs): Promise<CloneResult[]> => {
  const existing = (
    await Promise.all(
      generators.map(async generator =>
        (await exists(generator.toPath({ relative: false }), { isDirectory: true })) ? [generator] : []
      )
    )
  ).flat()

  if (existing.length > 0 && !force) {
    throw new AlreadyClonedError(
      existing.map(generator => ({
        generatorId: generator.toModuleName(),
        folder: generator.toPath({ relative: true })
      }))
    )
  }

  const downloads = await Promise.all(
    generators.map(async generator => ({ generator, download: await generator.download() }))
  )

  // The pin is planned with --force too, so replaced clones move to the core
  // they need. --force only stops a conflict from refusing the command.
  try {
    await reconcileCorePin({
      denoJson,
      adding: downloads.map(({ generator, download }) => ({
        generatorId: generator.toModuleName(),
        range: download.range
      }))
    })
  } catch (error) {
    if (!(force && error instanceof CoreConflictError)) throw error

    console.error(
      `Warning: --force clones over a @skmtc/core conflict. The project keeps its core pin, and the next bundle can fail.\n${error.message}`
    )
  }

  // One at a time, so a failed write leaves the clones before it complete.
  const cloning = generators.map(generator => generator.toModuleName())
  const results: CloneResult[] = []
  for (const { generator, download } of downloads) {
    const replace = existing.includes(generator)
    results.push(await generator.writeClone({ denoJson, manager, download, cloning, replace }))
  }

  return results
}

type FromNameArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}
