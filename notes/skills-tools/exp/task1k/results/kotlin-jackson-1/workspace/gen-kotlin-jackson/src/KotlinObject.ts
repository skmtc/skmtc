import { camelCase, isEmpty } from '@skmtc/core'
import {
  KtAnnotation,
  KtParameterList,
  KtSnippet,
  sanitizePropertyName,
} from '@skmtc/lang-kotlin'
import type { KtParameterArgs } from '@skmtc/lang-kotlin'
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
import { toKotlinValue } from './Kotlin.ts'
import { applyModifiers, isNullish } from './modifiers.ts'
import { KotlinUnknown } from './KotlinScalars.ts'
import { JACKSON_ANNOTATION_PACKAGE, JSON_PROPERTY } from './lib.ts'

type KotlinObjectArgs = {
  context: GenerateContextType
  destinationPath: string
  objectSchema: OasObject
  modifiers: Modifiers
  generatorKey: GeneratorKey
  rootRef?: RefName
}

/**
 * An object reached as a VALUE — an inline nested object, not a top-level
 * model. Kotlin has no anonymous class literal, so this can only render a
 * map type; a top-level object takes the `data class` path instead, via
 * `KotlinProjection` (see shape.ts).
 */
export class KotlinObject extends KtSnippet {
  type = 'object' as const
  objectProperties: KotlinObjectProperties | null
  recordProperties: KotlinRecord | null
  modifiers: Modifiers

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      objectSchema,
      modifiers,
      rootRef,
    }: KotlinObjectArgs,
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
      ? new KotlinRecord({
        context,
        generatorKey,
        destinationPath,
        schema: additionalProperties,
        rootRef,
      })
      : null

    this.objectProperties = hasProperties
      ? new KotlinObjectProperties({
        context,
        generatorKey,
        destinationPath,
        properties,
        // 'required' lists which PROPERTIES are required — it is not
        // about the object itself. Each property's optionality renders at
        // that property's own leaf via its modifiers.
        required,
        rootRef,
      })
      : null
  }

  override toString(): string {
    const { recordProperties } = this

    // SLOT(object-intersection) / SLOT(object-empty): both collapse into
    // the map form here. An inline object's declared properties cannot be
    // named in a type position, so they widen to `Map<String, Any?>` —
    // the properties themselves were still walked, so any `$ref` nested
    // inside one has its own model generated.
    return applyModifiers(
      recordProperties?.toString() ?? 'Map<String, Any?>',
      this.modifiers,
    )
  }
}

type Visibility = {
  readOnly: boolean
  writeOnly: boolean
}

type KotlinObjectPropertiesArgs = {
  context: GenerateContextType
  destinationPath: string
  properties: Record<string, OasSchema | OasRef<'schema'> | CustomValue>
  required: OasObject['required']
  generatorKey: GeneratorKey
  rootRef?: RefName
}

/**
 * The primary-constructor property list of a `data class` — the VALUE
 * that renders after the `data class Name` head, parentheses included.
 *
 * Exported because `KotlinProjection` builds it directly for a top-level
 * object model: the declaration shell only makes sense where there is a
 * name to attach it to.
 */
export class KotlinObjectProperties extends KtSnippet {
  properties: Record<string, TypeSystemValue>
  required: string[]
  /** Per-property readOnly/writeOnly — see SLOT(visibility). */
  visibility: Record<string, Visibility>
  parameterList: KtParameterList

  constructor(
    {
      context,
      generatorKey,
      destinationPath,
      properties,
      required = [],
      rootRef,
    }: KotlinObjectPropertiesArgs,
  ) {
    super({ context, generatorKey })

    this.required = required

    // The property loop: every value comes from the router — a snippet,
    // never rendered text. Optionality flows into each leaf's modifiers.
    this.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => [
        key,
        toKotlinValue({
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

    // SLOT(object-properties): the Kotlin name is chosen first, then the
    // wire-name annotation is decided by comparing the two — sanitization
    // and renaming are different jobs that compose (skmtc-lang-kotlin §7).
    //
    // SLOT(visibility): this.visibility[key] carries readOnly/writeOnly.
    // Ignored here — Jackson DTOs are single-variant, and splitting them
    // into request/response classes is a `variant`-threading decision, not
    // a per-property one.
    const parameters: KtParameterArgs[] = Object.entries(properties).map(
      ([key, property]) => {
        const modifiers: Modifiers = {
          required: required.includes(key),
          nullable: 'nullable' in property ? property.nullable : undefined,
        }

        const name = sanitizePropertyName(camelCase(key))

        // A backticked hard keyword still EQUALS its wire key, so it needs
        // no annotation — compare the unescaped form.
        const annotations = name.replaceAll('`', '') === key ? [] : [
          new KtAnnotation({
            context,
            destinationPath,
            name: JSON_PROPERTY,
            packageName: JACKSON_ANNOTATION_PACKAGE,
            args: [`"${key}"`],
          }),
        ]

        return {
          name,
          // The SNIPPET, not `${snippet}` — passing the rendered string
          // would strand the imports it registered. It also already owns
          // the `?`, so `nullable` stays unset here.
          type: this.properties[key],
          defaultValue: isNullish(modifiers) ? 'null' : undefined,
          annotations,
        }
      },
    )

    this.parameterList = new KtParameterList(parameters)
  }

  override toString(): string {
    return `${this.parameterList}`
  }
}

type KotlinRecordArgs = {
  context: GenerateContextType
  destinationPath: string
  schema: true | OasSchema | OasRef<'schema'>
  generatorKey: GeneratorKey
  rootRef?: RefName
}

class KotlinRecord extends KtSnippet {
  value: TypeSystemValue

  constructor(
    { context, generatorKey, destinationPath, schema, rootRef }:
      KotlinRecordArgs,
  ) {
    super({ context, generatorKey })

    // additionalProperties: true (or an empty schema) means untyped
    // values — route to the unknown fallback, never throw.
    this.value = schema === true || isEmpty(schema)
      ? new KotlinUnknown({ context, destinationPath, generatorKey })
      : toKotlinValue({
        destinationPath,
        schema,
        required: true,
        context,
        rootRef,
      })
  }

  override toString(): string {
    // SLOT(record): string-keyed map of this.value.
    return `Map<String, ${this.value}>`
  }
}
