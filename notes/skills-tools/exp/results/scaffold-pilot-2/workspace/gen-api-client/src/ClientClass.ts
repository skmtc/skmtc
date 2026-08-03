import type { GenerateContextType } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type { ClientMethod } from './ClientMethod.ts'

type ConstructorArgs = {
  context: GenerateContextType
}

/** The per-tag accumulator: operations append methods; render joins them
 *  inside the class braces (block-form definition — no `= value;`). */
export class ClientClass extends TsSnippet {
  methods: ClientMethod[] = []

  constructor({ context }: ConstructorArgs) {
    super({ context })
  }

  add(method: ClientMethod): void {
    this.methods.push(method)
  }

  override toString(): string {
    return `{\n  ${this.methods.join('\n\n  ')}\n}`
  }
}
