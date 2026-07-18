/**
 * The union-assigns-parent pattern at the engine boundary.
 *
 * A union schema's projection inserts each member (idempotent, memoized)
 * and assigns generator-owned state onto the member instance it gets back
 * (`inserted.definition.value`) — a supertype clause here. The member
 * behaves as if it were standalone; only the union knows the membership.
 *
 * The invariant under test: **visit order does not matter.** Whether the
 * ModelDriver constructs the member before the union (member's own visit
 * hits the cache when the union inserts) or after (the union's insert
 * primes the cache for the member's own visit), there is exactly one
 * member instance, and a mutation made during any generate-phase
 * transform is visible at render.
 *
 * Uses neutral doubles only (MockFile / MockDefinition / IdentifierBase)
 * — core tests stay language-agnostic.
 */

import { assertExists, assertStringIncludes } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from './GenerateContext.ts'
import { StackTrail } from './StackTrail.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import { OasComponents } from '@/oas/components/Components.ts'
import { OasString } from '@/oas/string/String.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile } from '@/test/MockFile.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ModelProjectionConstructorArgs } from '@/dsl/model/types.ts'
import type { RefName } from '@/types/RefName.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) => new MockDefinition({ context, identifier, value }),
  toImport: () => {
    throw new Error('this test registers no cross-file imports')
  },
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

const ModelBase = toModelProjectionBase<Enrichments>(NeutralSnippet, {
  id: '@test/union-mutation',
  toIdentifierName: ({ refName }) => refName,
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: () => '@/models.txt',
  toEnrichmentSchema: () => emptyEnrichmentSchema
})

/**
 * Every schema renders as its own name; a union member additionally
 * renders the supertype clause the union assigned. `Parent` plays the
 * union: it inserts `Child` and pushes itself onto the member's
 * `supertypes` — the member never learns about unions.
 */
class UnionAwareModel extends ModelBase {
  supertypes: string[] = []

  constructor(args: ModelProjectionConstructorArgs<Enrichments>) {
    super(args)

    if (args.refName === 'Parent') {
      const member = args.context.insertModel(UnionAwareModel, 'Child' as RefName)
      member.definition.value.supertypes.push('Parent')
    }
  }

  override toString(): string {
    const clause = this.supertypes.length ? ` : ${this.supertypes.join(', ')}` : ''
    return `${this.refName}${clause}`
  }
}

const buildContext = (schemaNames: string[]) => {
  const document = new OasDocument({
    openapi: '3.0.0',
    info: new OasInfo({ title: 'Test', version: '1.0.0' }),
    operations: [],
    components: new OasComponents({
      schemas: Object.fromEntries(schemaNames.map(name => [name, new OasString({})]))
    })
  })

  const entry = toModelEntry({
    id: '@test/union-mutation',
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    transform: ({ context, refName }) => {
      context.insertModel(UnionAwareModel, refName)
    }
  })

  return new GenerateContext({
    document: { type: 'oas', value: document },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/union-mutation': entry }) as any
  })
}

const renderModelsFile = (schemaNames: string[]): string => {
  const context = buildContext(schemaNames)
  const { files } = context.toArtifacts(new StackTrail(['test']))

  const file = files.get('@/models.generated.txt')
  assertExists(file)

  return file.toString()
}

Deno.test('insert-mutation - member visited BEFORE the union still renders the assigned supertype', () => {
  const content = renderModelsFile(['Child', 'Parent'])

  assertStringIncludes(content, 'def Child = Child : Parent')
  assertStringIncludes(content, 'def Parent = Parent')
})

Deno.test('insert-mutation - union visited BEFORE the member still renders the assigned supertype', () => {
  const content = renderModelsFile(['Parent', 'Child'])

  assertStringIncludes(content, 'def Child = Child : Parent')
  assertStringIncludes(content, 'def Parent = Parent')
})
