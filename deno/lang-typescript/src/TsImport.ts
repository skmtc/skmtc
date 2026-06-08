/**
 * A single imported symbol. `typeOnly` drives TypeScript's per-name
 * `import { type X }` (and, when every spec is type-only, the
 * statement-level `import type { … }`).
 */
export type TsImportSpec = {
  name: string
  alias?: string
  typeOnly?: boolean
}

/**
 * Renders a TypeScript `import` statement.
 *
 * The anchor language's import rendering. `typeOnly` is the TS-specific
 * `verbatimModuleSyntax` concern other languages won't have — it lives
 * here on the TypeScript renderer, not in core.
 */
export class TsImport {
  module: string
  specs: TsImportSpec[]

  constructor(module: string, specs: TsImportSpec[]) {
    this.module = module
    this.specs = specs
  }

  toString(): string {
    const allTypeOnly = this.specs.length > 0 && this.specs.every(spec => spec.typeOnly)

    const inner = this.specs
      .map(spec => {
        const base = spec.alias ? `${spec.name} as ${spec.alias}` : spec.name
        return !allTypeOnly && spec.typeOnly ? `type ${base}` : base
      })
      .join(', ')

    const keyword = allTypeOnly ? 'import type' : 'import'

    return `${keyword} { ${inner} } from '${this.module}'`
  }
}
