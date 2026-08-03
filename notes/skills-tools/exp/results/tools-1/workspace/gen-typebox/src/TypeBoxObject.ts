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
import { toTypeBoxValue } from './TypeBox.ts'
import { applyModifiers } from './applyModifiers.ts'
import { TypeBoxUnknown } from './TypeBoxUnknown.ts'

type TypeBoxObjectProps = {
  context: GenerateContextType
  destinationPath: string
  objectSchema: OasObject
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class TypeBoxObject extends TsSnippet {
  type = 'object' as const
  recordProperties: TypeSystemRecord | null
  objectProperties: TypeSystemObjectProperties | null
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, objectSchema, modifiers, rootRef }: TypeBoxObjectProps) {
    super({ context, generatorKey, stackTrail: objectSchema.stackTrail.clone() })

    this.modifiers = modifiers

    const { properties, required, additionalProperties } = objectSchema

    const hasProperties = properties && !isEmpty(properties)

    this.recordProperties = additionalProperties
      ? new TypeBoxRecord({
          context,
          generatorKey,
          destinationPath,
          schema: additionalProperties,
          rootRef
        })
      : null

    this.objectProperties = hasProperties
      ? new TypeBoxObjectProperties({
          context,
          generatorKey,
          destinationPath,
          properties,
          required, // 'required' here refers to the object's properties, not object itself
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

type TypeBoxObjectPropertiesArgs = {
  modifiers: Modifiers
  context: GenerateContextType
  destinationPath: string
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: OasObject['required']
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class TypeBoxObjectProperties extends TsSnippet {
  properties: Record<string, TypeSystemValue>
  required: string[]

  constructor({
    context,
    generatorKey,
    destinationPath,
    properties,
    required = [],
    rootRef
  }: TypeBoxObjectPropertiesArgs) {
    super({ context, generatorKey })

    this.required = required

    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => {
        const value = toTypeBoxValue({
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
    return `Type.Object({${Object.entries(this.properties)
      .map(([key, value]) => {
        const needsQuotes = /[^a-zA-Z0-9_$]/.test(key) || /^\d/.test(key)
        const formattedKey = needsQuotes ? `"${key}"` : key
        return `${formattedKey}: ${value}`
      })
      .join(', ')}})`
  }
}

type TypeBoxRecordArgs = {
  context: GenerateContextType
  destinationPath: string
  schema: true | OasSchema | OasRef<'schema'>
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class TypeBoxRecord extends TsSnippet {
  value: TypeSystemValue | 'true'

  constructor({ context, generatorKey, destinationPath, schema, rootRef }: TypeBoxRecordArgs) {
    super({ context, generatorKey })

    if (schema === true || isEmpty(schema)) {
      this.value = new TypeBoxUnknown({ context, destinationPath, generatorKey })
    } else {
      this.value = toTypeBoxValue({
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
