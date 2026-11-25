/**
 * The generate side of refs that do not point at a component
 * (skmtc/skmtc#387). A model generator receives `refName` and `refPath` in its
 * identity statics and decides the name; core keys a component by `refName`
 * alone, as before, and any other target by its whole pointer.
 *
 * Uses neutral doubles only (MockFile / MockDefinition / MockImport /
 * IdentifierBase) — core tests stay language-agnostic.
 */

import { assert, assertEquals, assertExists, assertInstanceOf } from '@std/assert'
import * as log from '@std/log'
import * as v from 'valibot'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { CodeFileBase } from '@/dsl/CodeFileBase.ts'
import { SnippetBase } from '@/dsl/SnippetBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { MockDefinition, MockFile, MockImport } from '@/test/MockFile.ts'
import { toModelProjectionBase } from '@/dsl/model/toModelProjectionBase.ts'
import { toModelEntry } from '@/dsl/model/toModelEntry.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import type { IdentifierType } from '@/dsl/IdentifierType.ts'
import type { Lang } from '@/dsl/Lang.ts'
import type { ClientSettings } from '@/types/Settings.ts'
import type { ModelProjectionConstructorArgs } from '@/dsl/model/types.ts'
import type { RefParts } from '@/helpers/refFns.ts'
import type { RefName } from '@/types/RefName.ts'

const neutralLang: Lang = {
  createFile: ({ path }) => new MockFile({ path }),
  toDefinition: ({ context, identifier, value }) => new MockDefinition({ context, identifier, value }),
  toImport: ({ identifier, module }) => new MockImport({ names: [identifier.name], module }),
  toIdentifier: ({ name, typeName }) => new IdentifierBase({ name, typeName })
}

class NeutralSnippet extends SnippetBase {
  static lang: Lang = neutralLang

  override toString(): string {
    return ''
  }
}

type Label = Enrichments<{ label: string } | undefined>

const labelSchema: v.GenericSchema<Label> = v.object({
  subject: v.undefinedable(v.object({ label: v.string() })),
  generator: v.undefined(),
  stack: v.undefined()
})

/** What each identity static was called with, in order. */
const seen: RefParts[] = []

/** Names a deep ref from its whole pointer, so two targets that share a `refName` get two names. */
const toName = ({ refName, refPath }: RefParts): string =>
  refPath === '#/components/schemas' ? refName : `${refPath}/${refName}`.replace(/\W+/g, '_')

const ModelBase = toModelProjectionBase<Label, IdentifierType>(NeutralSnippet, {
  id: '@test/ref-path',
  toIdentifierName: ({ ref }) => {
    seen.push(ref)
    return toName(ref)
  },
  toIdentifierType: () => ({ type: 'entity' }),
  toExportPath: ({ ref }) => `@/models/${toName(ref)}.ts`,
  toEnrichmentSchema: () => labelSchema
})

/** A model that inserts each property that is a ref as a model of its own. */
class RefModel extends ModelBase {
  label: string | undefined
  properties: string[]

  constructor(args: ModelProjectionConstructorArgs<Label>) {
    super(args)

    this.label = this.settings.enrichments.subject?.label

    const schema = args.context.resolveSchemaRefOnce(args.ref)

    this.properties = schema.isRef() || schema.type !== 'object'
      ? []
      : Object.values(schema.properties ?? {}).flatMap(property =>
          property.isRef() ? [this.insertModel(RefModel, property).toName()] : []
        )
  }

  override toString() {
    return this.properties.join(', ')
  }
}

const entry = toModelEntry<Label>({
  id: '@test/ref-path',
  toEnrichmentSchema: () => labelSchema,
  transform: ({ context, ref }) => {
    context.insertModel(RefModel, ref)
  }
})

const text = { type: 'string' }

const document = {
  openapi: '3.1.0',
  info: { title: 'Ref paths', version: '1' },
  paths: {},
  components: {
    schemas: {
      ChatResponse: { type: 'object', properties: { result: { type: 'object', properties: { text } } } },
      UsesResult: { type: 'object', properties: { result: { $ref: '#/components/schemas/ChatResponse/properties/result' } } },
      diskWithCursor: { type: 'object', properties: { disk: { type: 'object', required: ['id'], properties: { id: text } } } },
      webServiceDetails: { type: 'object', properties: { disk: { type: 'object', properties: { size: text } } } },
      Disks: {
        type: 'object',
        properties: {
          first: { $ref: '#/components/schemas/diskWithCursor/properties/disk' },
          second: { $ref: '#/components/schemas/webServiceDetails/properties/disk' }
        }
      }
    }
  }
}

const generate = (settings: ClientSettings | undefined) => {
  seen.length = 0

  const parsed = new ParseContext({
    // Documents in the wild hold what the parser's input type does not allow.
    input: { type: 'oas', value: JSON.parse(JSON.stringify(document)) },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  }).parse(new StackTrail(['TEST']))

  const context = new GenerateContext({
    document: parsed,
    settings,
    logger: new log.Logger('test', 'ERROR'),
    captureCurrentResult: () => {},
    // deno-lint-ignore no-explicit-any
    toGeneratorConfigMap: () => ({ '@test/ref-path': entry }) as any
  })

  const { files } = context.toArtifacts(new StackTrail(['TEST']))

  const toDefinition = (name: string) => {
    const file = files.get(`@/models/${name}.generated.ts`)
    assertInstanceOf(file, CodeFileBase)
    const [definition] = file.findDefinitions({ name }) ?? []
    assertExists(definition)
    assertInstanceOf(definition.value, RefModel)
    return { generatorKey: definition.generatorKey, value: definition.value }
  }

  return { toDefinition }
}

const deepName = toName({ refName: 'result' as RefName, refPath: '#/components/schemas/ChatResponse/properties' })

Deno.test('ref path - toIdentifierName receives the ref, with refPath #/components/schemas for a component', () => {
  generate(undefined)

  assert(seen.some(call => call.refName === 'UsesResult' && call.refPath === '#/components/schemas'))
  assert(seen.some(call => call.refName === 'result' && call.refPath === '#/components/schemas/ChatResponse/properties'))
})

Deno.test('ref path - a component keeps its generator key, and a deep target is keyed by its whole pointer', () => {
  const { toDefinition } = generate(undefined)

  assertEquals(toDefinition('UsesResult').generatorKey, '@test/ref-path|UsesResult|main')
  assertEquals(toDefinition(deepName).generatorKey, '@test/ref-path|#/components/schemas/ChatResponse/properties/result|main')
  assertEquals(String(toDefinition('UsesResult').value), deepName)
})

Deno.test("ref path - a component's enrichments are read by its name, a deep target's by its whole pointer", () => {
  const { toDefinition } = generate({
    enrichments: {
      '@test/ref-path': {
        UsesResult: { main: { label: 'component' } },
        '#/components/schemas/ChatResponse/properties/result': { main: { label: 'deep' } }
      }
    }
  })

  assertEquals(toDefinition('UsesResult').value.label, 'component')
  assertEquals(toDefinition(deepName).value.label, 'deep')
})

Deno.test('ref path - two deep targets that share a refName build two models, when the generator names them apart', () => {
  // The trap: render.com refers to two different schemas called `disk`.
  const { toDefinition } = generate(undefined)
  const first = toName({ refName: 'disk' as RefName, refPath: '#/components/schemas/diskWithCursor/properties' })
  const second = toName({ refName: 'disk' as RefName, refPath: '#/components/schemas/webServiceDetails/properties' })

  assertEquals(String(toDefinition('Disks').value), `${first}, ${second}`)
  assertEquals(toDefinition(first).generatorKey, '@test/ref-path|#/components/schemas/diskWithCursor/properties/disk|main')
  assertEquals(toDefinition(second).generatorKey, '@test/ref-path|#/components/schemas/webServiceDetails/properties/disk|main')
})
