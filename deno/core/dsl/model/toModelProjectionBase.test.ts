import { toModelProjectionBase } from './toModelProjectionBase.ts'
import { toEnrichmentsContext } from '@/test/toEnrichmentsContext.ts'
import { assertEquals } from '@std/assert/equals'
import type { RefName } from '@/types/RefName.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { TsSnippet, createType, createVariable } from '@skmtc/lang-typescript'
import type { ToModelIdentifierNameArgs, ToModelExportPathArgs } from '@/dsl/model/types.ts'
import { withVariant } from '@/helpers/withVariant.ts'
import { emptyEnrichmentSchema } from '@/types/Enrichments.ts'
import type { Enrichments } from '@/types/Enrichments.ts'
import * as v from 'valibot'

/**
 * The all-undefined enrichment umbrella a no-enrichment generator's
 * `toEnrichments` resolves to (parsed through `emptyEnrichmentSchema`).
 * The pure `toIdentifierName` / `toExportPath` statics receive this when
 * the projection declares no enrichments.
 */
const emptyEnrichments: Enrichments = {
  subject: undefined,
  generator: undefined,
  stack: undefined
}

Deno.test('toModelProjectionBase - returns a class constructor', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(typeof ModelClass, 'function')
  assertEquals(typeof ModelClass.prototype, 'object')
})

Deno.test('toModelProjectionBase - sets static id from config', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'typescript-models',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(ModelClass.id, 'typescript-models')
})

Deno.test('toModelProjectionBase - sets static type to model', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(ModelClass.type, 'model')
})

Deno.test('toModelProjectionBase - sets static toIdentifierName from config', () => {
  const identifierNameFn = ({ refName }: ToModelIdentifierNameArgs<Enrichments>) => refName

  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: identifierNameFn,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const name = ModelClass.toIdentifierName({
    refName: 'User' as RefName,
    enrichments: emptyEnrichments,
    variant: 'main'
  })
  assertEquals(name, 'User')
})

Deno.test('toModelProjectionBase - sets static toIdentifierType from config', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const identifierType = ModelClass.toIdentifierType('User' as RefName, {} as GenerateContextType)
  assertEquals(identifierType.type, 'type')
})

Deno.test('toModelProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = ({ refName }: ToModelExportPathArgs<Enrichments>) =>
    `./generated/${refName}.ts`

  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: exportPathFn,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const exportPath = ModelClass.toExportPath({
    refName: 'User' as RefName,
    enrichments: emptyEnrichments,
    variant: 'main'
  })
  assertEquals(exportPath, './generated/User.ts')
})

Deno.test('toModelProjectionBase - toEnrichments returns the empty umbrella with emptyEnrichmentSchema', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const enrichments = ModelClass.toEnrichments({
    refName: 'User' as RefName,
    context: toEnrichmentsContext({}) as unknown as GenerateContextType,
    variant: 'main'
  })

  assertEquals(enrichments, { subject: undefined, generator: undefined, stack: undefined })
})

Deno.test('toModelProjectionBase - toEnrichments returns the empty umbrella when no enrichments in context', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const enrichments = ModelClass.toEnrichments({
    refName: 'User' as RefName,
    context: toEnrichmentsContext({}) as unknown as GenerateContextType,
    variant: 'main'
  })

  assertEquals(enrichments, { subject: undefined, generator: undefined, stack: undefined })
})

Deno.test('toModelProjectionBase - static isSupported defaults to true when not configured', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(
    ModelClass.isSupported({
      refName: 'User' as RefName,
      context: { settings: {} } as GenerateContextType
    }),
    true
  )
})

Deno.test('toModelProjectionBase - static isSupported reflects the configured predicate', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema,
    // Only object-named models supported in this fixture.
    isSupported: ({ refName }) => refName === 'User'
  })

  const context = { settings: {} } as GenerateContextType
  assertEquals(ModelClass.isSupported({ refName: 'User' as RefName, context }), true)
  assertEquals(ModelClass.isSupported({ refName: 'Order' as RefName, context }), false)
})

Deno.test('toModelProjectionBase - toIdentifierName works with different refNames', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => `${refName}Model`,
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const userName = ModelClass.toIdentifierName({
    refName: 'User' as RefName,
    enrichments: emptyEnrichments,
    variant: 'main'
  })
  assertEquals(userName, 'UserModel')

  const productName = ModelClass.toIdentifierName({
    refName: 'Product' as RefName,
    enrichments: emptyEnrichments,
    variant: 'main'
  })
  assertEquals(productName, 'ProductModel')
})

Deno.test('toModelProjectionBase - toExportPath works with different refNames', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./types/${refName.toLowerCase()}.d.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  assertEquals(
    ModelClass.toExportPath({
      refName: 'User' as RefName,
      enrichments: emptyEnrichments,
      variant: 'main'
    }),
    './types/user.d.ts'
  )
  assertEquals(
    ModelClass.toExportPath({
      refName: 'Product' as RefName,
      enrichments: emptyEnrichments,
      variant: 'main'
    }),
    './types/product.d.ts'
  )
})

Deno.test('toModelProjectionBase - constructor creates correct generatorKey', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'typescript-models',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockContext = {} as GenerateContextType

  const instance = new ModelClass({
    context: mockContext,
    refName: 'User' as RefName,
    settings: {
      identifier: createType('User'),
      exportPath: './models/User.ts',
      enrichments: undefined,
      variant: 'main'
    } as any
  })

  // Verify generatorKey has expected format: id|refName|variant
  assertEquals(instance.generatorKey, 'typescript-models|User|main')
})

Deno.test('toModelProjectionBase - constructor threads non-default variant into generatorKey', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'zod-schemas',
    toIdentifierName: ({ refName, variant }) => withVariant(refName, variant),
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ refName, variant }) => `./schemas/${withVariant(refName, variant)}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockContext = {} as GenerateContextType

  const instance = new ModelClass({
    context: mockContext,
    refName: 'Customer' as RefName,
    settings: {
      identifier: createVariable('CustomerCoercive'),
      exportPath: './schemas/CustomerCoercive.ts',
      enrichments: undefined,
      variant: 'coercive'
    } as any
  })

  assertEquals(instance.generatorKey, 'zod-schemas|Customer|coercive')
})

Deno.test('toModelProjectionBase - instance is ModelProjectionBase', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const mockContext = {} as GenerateContextType

  const instance = new ModelClass({
    context: mockContext,
    refName: 'Product' as RefName,
    settings: {
      identifier: createType('Product'),
      exportPath: './models/Product.ts',
      enrichments: undefined,
      variant: 'main'
    } as any
  })

  assertEquals(instance instanceof TsSnippet, true)
  assertEquals(instance instanceof ModelClass, true)
})

Deno.test('toModelProjectionBase - toEnrichments validates with schema', () => {
  const ModelClass = toModelProjectionBase<{
    subject?: { readonly: boolean; nullable?: boolean }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'typescript-interfaces',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(
          v.object({
            readonly: v.boolean(),
            nullable: v.optional(v.boolean())
          })
        ),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      })
  })

  const mockContext = toEnrichmentsContext({
    enrichments: {
      'typescript-interfaces': {
        User: {
          main: {
            readonly: true,
            nullable: false
          }
        }
      }
    }
  }) as any

  const enrichments = ModelClass.toEnrichments({
    refName: 'User' as RefName,
    context: mockContext,
    variant: 'main'
  })

  assertEquals(enrichments.subject, {
    readonly: true,
    nullable: false
  })
})

Deno.test('toModelProjectionBase - toEnrichments retrieves from correct nested path', () => {
  const ModelClass = toModelProjectionBase<{
    subject?: { strictMode: boolean; customRule: string }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'zod-schemas',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./schemas/${refName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(
          v.object({
            strictMode: v.boolean(),
            customRule: v.string()
          })
        ),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      })
  })

  // Place enrichments at path: enrichments.{id}.{refName}.{variant}
  const mockContext = toEnrichmentsContext({
    enrichments: {
      'zod-schemas': {
        Product: {
          main: { strictMode: true, customRule: 'validate-stock' }
        }
      }
    }
  }) as any

  const enrichments = ModelClass.toEnrichments({
    refName: 'Product' as RefName,
    context: mockContext,
    variant: 'main'
  })

  assertEquals(enrichments.subject, { strictMode: true, customRule: 'validate-stock' })
})

Deno.test('toModelProjectionBase - toEnrichments resolves per-variant payloads independently', () => {
  const ModelClass = toModelProjectionBase<{
    subject?: { coerce: boolean }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: '@scope/gen-zod-variants',
    toIdentifierName: ({ refName, variant }) => withVariant(refName, variant),
    toIdentifierType: () => ({ type: 'variable' }),
    toExportPath: ({ refName, variant }) => `./schemas/${withVariant(refName, variant)}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(
          v.object({
            coerce: v.boolean()
          })
        ),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      })
  })

  const mockContext = toEnrichmentsContext({
    enrichments: {
      '@scope/gen-zod-variants': {
        Customer: {
          main: { coerce: false },
          coercive: { coerce: true }
        }
      }
    }
  }) as any

  const main = ModelClass.toEnrichments({
    refName: 'Customer' as RefName,
    context: mockContext,
    variant: 'main'
  })
  assertEquals(main.subject, { coerce: false })

  const coercive = ModelClass.toEnrichments({
    refName: 'Customer' as RefName,
    context: mockContext,
    variant: 'coercive'
  })
  assertEquals(coercive.subject, { coerce: true })
})

Deno.test('toModelProjectionBase - toEnrichmentDefaults returns undefined when not configured', () => {
  const ModelClass = toModelProjectionBase<Enrichments>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () => emptyEnrichmentSchema
  })

  const defaults = ModelClass.toEnrichmentDefaults({
    refName: 'Customer' as RefName,
    context: { settings: {} } as GenerateContextType,
    variant: 'main'
  })

  assertEquals(defaults, undefined)
})

Deno.test('toModelProjectionBase - toEnrichmentDefaults returns the computed seed when configured', () => {
  const ModelClass = toModelProjectionBase<{
    subject?: { label: string }
    generator?: unknown
    stack?: unknown
  }>(TsSnippet, {
    id: 'test-model',
    toIdentifierName: ({ refName }) => refName,
    toIdentifierType: () => ({ type: 'type' }),
    toExportPath: ({ refName }) => `./models/${refName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        subject: v.optional(v.object({ label: v.string() })),
        generator: v.optional(v.unknown()),
        stack: v.optional(v.unknown())
      }),
    // Seeds the subject scope from the refName; run-constant scopes stay undefined.
    toEnrichmentDefaults: ({ refName }) => ({
      subject: { label: refName },
      generator: undefined,
      stack: undefined
    })
  })

  const defaults = ModelClass.toEnrichmentDefaults({
    refName: 'Customer' as RefName,
    context: { settings: {} } as GenerateContextType,
    variant: 'main'
  })

  assertEquals(defaults, { subject: { label: 'Customer' }, generator: undefined, stack: undefined })
})
