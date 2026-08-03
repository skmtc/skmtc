import { TsSnippet, List, handleKey } from '@skmtc/lang-typescript'
import type { GenerateContextType, GeneratorKey, OasObject, Stringable } from '@skmtc/core'
import { toTypeboxValue } from './toTypeboxValue.ts'
import { applyNullable } from './applyNullable.ts'

type ConstructorArgs = {
  context: GenerateContextType
  objectSchema: OasObject
  destinationPath: string
  generatorKey?: GeneratorKey
}

type PropertyEntry = {
  key: string
  required: boolean
  value: Stringable
}

export class TypeboxObject extends TsSnippet {
  properties: PropertyEntry[]
  nullable: boolean | undefined

  constructor({ context, objectSchema, destinationPath, generatorKey }: ConstructorArgs) {
    super({ context, generatorKey, stackTrail: objectSchema.stackTrail.clone() })

    this.nullable = objectSchema.nullable

    const required = objectSchema.required ?? []

    this.properties = Object.entries(objectSchema.properties ?? {}).map(([key, propertySchema]) => ({
      key,
      required: required.includes(key),
      value: toTypeboxValue({ schema: propertySchema, destinationPath, context, generatorKey })
    }))

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const entries = this.properties.map(({ key, required, value }) => {
      const content = required ? `${value}` : `Type.Optional(${value})`
      return `${handleKey(key)}: ${content}`
    })

    return applyNullable(`Type.Object(${List.toObject(entries)})`, this.nullable)
  }
}
