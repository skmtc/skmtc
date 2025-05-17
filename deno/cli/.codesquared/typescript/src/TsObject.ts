import { ValueBase, handleKey, OasUnknown } from '@skmtc/core'
import type { GenerateContext, OasRef, GeneratorKey, OasSchema, OasObject, CustomValue, RefName } from '@skmtc/core'
import isEmpty from 'lodash-es/isEmpty.js'
import type { TypeSystemObjectProperties, TypeSystemRecord, TypeSystemValue, Modifiers } from '@skmtc/core'
import { applyModifiers } from './applyModifiers.ts'
import { toTsValue } from './Ts.ts'

type TsObjectProps = {
  context: GenerateContext
  destinationPath: string
  value: OasObject
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef: RefName
}

export class TsObject extends ValueBase {
  type = 'object' as const
  recordProperties: TypeSystemRecord | null
  objectProperties: TypeSystemObjectProperties | null
  modifiers: Modifiers

  constructor({ context, generatorKey, destinationPath, value, modifiers, rootRef }: TsObjectProps) {
    super({ context, generatorKey })

    this.modifiers = modifiers

    const { properties, required, additionalProperties } = value

    // If there are no properties, we need to return a record with unknown values
    if(!properties || isEmpty(properties)) {
      this.recordProperties = new TsRecord({ context, generatorKey, destinationPath, schema: new OasUnknown({}), modifiers, rootRef })
      this.objectProperties = null
    } else {
      this.recordProperties = additionalProperties
        ? new TsRecord({ context, generatorKey, destinationPath, schema: additionalProperties, modifiers, rootRef })
        : null

      this.objectProperties = new TsObjectProperties({ context, generatorKey, destinationPath, properties, required, modifiers, rootRef })
    }
  }

  override toString(): string {
    const { objectProperties, recordProperties } = this

    if (objectProperties && recordProperties) {
      return applyModifiers(`${objectProperties} | ${recordProperties}`, this.modifiers)
    }

    return applyModifiers(
      recordProperties?.toString() ?? objectProperties?.toString() ?? 'Record<string, never>',
      this.modifiers,
    )
  }
}

type TsObjectPropertiesArgs = {
  context: GenerateContext
  generatorKey: GeneratorKey
  destinationPath: string
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: OasObject['required']
  modifiers: Modifiers
  rootRef: RefName
}

class TsObjectProperties extends ValueBase {
  properties: Record<string, TypeSystemValue>
  required: string[]

  constructor({ context, generatorKey, destinationPath, properties, required = [], rootRef }: TsObjectPropertiesArgs) {
    super({ context, generatorKey })

    this.required = required

    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => {
        const value = toTsValue({
          destinationPath,
          schema: property,
          required: required?.includes(key),
          context,
          rootRef
        })

        return [handleKey(key), value]
      }),
    )
  }

  override toString(): string {
    return `{${Object.entries(this.properties)
      .map(([key, value]) => {
        const optionality = this.required.includes(key) ? '' : '?'
        return `${key}${optionality}: ${value}`
      })
      .join(', ')}}`
  }
}

type TsRecordArgs = {
  context: GenerateContext
  destinationPath: string
  schema: true | OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef: RefName
}

class TsRecord extends ValueBase {
  value: TypeSystemValue | 'true'

  constructor({ context, generatorKey, destinationPath, schema, modifiers, rootRef }: TsRecordArgs) {
    super({ context, generatorKey })

    this.value = toTsRecordChildren({
      context,
      destinationPath,
      schema,
      modifiers,
      rootRef
    })
  }

  override toString(): string {
    return `Record<string, ${this.value}>`
  }
}

type TsRecordChildrenArgs = {
  context: GenerateContext
  destinationPath: string
  schema: true | OasSchema | OasRef<'schema'>
  modifiers: Modifiers
  rootRef: RefName
}

const toTsRecordChildren = ({ context, destinationPath, schema, rootRef }: TsRecordChildrenArgs) => {
  if (schema === true) {
    return 'true'
  }

  if (isEmptyObject(schema)) {
    return 'true'
  }

  return toTsValue({ destinationPath, schema, required: true, context, rootRef })
}

const isEmptyObject = (value: unknown): value is Record<string, never> => {
  return isEmpty(value)
}
