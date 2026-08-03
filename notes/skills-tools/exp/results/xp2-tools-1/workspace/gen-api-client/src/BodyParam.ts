import { toGeneratorOnlyKey } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import denoJson from '../deno.json' with { type: 'json' }

type ConstructorArgs = {
  context: GenerateContextType
  schemaName: string
  destinationPath: string
}

export class BodyParam extends TsSnippet {
  schemaName: string

  constructor({ context, schemaName, destinationPath }: ConstructorArgs) {
    super({ context, generatorKey: toGeneratorOnlyKey({ generatorId: denoJson.name }) })

    this.schemaName = schemaName

    this.register({ imports: { zod: ['z'] }, destinationPath })
  }

  override toString(): string {
    return `body: z.infer<typeof ${this.schemaName}>`
  }
}
