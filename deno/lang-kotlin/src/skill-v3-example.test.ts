/**
 * H1 gate for the `skmtc-lang-kotlin-v3` skill (notes/skills-tools):
 * the skill's worked example — a kotlinx-serialization data class — run
 * through the real engine using EXACTLY the call shapes the skill
 * teaches, pinned byte-for-byte against the rendered output the skill
 * promises. If this test fails, fix the SKILL (or the skill's claim),
 * not the test's expectations, unless the lang API itself moved.
 *
 * Call shapes under test (skill §6/§8):
 * - `KtAnnotation` object-args, self-registering its import via
 *   `packageName` + `destinationPath`
 * - `sanitizePropertyName(camelCase(key))` + the unescaped-name vs
 *   wire-key comparison deciding `@SerialName`
 * - `KtParameterList` entries with `defaultValue: 'null'` for optionals,
 *   the type expression owning the single `?`
 * - the mirrored `annotations` / `description` protocol getters on the
 *   projection wrapper (the Driver wraps the PROJECTION as the value)
 * - head+value: `data-class` identifier head + parameter-list value
 */
import { GenerateContext, OasDocument, camelCase, capitalize, emptyEnrichmentSchema } from '@skmtc/core'
import type {
  Enrichments,
  GenerateContextType,
  ModelProjectionConstructorArgs,
  RefName
} from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'
import { assertEquals } from '@std/assert/equals'
import { KtAnnotation } from './KtAnnotation.ts'
import { KtParameterList } from './KtParameterList.ts'
import type { KtParameterArgs } from './KtParameterList.ts'
import { KtSnippet } from './KtSnippet.ts'
import { createDataClass } from './createIdentifier.ts'
import { sanitizePropertyName } from './sanitizePropertyName.ts'
import { toKtModelProjectionBase } from './toKtModelProjectionBase.ts'

const toGenerateContext = (): GenerateContextType => {
  return new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new log.Logger('test', 'ERROR'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })
}

/** The wire-format properties of the skill's example schema. */
const WIRE_PROPERTIES: ReadonlyArray<{ key: string; type: string; required: boolean }> = [
  { key: 'user_id', type: 'String', required: true },
  { key: 'name', type: 'String', required: true },
  { key: 'email', type: 'String?', required: false }
]

type ExampleValueArgs = {
  context: GenerateContextType
  destinationPath: string
}

/** The value object, built with the skill §8 per-property loop verbatim. */
class ExampleDataClassValue extends KtSnippet {
  annotations: KtAnnotation[]
  description: string | undefined = undefined
  parameterList: KtParameterList

  constructor({ context, destinationPath }: ExampleValueArgs) {
    super({ context })

    this.annotations = [
      new KtAnnotation({
        context,
        destinationPath,
        name: 'Serializable',
        packageName: 'kotlinx.serialization'
      })
    ]

    const parameters: KtParameterArgs[] = WIRE_PROPERTIES.map(({ key, type, required }) => {
      const propertyName = sanitizePropertyName(camelCase(key))
      const annotations: KtAnnotation[] = []

      if (propertyName.replaceAll('`', '') !== key) {
        annotations.push(
          new KtAnnotation({
            context,
            destinationPath,
            name: 'SerialName',
            packageName: 'kotlinx.serialization',
            args: [`"${key}"`]
          })
        )
      }

      return {
        name: propertyName,
        type,
        defaultValue: required ? undefined : 'null',
        annotations
      }
    })

    this.parameterList = new KtParameterList(parameters)
  }

  override toString(): string {
    return `${this.parameterList}`
  }
}

const ExampleBase = toKtModelProjectionBase({
  id: '@skill/lang-kotlin-v3-example',
  toIdentifierName: ({ refName }) => capitalize(camelCase(refName)),
  toIdentifierType: () => ({ type: 'data-class' }),
  toExportPath: ({ refName }) =>
    `@/com/example/api/${capitalize(camelCase(refName))}.generated.kt`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class ExampleProjection extends ExampleBase {
  value: ExampleDataClassValue

  constructor(args: ModelProjectionConstructorArgs<Enrichments<undefined, undefined, undefined>>) {
    super(args)

    this.value = new ExampleDataClassValue({
      context: args.context,
      destinationPath: this.settings.exportPath
    })
  }

  // The mirrored protocols (skill §5/§8): the Driver wraps THIS object as
  // the KtDefinition's value, so KtDefinition reads them off the wrapper.
  get annotations(): KtAnnotation[] {
    return this.value.annotations
  }

  get description(): string | undefined {
    return this.value.description
  }

  // deno-lint-ignore no-explicit-any
  static schemaToValueFn: any = () => ({ toString: () => '' })
  static createIdentifier = createDataClass

  override toString(): string {
    return `${this.value}`
  }
}

Deno.test('skill-v3 worked example renders byte-for-byte as the skill promises', () => {
  const context = toGenerateContext()

  context.insertModel(ExampleProjection, 'User' as RefName)

  const file = context.getFile('@/com/example/api/User.generated.kt')

  assertEquals(
    file?.toString(),
    `package com.example.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    @SerialName("user_id")
    val userId: String,
    val name: String,
    val email: String? = null
)
`
  )
})
