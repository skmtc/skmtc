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
import { toEffectValue } from './Effect.ts'
import { applyModifiers } from './modifiers.ts'
import { EffectUnknown } from './EffectScalars.ts'
import { LIB, LIB_MODULE } from './lib.ts'

type EffectObjectArgs = {
  context: GenerateContextType
  destinationPath: string
  objectSchema: OasObject
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

export class EffectObject extends TsSnippet {
  type = 'object' as const
  objectProperties: EffectObjectProperties | null
  recordProperties: EffectRecord | null
  modifiers: Modifiers

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      objectSchema,
      modifiers,
      rootRef,
    }: EffectObjectArgs,
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
      ? new EffectRecord({
        context,
        generatorKey,
        destinationPath,
        schema: additionalProperties,
        rootRef,
      })
      : null

    this.objectProperties = hasProperties
      ? new EffectObjectProperties({
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
    // one schema — the target's intersection syntax.
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

type EffectObjectPropertiesArgs = {
  context: GenerateContextType
  destinationPath: string
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: OasObject['required']
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class EffectObjectProperties extends TsSnippet {
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
    }: EffectObjectPropertiesArgs,
  ) {
    super({ context, generatorKey })

    this.required = required

    // The property loop: every value comes from the router — a snippet,
    // never rendered text. Optionality flows into each leaf's modifiers.
    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        toEffectValue({
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

    return `${LIB}.Struct({ ${fields} })`
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
  value: TypeSystemValue

  constructor(
    { context, generatorKey, destinationPath, schema, rootRef }:
      EffectRecordArgs,
  ) {
    super({ context, generatorKey })

    // additionalProperties: true (or an empty schema) means untyped
    // values — route to the unknown fallback, never throw.
    this.value = schema === true || isEmpty(schema)
      ? new EffectUnknown({ context, destinationPath, generatorKey })
      : toEffectValue({
        destinationPath,
        schema,
        required: true,
        context,
        rootRef,
      })
  }

  override toString(): string {
    // SLOT(record): string-keyed map of this.value.
    return `${LIB}.Record({ key: ${LIB}.String, value: ${this.value} })`
  }
}
