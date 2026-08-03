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
  TypeSystemValue
} from '@skmtc/core'
import { toEffectValue } from './Effect.ts'
import { applyModifiers } from './applyModifiers.ts'
import { EFFECT_MODULE, SCHEMA } from './constants.ts'

type EffectObjectArgs = {
  context: GenerateContextType
  destinationPath: string
  objectSchema: OasObject
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

/**
 * An object renders as `Schema.Struct({ … })` for declared properties and
 * `Schema.Record({ key: Schema.String, value: … })` for
 * `additionalProperties`. A schema carrying both is the extension of the
 * struct by the record, which effect spells `Schema.extend(a, b)`.
 */
export class EffectObject extends TsSnippet {
  type = 'object' as const
  objectProperties: EffectStruct | null
  recordProperties: EffectRecord | null
  modifiers: Modifiers

  constructor({
    context,
    destinationPath,
    objectSchema,
    modifiers,
    generatorKey,
    rootRef
  }: EffectObjectArgs) {
    super({ context, generatorKey, stackTrail: objectSchema.stackTrail.clone() })

    this.modifiers = modifiers

    const { properties, required, additionalProperties } = objectSchema

    this.objectProperties =
      properties && !isEmpty(properties)
        ? new EffectStruct({
            context,
            destinationPath,
            properties,
            required,
            generatorKey,
            rootRef
          })
        : null

    this.recordProperties = additionalProperties
      ? new EffectRecord({
          context,
          destinationPath,
          schema: additionalProperties,
          generatorKey,
          rootRef
        })
      : null

    this.register({ imports: { [EFFECT_MODULE]: [SCHEMA] }, destinationPath })
  }

  override toString(): string {
    const { objectProperties, recordProperties } = this

    if (objectProperties && recordProperties) {
      return applyModifiers(
        `${SCHEMA}.extend(${objectProperties}, ${recordProperties})`,
        this.modifiers
      )
    }

    return applyModifiers(
      objectProperties?.toString() ?? recordProperties?.toString() ?? `${SCHEMA}.Struct({})`,
      this.modifiers
    )
  }
}

type EffectStructArgs = {
  context: GenerateContextType
  destinationPath: string
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: string[] | undefined
  generatorKey: GeneratorKey
  rootRef?: RefName
}

/**
 * A property key is emitted verbatim when it is a plain identifier and
 * quoted otherwise, so keys like `x-total-count` survive intact rather than
 * being renamed.
 */
const toPropertyKey = (key: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : `'${key.replaceAll("'", "\\'")}'`

class EffectStruct extends TsSnippet {
  properties: Record<string, TypeSystemValue>

  constructor({
    context,
    destinationPath,
    properties,
    required = [],
    generatorKey,
    rootRef
  }: EffectStructArgs) {
    super({ context, generatorKey })

    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        toEffectValue({
          context,
          destinationPath,
          schema: property,
          required: required.includes(key),
          rootRef
        })
      ])
    )
  }

  override toString(): string {
    const fields = Object.entries(this.properties)
      .map(([key, value]) => `${toPropertyKey(key)}: ${value}`)
      .join(', ')

    return `${SCHEMA}.Struct({${fields}})`
  }
}

type EffectRecordArgs = {
  context: GenerateContextType
  destinationPath: string
  schema: true | OasSchema | OasRef<'schema'>
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class EffectRecord extends TsSnippet {
  value: TypeSystemValue | undefined

  constructor({ context, destinationPath, schema, generatorKey, rootRef }: EffectRecordArgs) {
    super({ context, generatorKey })

    this.value =
      schema === true || isEmpty(schema)
        ? undefined
        : toEffectValue({ context, destinationPath, schema, required: true, rootRef })
  }

  override toString(): string {
    const value = this.value ?? `${SCHEMA}.Unknown`

    return `${SCHEMA}.Record({ key: ${SCHEMA}.String, value: ${value} })`
  }
}
