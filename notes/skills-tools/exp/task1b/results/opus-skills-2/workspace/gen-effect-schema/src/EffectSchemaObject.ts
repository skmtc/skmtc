import { isEmpty } from '@skmtc/core'
import { handleKey, TsSnippet } from '@skmtc/lang-typescript'
import type {
  CustomValue,
  GenerateContextType,
  GeneratorKey,
  Modifiers,
  OasObject,
  OasRef,
  OasSchema,
  RefName,
  TypeSystemValue,
} from '@skmtc/core'
import { toEffectSchemaValue } from './EffectSchema.ts'
import { applyModifiers } from './modifiers.ts'
import { EffectSchemaUnknown } from './EffectSchemaScalars.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectSchemaObjectArgs = {
  context: GenerateContextType
  destinationPath: string
  objectSchema: OasObject
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class EffectSchemaObject extends TsSnippet {
  type = 'object' as const
  objectProperties: EffectSchemaObjectProperties | null
  recordProperties: EffectSchemaRecord | null
  modifiers: Modifiers

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      objectSchema,
      modifiers,
      rootRef,
    }: EffectSchemaObjectArgs,
  ) {
    super({
      context,
      generatorKey,
      stackTrail: objectSchema.stackTrail.clone(),
    })

    this.modifiers = modifiers

    const { properties, required, additionalProperties } = objectSchema

    const hasProperties = properties && !isEmpty(properties)

    this.recordProperties = additionalProperties
      ? new EffectSchemaRecord({
        context,
        generatorKey,
        destinationPath,
        schema: additionalProperties,
        rootRef,
      })
      : null

    this.objectProperties = hasProperties
      ? new EffectSchemaObjectProperties({
        context,
        generatorKey,
        destinationPath,
        properties,
        // 'required' lists which PROPERTIES are required — it is not
        // about the object itself. Each property's optionality renders
        // at that property's own leaf via its modifiers.
        required,
        rootRef,
      })
      : null

    this.register({ imports: { [LIB_MODULE]: [LIB] }, destinationPath })
  }

  override toString(): string {
    const { objectProperties, recordProperties } = this

    // SLOT(object-intersection): properties + additionalProperties in
    // one schema — effect composes a struct with an index signature via
    // `Schema.extend(struct, record)`.
    if (objectProperties && recordProperties) {
      return applyModifiers(
        `${LIB}.extend(${objectProperties}, ${recordProperties})`,
        this.modifiers,
      )
    }

    // SLOT(object-empty): a fully unconstrained object.
    return applyModifiers(
      recordProperties?.toString() ?? objectProperties?.toString() ??
        `${LIB}.Struct({})`,
      this.modifiers,
    )
  }
}

type Visibility = {
  readOnly: boolean
  writeOnly: boolean
}

type EffectSchemaObjectPropertiesArgs = {
  context: GenerateContextType
  destinationPath: string
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: OasObject['required']
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class EffectSchemaObjectProperties extends TsSnippet {
  properties: Record<string, TypeSystemValue>
  required: string[]
  /** Per-property readOnly/writeOnly — see SLOT(visibility). */
  visibility: Record<string, Visibility>

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      properties,
      required = [],
      rootRef,
    }: EffectSchemaObjectPropertiesArgs,
  ) {
    super({ context, generatorKey })

    this.required = required

    // The property loop: every value comes from the router — a snippet,
    // never rendered text. Optionality flows into each leaf's modifiers.
    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        toEffectSchemaValue({
          destinationPath,
          schema: property,
          required: required.includes(key),
          context,
          rootRef,
        }),
      ]),
    )

    this.visibility = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        {
          readOnly: 'readOnly' in property && property.readOnly === true,
          writeOnly: 'writeOnly' in property && property.writeOnly === true,
        },
      ]),
    )
  }

  override toString(): string {
    // SLOT(object-properties): handleKey quotes keys that aren't valid
    // identifiers ('first-name' → quoted).
    //
    // SLOT(visibility): this.visibility[key] carries readOnly/writeOnly.
    // Default is to ignore them (single-variant output). Strategies if
    // the target needs them: annotate the value (e.g. `.readonly()`),
    // or emit request/response variants via the entry's `variant`
    // threading and drop writeOnly/readOnly fields respectively.
    const fields = Object.entries(this.properties)
      .map(([key, value]) => `${handleKey(key)}: ${value}`)
      .join(', ')

    return `${LIB}.Struct({${fields}})`
  }
}

type EffectSchemaRecordArgs = {
  context: GenerateContextType
  destinationPath: string
  schema: true | OasSchema | OasRef<'schema'>
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class EffectSchemaRecord extends TsSnippet {
  value: TypeSystemValue

  constructor(
    { context, generatorKey, destinationPath, schema, rootRef }:
      EffectSchemaRecordArgs,
  ) {
    super({ context, generatorKey })

    // additionalProperties: true (or an empty schema) means untyped
    // values — route to the unknown fallback, never throw.
    this.value = schema === true || isEmpty(schema)
      ? new EffectSchemaUnknown({ context, destinationPath, generatorKey })
      : toEffectSchemaValue({
        destinationPath,
        schema,
        required: true,
        context,
        rootRef,
      })
  }

  override toString(): string {
    // SLOT(record): string-keyed map of this.value. effect's Record
    // takes a single options object, not positional arguments.
    return `${LIB}.Record({key: ${LIB}.String, value: ${this.value}})`
  }
}
