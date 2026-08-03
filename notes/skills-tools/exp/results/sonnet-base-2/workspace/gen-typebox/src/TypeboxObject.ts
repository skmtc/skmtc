import { isEmpty } from 'jsr:@skmtc/core@0.28.3'
import { TsSnippet } from 'jsr:@skmtc/lang-typescript@0.12.17'
import type { CustomValue, GenerateContextType, GeneratorKey, Modifiers, OasObject, OasRef, OasSchema, RefName, TypeSystemObjectProperties, TypeSystemValue } from 'jsr:@skmtc/core@0.28.3'
import { toTypeboxValue } from './Typebox.ts'
import { applyModifiers } from './applyModifiers.ts'

type TypeboxObjectProps = {
  context: GenerateContextType
  destinationPath: string
  objectSchema: OasObject
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class TypeboxObject extends TsSnippet {
  type = 'object' as const
  objectProperties: TypeSystemObjectProperties | null
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, objectSchema, modifiers, rootRef }: TypeboxObjectProps) {
    super({ context, generatorKey, stackTrail: objectSchema.stackTrail.clone() })

    this.modifiers = modifiers

    const { properties, required } = objectSchema

    const hasProperties = properties && !isEmpty(properties)

    this.objectProperties = hasProperties
      ? new TypeboxObjectProperties({
        context,
        generatorKey,
        destinationPath,
        properties,
        required,
        rootRef
      })
      : null

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    return applyModifiers(this.objectProperties?.toString() ?? 'Type.Object({})', this.modifiers)
  }
}

type TypeboxObjectPropertiesArgs = {
  context: GenerateContextType
  destinationPath: string
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: OasObject['required']
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class TypeboxObjectProperties extends TsSnippet {
  properties: Record<string, TypeSystemValue>
  required: string[]

  constructor({ context, generatorKey, destinationPath, properties, required = [], rootRef }: TypeboxObjectPropertiesArgs) {
    super({ context, generatorKey })

    this.required = required

    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => {
        const value = toTypeboxValue({
          destinationPath,
          schema: property,
          required: required?.includes(key),
          context,
          rootRef
        })

        return [key, value]
      })
    )
  }

  override toString(): string {
    return `Type.Object({${
      Object.entries(this.properties)
        .map(([key, value]) => {
          const needsQuotes = /[^a-zA-Z0-9_$]/.test(key) || /^\d/.test(key)
          const formattedKey = needsQuotes ? `"${key}"` : key
          return `${formattedKey}: ${value}`
        })
        .join(', ')
    }})`
  }
}
