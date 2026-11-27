import { assertEquals, assertStrictEquals } from '@std/assert'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile, MockImport } from '@/test/MockFile.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { toOasOperationProjectionBase } from '@/dsl/operation/oas/toOasOperationProjectionBase.ts'
import { toOasOperationEntry } from '@/dsl/operation/oas/toOasOperationEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import { toSchemaComponentRef } from '@/helpers/refFns.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { RefName } from '@/types/RefName.ts'
import type { DeclaredModelProjection, DeclaredProjection } from '@/dsl/DeclaredProjection.ts'

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) =>
    new MockDefinition({ context, identifier, value }),
  toImport: ({ identifier, module }) => new MockImport({ names: [identifier.name], module }),
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

type SuffixOptions = { suffix: string }

/** A model projection with caller options: its path depends on them. */
class SuffixedModel extends toModelProjectionBase<Enrichments, IdentifierType, SuffixOptions>(
  NeutralSnippet,
  {
    id: '@test/suffixed',
    toIdentifierName: ({ ref, options }) => `${ref.refName}${options.suffix}`,
    toIdentifierType: () => ({ type: 'entity' }),
    toExportPath: ({ ref, options }) => `@/models/${ref.refName}${options.suffix}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  }
) {}

/** A model projection with no options. */
class PlainModel extends toModelProjectionBase(NeutralSnippet, {
  id: '@test/plain',
  toIdentifierName: ({ ref }) => ref.refName,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ ref }) => `@/models/${ref.refName}.ts`,
  toEnrichmentSchema: () => emptyEnrichmentSchema
}) {}

class Handler extends toOasOperationProjectionBase(NeutralSnippet, {
  id: '@test/handler',
  toIdentifierName: () => 'handler',
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: () => '@/handlers/handler.ts',
  toEnrichmentSchema: () => emptyEnrichmentSchema
}) {}

// The trap: projection classes differ in their enrichment and option types,
// and a list typed with one of them refuses the others. `DeclaredProjection`
// has to take all of them in one list, or an operation generator cannot name
// the model projections it inserts. This test fails at compile time first.
Deno.test('DeclaredProjection - an entry keeps every projection class it declares, of any kind', () => {
  const projections: DeclaredProjection[] = [Handler, PlainModel, SuffixedModel]

  const entry = toOasOperationEntry({
    id: '@test/handler',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    projections
  })

  assertStrictEquals(entry.projections, projections)
  assertEquals(
    entry.projections?.map(({ id, type }) => `${type} ${id}`),
    ['oasOperation @test/handler', 'model @test/plain', 'model @test/suffixed']
  )
})

Deno.test('DeclaredProjection - a model entry keeps its list too', () => {
  const entry = toModelEntry({
    id: '@test/plain',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    projections: [PlainModel]
  })

  assertEquals(entry.projections, [PlainModel])
})

Deno.test('DeclaredProjection - an entry that declares none has no list', () => {
  const entry = toModelEntry({
    id: '@test/plain',
    transform: () => {},
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(entry.projections, undefined)
})

// What the list is for: core asks a declared class where a subject's file
// is, and constructs nothing.
Deno.test('DeclaredProjection - a declared class gives a subject its file from statics alone', () => {
  const declared: DeclaredModelProjection = PlainModel
  const ref = toSchemaComponentRef('Pet' as RefName)

  assertEquals(
    declared.toExportPath({ ref, enrichments: undefined, variant: 'main', options: undefined }),
    '@/models/Pet.ts'
  )
})
