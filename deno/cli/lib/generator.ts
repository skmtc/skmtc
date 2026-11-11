import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { join } from '@std/path/join'
import { ensureFile } from '@std/fs/ensure-file'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { OperationGenerator } from '@/lib/operation-generator.ts'
import { ModelGenerator } from '@/lib/model-generator.ts'
import { KotlinModelGenerator } from '@/lib/kotlin-model-generator.ts'
import { PackageDenoJson } from '@/lib/package-deno-json.ts'
import type { Manager } from '@/lib/manager.ts'
import type { Project } from '@/lib/project.ts'
import invariant from 'tiny-invariant'
import { toBareSpecifiers, type SourceFile } from '@/lib/to-bare-specifiers.ts'
import { Jsr } from '@/lib/jsr.ts'
import { readCoreRange, reconcileCorePin } from '@/lib/stack-core.ts'

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

type CloneResult = {
  /** The concrete JSR version that was downloaded. */
  version: string
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
    const { files, version } = await Jsr.download(this)

    // The generator stack decides the project's core (#333). The download
    // is only in memory so far: plan the core pin for this version and the
    // generators that stay, and stop before any file is written when no
    // core fits them all.
    if (!force) {
      await reconcileCorePin({
        denoJson,
        adding: [
          {
            generatorId: this.toModuleName(),
            range: await readCoreRange(JSON.parse(files['/deno.json'] ?? '{}'))
          }
        ]
      })
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

    const downloaded = Object.entries(files).map(([path, content]) => ({ path, content }))
    const sourceFiles = downloaded.filter(({ path }) => isSourceFile(path))

    await Promise.all(downloaded.filter(({ path }) => !isSourceFile(path)).map(writeFile))

    const packageDenoJson = await PackageDenoJson.open(toClonePath('deno.json'), manager)
    const publishedImports = packageDenoJson.contents.imports ?? {}

    const bare = await toBareSpecifiers({ files: sourceFiles, imports: publishedImports })

    await Promise.all(bare.files.map(writeFile))

    const rootImports = denoJson.contents.imports ?? {}

    packageDenoJson.contents = {
      ...packageDenoJson.contents,
      imports: Object.fromEntries(
        Object.entries({ ...publishedImports, ...bare.pins }).filter(
          ([key]) => !(key in rootImports)
        )
      )
    }

    denoJson.addImport(this.toModuleName(), this.toModPath({ relative: true }))
    denoJson.addWorkspace(this.toPath({ relative: true }))

    return { version }
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

type FromNameArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}
