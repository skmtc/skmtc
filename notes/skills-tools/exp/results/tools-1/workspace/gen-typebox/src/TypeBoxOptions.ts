import { SnippetBase, type GenerateContextType } from '@skmtc/core'

type TypeBoxOptionsArgs = {
  context: GenerateContextType
}

/**
 * The JSON-Schema options object TypeBox factories accept as their final
 * argument, e.g. `Type.String({ minLength: 1 })`. Renders to nothing when
 * no constraint was collected, so the enclosing call stays bare:
 * `Type.String()`.
 */
export class TypeBoxOptions extends SnippetBase {
  entries: [string, number][]

  constructor({ context }: TypeBoxOptionsArgs) {
    super({ context })

    this.entries = []
  }

  add(name: string, value: number | undefined): void {
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
