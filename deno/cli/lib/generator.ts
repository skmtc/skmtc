import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { join } from '@std/path/join'
import { ensureFile } from '@std/fs/ensure-file'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { OperationGenerator } from '@/lib/operation-generator.ts'
import { ModelGenerator } from '@/lib/model-generator.ts'
import { PackageDenoJson } from '@/lib/package-deno-json.ts'
import type { Manager } from '@/lib/manager.ts'
import type { Project } from '@/lib/project.ts'
import invariant from 'tiny-invariant'
import { extractImportPaths } from '@/lib/extract-import-paths.ts'
import { Jsr } from '@/lib/jsr.ts'
import { readCliCorePin, toMajorMinor } from '@/lib/doctor-headless.ts'

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
   * When `true`, bypass the pre-flight `@skmtc/core` peer-pin check
   * that normally refuses to clone if the project's pin doesn't match
   * the CLI's. Use this only when the operator has explicitly
   * acknowledged the skew (e.g. a `--force` flag at the CLI level).
   */
  force?: boolean
}

type CloneResult = {
  /** The concrete JSR version that was downloaded. */
  version: string
}

/**
 * Thrown by `Generator.clone` when the project's `@skmtc/core` pin
 * doesn't share a major.minor with the CLI's. Carries both pins and
 * a remediation hint so callers can emit a recipe-style error.
 */
export class CorePinMismatchError extends Error {
  readonly projectPin: string
  readonly cliCorePin: string
  readonly hint: string
  constructor(args: { projectPin: string; cliCorePin: string; hint: string }) {
    super(
      `Project @skmtc/core pin "${args.projectPin}" doesn't match the CLI's "${args.cliCorePin}". ${args.hint}`
    )
    this.name = 'CorePinMismatchError'
    this.projectPin = args.projectPin
    this.cliCorePin = args.cliCorePin
    this.hint = args.hint
  }
}

type InstallArgs = {
  denoJson: RootDenoJson
}

type AddArgs = {
  project: Project
  generatorType: 'operation' | 'model'
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

  async add({ project, generatorType }: AddArgs) {
    const generatorPath = join(toProjectPath(project.name), this.packageName)
    await this.createFiles(generatorPath, project.manager)

    switch (generatorType) {
      case 'operation': {
        const operationGenerator = new OperationGenerator(this)
        await operationGenerator.createOperationFiles(generatorPath)
        break
      }
      case 'model': {
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
          exports: './mod.ts'
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
   * After files are on disk, the package's own `deno.json#imports`
   * acts as the lookup table for cross-generator specifiers
   * (`@skmtc/gen-typescript`, etc.) that the cloned source references.
   * Peer deps the package doesn't pin itself (`@skmtc/core`,
   * `@std/path`, `valibot`, `tiny-invariant`, …) are expected to
   * already be in the project's root `deno.json` from earlier
   * `init`/`install` activity; we don't overwrite them.
   *
   * Returns the concrete resolved version so callers can surface it
   * to the user (e.g. `skmtc clone … → @scope/pkg@0.0.55`).
   */
  async clone({ denoJson, manager, force }: CloneArgs): Promise<CloneResult> {
    // Pre-flight: refuse to clone into a project whose @skmtc/core
    // pin doesn't match the CLI's major.minor. Catches friction #3
    // before it surfaces as a cryptic "No matching export" error
    // during the next `bundle`. Same comparison heuristic doctor
    // uses (`project-core-pin/<project>` check); we just run it
    // earlier and refuse rather than warn.
    if (!force) {
      const cliCorePin = readCliCorePin()
      const projectCoreValue = denoJson.contents.imports?.['@skmtc/core']
      // Skip the check when either side is unreadable — the existing
      // doctor check covers the same cases as warnings; refusing to
      // clone on an unparseable pin would be more obstruction than
      // help.
      if (cliCorePin && typeof projectCoreValue === 'string') {
        const match = projectCoreValue.match(/^jsr:@skmtc\/core@(.+)$/)
        if (match) {
          const projectPin = match[1]
          const cliMajorMinor = toMajorMinor(cliCorePin)
          const projectMajorMinor = toMajorMinor(projectPin)
          if (
            cliMajorMinor !== null &&
            projectMajorMinor !== null &&
            cliMajorMinor !== projectMajorMinor
          ) {
            throw new CorePinMismatchError({
              projectPin,
              cliCorePin,
              hint:
                `Update the project's "@skmtc/core" pin to "jsr:@skmtc/core@${cliCorePin}" ` +
                `before cloning, or re-run with --force to skip this check. ` +
                `Cloning over a mismatched pin produces a generator that won't bundle ` +
                `against the project's core version.`
            })
          }
        }
      }
    }

    const { files, version } = await Jsr.download(this)

    // Pin the local generator to the actual version we just pulled, so
    // subsequent `skmtc list` / `doctor` calls can report it accurately.
    this.version = version

    const downloads = Object.entries(files).map(async ([path, content]) => {
      const joinedPath = join(toProjectPath(this.projectName), this.packageName, path)

      await ensureFile(joinedPath)

      return Deno.writeTextFile(joinedPath, content)
    })

    await Promise.all(downloads)

    // The package's own deno.json is the lookup table for any
    // cross-generator imports the cloned source references — it's the
    // record of what *this* package was published against on JSR. Peer
    // deps not declared here are intentionally left to the project's
    // root deno.json, which `init`/`install` is expected to have
    // populated.
    const packageDenoJsonPath = join(this.toPath({ relative: false }), 'deno.json')
    const packageDenoJson = await PackageDenoJson.open(packageDenoJsonPath, manager)
    const packageImports = packageDenoJson.contents.imports ?? {}

    const importsToAdd = new Set<string>()
    for (const [filePath, content] of Object.entries(files)) {
      if (filePath.endsWith('.ts')) {
        const importPaths = extractImportPaths(content)
        importPaths.forEach(path => importsToAdd.add(path))
      }
    }

    for (const importModule of importsToAdd) {
      const source = packageImports[importModule]
      // Only add specifiers the package itself pinned. Skip anything
      // unknown — the project's existing deno.json already pins peer
      // deps (or doesn't, in which case `bundle` will surface a clear
      // missing-export error).
      if (source) {
        denoJson.addImport(importModule, source)
      }
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

type FromNameArgs = {
  projectName: string
  scopeName: string
  packageName: string
  version: string
}
