/**
 * SPIKE (option 2 — class-carried lang; see `notes/lang/14`).
 *
 * Proves the three load-bearing claims of the base-as-param model:
 *
 * 1. A core factory can take a language snippet base class and build the
 *    projection machinery on top of it, type-safely — consumed here through
 *    the lang package's veneer (`toTsModelProjectionBase` from
 *    `@skmtc/lang-typescript`), which pre-binds `TsSnippet` and adds
 *    the register ergonomics.
 * 2. The language static (`lang`) is inherited through the whole chain —
 *    `TsSnippet` → factory class → generator subclass — so the Driver reads
 *    it pre-construction with NO config-map resolution (the
 *    `toGeneratorConfigMap` here is EMPTY; `resolveLang` would throw).
 * 3. A snippet with NO `generatorKey` can register — the F7 bug does not
 *    exist in this model.
 */
import { TsFile, TsSnippet, createVariable, toTsModelProjectionBase, typescript } from '@skmtc/lang-typescript'
import { toGenerateContext } from '../../test/toGenerateContext.ts'
import type { ModelProjectionArgs } from '@/dsl/model/toModelProjectionBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import type { RefName } from '@/types/RefName.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { assertInstanceOf } from '@std/assert/instance-of'

type SpikeFieldArgs = {
  context: GenerateContextType
  name: string
  destinationPath: string
}

/**
 * A registering snippet constructed WITHOUT a `generatorKey` — under the
 * generatorId model this throws ("Cannot register from a snippet that has
 * no generatorKey"); under class-carried lang it must work.
 */
class SpikeField extends TsSnippet {
  name: string

  constructor({ context, name, destinationPath }: SpikeFieldArgs) {
    super({ context })

    this.name = name

    this.register({
      imports: { '@/lib/helpers': ['formatLabel'] },
      destinationPath
    })
  }

  override toString(): string {
    return `formatLabel('${this.name}')`
  }
}

const SpikeModelBase = toTsModelProjectionBase({
  id: '@spike/gen-option2',
  toIdentifierName: ({ refName }) => `${refName}Spike`,
  toIdentifierType: () => ({ type: 'variable' }),
  toExportPath: () => '@/spike/models.generated.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

class SpikeModel extends SpikeModelBase {
  // deno-lint-ignore no-explicit-any
  static schemaToValueFn: any = () => ({ toString: () => '' })
  static createIdentifier = createVariable

  field: SpikeField

  constructor(args: ModelProjectionArgs<Enrichments>) {
    super(args)

    this.field = new SpikeField({
      context: args.context,
      name: args.refName,
      destinationPath: this.settings.exportPath
    })

    this.register({ imports: { zod: ['z'] } })
  }

  override toString(): string {
    return `z.object({ label: ${this.field} })`
  }
}

Deno.test('option2 spike - static lang is inherited through the factory chain', () => {
  // TsSnippet (static lang) -> factory class expression -> generator subclass
  assertEquals(SpikeModel.lang, typescript)
})

Deno.test('option2 spike - insertModel end-to-end with an EMPTY config map; keyless snippet registers', () => {
  const context = toGenerateContext()

  const inserted = context.insertModel(SpikeModel, 'User' as RefName)

  assertEquals(inserted.toName(), 'UserSpike')

  // The value is genuinely built on the language base — the hierarchy is
  // language-bound at its root.
  assertInstanceOf(inserted.definition.value, TsSnippet)
  assertInstanceOf(inserted.definition.value, SnippetBase)

  // The destination file was created caller-side through the language —
  // it is the language's own File class, not a core fallback.
  const file = context.getFile('@/spike/models.generated.ts')
  assertInstanceOf(file, TsFile)

  // Both registrations landed: the KEYLESS snippet's import and the
  // projection's own.
  const rendered = file.toString()
  assertStringIncludes(rendered, `import {formatLabel} from '@/lib/helpers'`)
  assertStringIncludes(rendered, `import {z} from 'zod'`)
  assertStringIncludes(rendered, 'export const UserSpike')
  assertStringIncludes(rendered, `z.object({ label: formatLabel('User') })`)
})

Deno.test('option2 spike - cross-file insertion registers the peer import via the class-carried lang', () => {
  const context = toGenerateContext()

  // Insert the same model from a DIFFERENT destination file: the Driver
  // must build the cross-file import through projection.lang (static) and
  // create the destination file caller-side — all with an empty config map.
  const inserted = context.insertModel(SpikeModel, 'Order' as RefName, {
    destinationPath: '@/consumers/page.generated.ts'
  })

  assertEquals(inserted.toName(), 'OrderSpike')

  const consumerFile = context.getFile('@/consumers/page.generated.ts')
  assertInstanceOf(consumerFile, TsFile)

  assertStringIncludes(
    consumerFile.toString(),
    `import {OrderSpike} from '@/spike/models.generated.ts'`
  )
})
