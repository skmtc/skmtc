import { ImportBase } from '@skmtc/core'
import type { IdentifierBase, ModulePackage } from '@skmtc/core'
import { toPackageName } from './toPackageName.ts'

/**
 * The concise import form a Kotlin generator passes to `register` —
 * `'Serializable'` or `{ name: 'User', alias: 'UserModel' }` (Kotlin
 * supports symbol-level aliases via `as`, unlike Java). Owned by this
 * package: the concise vocabulary is language-specific; the neutral
 * engine never sees it. No `type` tag — Kotlin has no type-only imports.
 */
export type KtImportNameArg = string | { name: string; alias?: string }

/** A single imported symbol on a {@link KtImport}. */
export type KtImportSpecifier = {
  name: string
  alias?: string
}

const toSpecifier = (argument: KtImportNameArg): KtImportSpecifier => {
  return typeof argument === 'string'
    ? { name: argument }
    : { name: argument.name, alias: argument.alias }
}

const specifierKey = (specifier: KtImportSpecifier): string => {
  return specifier.alias ? `${specifier.name} as ${specifier.alias}` : specifier.name
}

/**
 * Kotlin's concrete {@link ImportBase}: one module's worth of imported
 * symbols. The `module` takes two forms, distinguished by shape:
 *
 * - a dotted package (`'kotlinx.serialization'`) — external libraries,
 *   generator-registered;
 * - an `@/`-export-path (`'@/com/example/api/User.generated.kt'`) — project
 *   files; this is what the Driver passes for cross-file peer imports.
 *
 * The path form resolves to its package via {@link toPackageName} at
 * render time ({@link resolvedPackage}); {@link import('./KtFile.ts').KtFile}
 * uses the same resolution to suppress same-package imports (same-package
 * symbols need no import in Kotlin).
 *
 * Rendering is one statement per symbol — Kotlin has no brace grouping:
 * `import kotlinx.serialization.Serializable`.
 */
export class KtImport extends ImportBase {
  module: string
  specifiers: KtImportSpecifier[]

  constructor(module: string, specifiers: KtImportSpecifier[]) {
    super()
    this.module = module
    this.specifiers = specifiers
  }

  /** Build from the concise `{ module: KtImportNameArg[] }` form a generator passes. */
  static fromConcise(module: string, names: KtImportNameArg[]): KtImport {
    return new KtImport(module, names.map(toSpecifier))
  }

  /**
   * Build the import of a single {@link IdentifierBase} from `module` — the
   * cross-file import a Driver registers when a generator references a
   * peer's Definition. The identifier's `type` is ignored: every Kotlin
   * import has the same form, so the neutral `IdentifierBase` (which the
   * engine holds) is all that's needed — no narrowing.
   */
  static fromIdentifier(module: string, identifier: IdentifierBase): KtImport {
    return new KtImport(module, [{ name: identifier.name }])
  }

  /**
   * The package this import's symbols come from: a path-form module
   * (contains `/`) derives via {@link toPackageName}; a dotted package
   * passes through. In multi-package output the owning
   * {@link import('./KtFile.ts').KtFile} passes its `settings.packages`
   * so a path under another module's `rootPath` resolves to that
   * module's real dotted package — Kotlin imports are always packages;
   * `moduleName` has no Kotlin meaning.
   */
  resolvedPackage(packages?: ModulePackage[]): string {
    return this.module.includes('/') ? toPackageName(this.module, packages) : this.module
  }

  override mergeKey(): string {
    return this.module
  }

  override merge(other: ImportBase): ImportBase {
    if (!(other instanceof KtImport)) {
      throw new Error(`Cannot merge a KtImport with a ${other.constructor.name}`)
    }

    const byKey = new Map<string, KtImportSpecifier>()
    for (const specifier of [...this.specifiers, ...other.specifiers]) {
      byKey.set(specifierKey(specifier), specifier)
    }

    return new KtImport(this.module, [...byKey.values()])
  }

  /** One `import pkg.Name[ as Alias]` line per specifier. */
  toLines(packages?: ModulePackage[]): string[] {
    const packageName = this.resolvedPackage(packages)

    if (packageName === '') {
      // Kotlin cannot import from the default package. A same-file or
      // same-package reference is suppressed by KtFile before rendering;
      // reaching here means a root-level artifact is referenced from a
      // packaged one — a generator path-policy bug.
      throw new Error(
        `Cannot import '${this.specifiers.map(specifier => specifier.name).join(', ')}' ` +
          `from the default package ('${this.module}') — give the artifact a package path`
      )
    }

    return this.specifiers.map(specifier => {
      const alias = specifier.alias ? ` as ${specifier.alias}` : ''

      return `import ${packageName}.${specifier.name}${alias}`
    })
  }

  override toString(): string {
    return this.toLines().join('\n')
  }
}
