import { SnippetBase } from '@skmtc/core'
import type { GenerateContextType, GeneratorKey } from '@skmtc/core'
import { List } from '@skmtc/lang-typescript'
import type { ClientMethod } from './ClientMethod.ts'

type ConstructorArgs = {
  context: GenerateContextType
  generatorKey: GeneratorKey
}

/**
 * The per-tag class body accumulator: every operation sharing a tag appends
 * one {@link ClientMethod}; the wrapping `class`-kind definition supplies the
 * `export class <Tag>Client` declaration.
 */
export class ApiClient extends SnippetBase {
  methods: List<ClientMethod[], '\n\n  ', 'none'>

  constructor({ context, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey })

    this.methods = new List<ClientMethod[], '\n\n  ', 'none'>([], { separator: '\n\n  ' })
  }

  add(method: ClientMethod): void {
    this.methods.values.push(method)
  }

  override toString(): string {
    return `{\n  ${this.methods}\n}`
  }
}
