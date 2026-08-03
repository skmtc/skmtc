import type { GenerateContextType, GeneratorKey, Modifiers, OasObject, Stringable } from '@skmtc/core'
import { List, TsSnippet, handleKey } from '@skmtc/lang-typescript'
import { applyModifiers } from './applyModifiers.ts'
import { toTypeboxValue } from './toTypeboxValue.ts'

type TypeboxObjectArgs = {
  context: GenerateContextType
  objectSchema: OasObject
  required: boolean
  destinationPath: string
  generatorKey?: GeneratorKey
}

export class TypeboxObject extends TsSnippet {
  members: Stringable
  recordValue: Stringable | undefined
  modifiers: Modifiers

  constructor({ context, objectSchema, required, destinationPath, generatorKey }: TypeboxObjectArgs) {
    super({ context, generatorKey })

    this.modifiers = { required, nullable: objectSchema.nullable }

    const properties = objectSchema.properties ?? {}
    const requiredKeys = objectSchema.required ?? []
    const { additionalProperties } = objectSchema

    this.members = List.toObject(
      Object.entries(properties).map(([key, property]) =>
        List.toKeyValue(
          handleKey(key),
          toTypeboxValue({
            schema: property,
            required: requiredKeys.includes(key),
            destinationPath,
            context,
            generatorKey
          })
        )
      )
    )

    if (Object.keys(properties).length === 0 && additionalProperties && additionalProperties !== true) {
      this.recordValue = toTypeboxValue({
        schema: additionalProperties,
        required: true,
        destinationPath,
        context,
        generatorKey
      })
    }

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const content = this.recordValue
      ? `Type.Record(Type.String(), ${this.recordValue})`
      : `Type.Object(${this.members})`

    return applyModifiers(content, this.modifiers)
  }
}
