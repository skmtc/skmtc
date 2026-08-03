import { SnippetBase, type GenerateContextType } from '@skmtc/core'

type OptionValue = number | boolean | string | undefined

type TypeBoxOptionsArgs = {
  context: GenerateContextType
  entries: Record<string, OptionValue>
}

/**
 * TypeBox constraints render as a single trailing options object
 * (`Type.String({ minLength: 1 })`) rather than chained calls, so all of a
 * schema's constraints collapse into one snippet. Renders to '' when no
 * constraint is set, letting callers write `Type.String(${options})`.
 */
export class TypeBoxOptions extends SnippetBase {
  entries: Record<string, OptionValue>

  constructor({ context, entries }: TypeBoxOptionsArgs) {
    super({ context })

    this.entries = entries
  }

  override toString(): string {
    const pairs = Object.entries(this.entries)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => `${key}: ${typeof value === 'string' ? JSON.stringify(value) : value}`)

    return pairs.length ? `{ ${pairs.join(', ')} }` : ''
  }
}
