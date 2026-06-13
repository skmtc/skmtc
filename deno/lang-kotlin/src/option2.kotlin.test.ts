/**
 * The option-2 fixture suite, ported to Kotlin (note 19, step 3 gate).
 *
 * Proves the same load-bearing claims the TypeScript original
 * (`core/dsl/model/option2.spike.test.ts`) proves, on the second language:
 *
 * 1. Static-lang inheritance through the chain — `KtSnippet` → factory
 *    class → generator subclass — so the Driver reads `projection.lang`
 *    pre-construction with NO config-map resolution (the config map here
 *    is EMPTY).
 * 2. End-to-end `insertModel` with an EMPTY config map: the destination
 *    file is created caller-side through the language (`KtFile`), the
 *    Definition is the language's own (`KtDefinition`).
 * 3. A snippet with NO `generatorKey` can register (keyless registers).
 * 4. Cross-file insertion registers the peer import via the ephemeral
 *    static read — and, Kotlin-specifically, that import is SUPPRESSED
 *    when the destination shares the peer's package.
 */
import { GenerateContext, OasDocument, SnippetBase } from '@skmtc/core'
import type { GenerateContextType, ModelProjectionConstructorArgs, RefName } from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'
import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { assertNotMatch } from '@std/assert/not-match'
import { assertInstanceOf } from '@std/assert/instance-of'
import { KtSnippet } from './KtSnippet.ts'
import { KtFile } from './KtFile.ts'
import { kotlin } from './ktLang.ts'
import { toModelProjectionBase } from './toModelProjectionBase.ts'
import { createValue } from './createIdentifier.ts'

const toGenerateContext = (): GenerateContextType => {
  return new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new log.Logger('test', 'ERROR'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })
}

type SpikeFieldArgs = {
  context: GenerateContextType
  name: string
  destinationPath: string
}

/**
 * A registering snippet constructed WITHOUT a `generatorKey` — keyless
 * registers must work on the Kotlin base exactly as they do on TsSnippet.
 */
class SpikeField extends KtSnippet {
  name: string

  constructor({ context, name, destinationPath }: SpikeFieldArgs) {
    super({ context })

    this.name = name

    this.register({
      imports: { 'com.example.helpers': ['formatLabel'] },
      destinationPath
    })
  }

  override toString(): string {
    return `formatLabel("${this.name}")`
  }
}

const SpikeModelBase = toModelProjectionBase({
  id: '@spike/gen-kotlin-option2',
  toIdentifierName: ({ refName }) => `${refName}Spike`,
  toIdentifierType: () => ({ kind: 'val' }),
  toExportPath: () => '@/spike/models/Models.generated.kt'
})

class SpikeModel extends SpikeModelBase {
  // deno-lint-ignore no-explicit-any
  static schemaToValueFn: any = () => ({ toString: () => '' })
  static createIdentifier = createValue

  field: SpikeField

  constructor(args: ModelProjectionConstructorArgs) {
    super(args)

    this.field = new SpikeField({
      context: args.context,
      name: args.refName,
      destinationPath: this.settings.exportPath
    })

    this.register({ imports: { 'kotlinx.serialization.json': ['Json'] } })
  }

  override toString(): string {
    return `Json.encodeToString(${this.field})`
  }
}

Deno.test('kotlin option2 port - static lang is inherited through the factory chain', () => {
  // KtSnippet (static lang) -> factory class expression -> generator subclass
  assertEquals(SpikeModel.lang, kotlin)
})

Deno.test('kotlin option2 port - insertModel end-to-end with an EMPTY config map; keyless snippet registers', () => {
  const context = toGenerateContext()

  const inserted = context.insertModel(SpikeModel, 'User' as RefName)

  assertEquals(inserted.toName(), 'UserSpike')

  // The value is genuinely built on the language base — the hierarchy is
  // language-bound at its root.
  assertInstanceOf(inserted.definition.value, KtSnippet)
  assertInstanceOf(inserted.definition.value, SnippetBase)

  // The destination file was created caller-side through the language —
  // it is the language's own File class, not a core fallback.
  const file = context.getFile('@/spike/models/Models.generated.kt')
  assertInstanceOf(file, KtFile)

  // Both registrations landed: the KEYLESS snippet's import and the
  // projection's own. The file's package directive is derived from its
  // path; visibility renders nothing (public default).
  const rendered = file.toString()
  assertStringIncludes(rendered, 'package spike.models')
  assertStringIncludes(rendered, 'import com.example.helpers.formatLabel')
  assertStringIncludes(rendered, 'import kotlinx.serialization.json.Json')
  assertStringIncludes(rendered, 'val UserSpike = Json.encodeToString(formatLabel("User"))')
})

Deno.test('kotlin option2 port - cross-file insertion registers the peer import via the class-carried lang', () => {
  const context = toGenerateContext()

  // Insert the model from a destination in a DIFFERENT package: the Driver
  // builds the cross-file import through projection.lang (static), and the
  // KtFile renders it as a package-resolved Kotlin import.
  const inserted = context.insertModel(SpikeModel, 'Order' as RefName, {
    destinationPath: '@/consumers/Page.generated.kt'
  })

  assertEquals(inserted.toName(), 'OrderSpike')

  const consumerFile = context.getFile('@/consumers/Page.generated.kt')
  assertInstanceOf(consumerFile, KtFile)

  assertStringIncludes(consumerFile.toString(), 'import spike.models.OrderSpike')
})

Deno.test('kotlin option2 port - the peer import is suppressed when the destination shares the package', () => {
  const context = toGenerateContext()

  // Same package as the peer's export file (spike.models) — Kotlin needs
  // no import for same-package symbols, so the Driver-registered import
  // must vanish at render.
  context.insertModel(SpikeModel, 'Invoice' as RefName, {
    destinationPath: '@/spike/models/Sibling.generated.kt'
  })

  const siblingFile = context.getFile('@/spike/models/Sibling.generated.kt')
  assertInstanceOf(siblingFile, KtFile)

  const rendered = siblingFile.toString()
  assertNotMatch(rendered, /import spike\.models\.InvoiceSpike/)
  assertStringIncludes(rendered, 'package spike.models')
})
