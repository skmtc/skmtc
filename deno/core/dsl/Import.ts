type ConstructorArgs = {
  module: string
  importNames: ImportNameArg[]
}

export class Import {
  module: string
  importNames: ImportName[]

  constructor({ module, importNames }: ConstructorArgs) {
    this.module = module
    this.importNames = importNames.map(importName => new ImportName(importName))
  }

  toRecord(): Record<string, ImportNameArg[]> {
    return {
      [this.module]: this.importNames.map(({ name, alias }) =>
        alias ? { [name]: alias } : name
      )
    }
  }

  toString(): string {
    // @TODO move syntax to typescript package to enable
    // language agnostic use
    return `import { ${this.importNames.join(', ')} } from '${this.module}'`
  }
}

export type ImportNameArg = string | { [name: string]: string }

export class ImportName {
  name: string
  alias?: string

  constructor(name: ImportNameArg) {
    if (typeof name === 'string') {
      this.name = name
    } else {
      const [n, alias] = Object.entries(name)[0]

      this.name = n
      this.alias = alias
    }
  }

  toString(): string {
    return this.alias ? `${this.name} as ${this.alias}` : this.name
  }
}
