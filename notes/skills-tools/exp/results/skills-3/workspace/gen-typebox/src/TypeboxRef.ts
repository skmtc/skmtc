import { TsSnippet } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, OasRef } from '@skmtc/core'
import { TypeboxProjection } from './TypeboxProjection.ts'
import { applyNullable } from './applyNullable.ts'

type ConstructorArgs = {
  context: GenerateContextType
  refSchema: OasRef<'schema'>
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxRef extends TsSnippet {
  name: string
  nullable: boolean | undefined

  constructor({ context, refSchema, destinationPath, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey, stackTrail: refSchema.stackTrail.clone() })

    this.nullable = refSchema.nullable

    const inserted = context.insertModel(TypeboxProjection, refSchema.toRefName(), {
      destinationPath
    })

    this.name = inserted.toName()

    if (this.nullable) {
      this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
    }
  }

  override toString(): string {
    return applyNullable(this.name, this.nullable)
  }
}
