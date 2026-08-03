import { SnippetBase, type GenerateContextType } from '@skmtc/core'

type TypeboxOptionsArgs = {
  context: GenerateContextType
}

/**
 * TypeBox expresses constraints as an options object passed to the type
 * factory — `Type.String({ minLength: 1 })` — rather than a chained
 * builder. Collects `[key, value]` pairs and renders the object literal,
 * or nothing when empty so the call site stays `Type.String()`.
 */
export class TypeboxOptions extends SnippetBase {
  entries: [string, number][]

  constructor({ context }: TypeboxOptionsArgs) {
    super({ context })

    this.entries = []
  }

  add(name: string, value: number | undefined) {
    if (typeof value !== 'undefined') {
      this.entries.push([name, value])
    }
  }

  override toString(): string {
    return this.entries.length === 0
      ? ''
      : `{ ${this.entries.map(([name, value]) => `${name}: ${value}`).join(', ')} }`
  }
}
