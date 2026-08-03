import { isEmpty } from '@skmtc/core'
import { TsSnippet } from '@skmtc/lang-typescript'
import type {
  CustomValue,
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasObject,
  OasRef,
  OasSchema,
  RefName,
  TypeSystemObjectProperties,
  TypeSystemRecord,
  TypeSystemValue
} from '@skmtc/core'
import { toTypeboxValue } from './Typebox.ts'
import { applyModifiers } from './applyModifiers.ts'
import { TypeboxUnknown } from './TypeboxUnknown.ts'

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
  recordProperties: TypeSystemRecord | null
  objectProperties: TypeSystemObjectProperties | null
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, objectSchema, modifiers, rootRef }: TypeboxObjectProps) {
    super({ context, generatorKey, stackTrail: objectSchema.stackTrail.clone() })

    this.modifiers = modifiers

    const { properties, required, additionalProperties } = objectSchema

    const hasProperties = properties && !isEmpty(properties)

    this.recordProperties = additionalProperties
      ? new TypeboxRecord({
          context,
          generatorKey,
          destinationPath,
          schema: additionalProperties,
          rootRef
        })
      : null

    this.objectProperties = hasProperties
      ? new TypeboxObjectProperties({
          context,
          generatorKey,
          destinationPath,
          properties,
          required,
          modifiers,
          rootRef
        })
      : null

    this.register({ imports: { '@sinclair/typebox': ['Type'] }, destinationPath })
  }

  override toString(): string {
    const { objectProperties, recordProperties } = this

    if (objectProperties && recordProperties) {
      return applyModifiers(`Type.Intersect([${objectProperties}, ${recordProperties}])`, this.modifiers)
    }

    return applyModifiers(
      recordProperties?.toString() ?? objectProperties?.toString() ?? 'Type.Object({})',
      this.modifiers
    )
  }
}

type TypeboxObjectPropertiesArgs = {
  modifiers: Modifiers
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

  constructor({
    context,
    generatorKey,
    destinationPath,
    properties,
    required = [],
    rootRef
  }: TypeboxObjectPropertiesArgs) {
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
    const entries = Object.entries(this.properties).map(([key, value]) => {
      const needsQuotes = /[^a-zA-Z0-9_$]/.test(key) || /^\d/.test(key)
      const formattedKey = needsQuotes ? `"${key}"` : key

      return `${formattedKey}: ${value}`
    })

    return `Type.Object({${entries.join(', ')}})`
  }
}

type TypeboxRecordArgs = {
  context: GenerateContextType
  destinationPath: string
  schema: true | OasSchema | OasRef<'schema'>
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class TypeboxRecord extends TsSnippet {
  value: TypeSystemValue

  constructor({ context, generatorKey, destinationPath, schema, rootRef }: TypeboxRecordArgs) {
    super({ context, generatorKey })

    if (schema === true || isEmpty(schema)) {
      this.value = new TypeboxUnknown({ context, destinationPath, generatorKey })
    } else {
      this.value = toTypeboxValue({
        destinationPath,
        schema,
        required: true,
        context,
        rootRef
      })
    }
  }

  override toString(): string {
    return `Type.Record(Type.String(), ${this.value})`
  }
}
