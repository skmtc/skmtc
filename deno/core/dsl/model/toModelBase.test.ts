import { toModelBase } from './toModelBase.ts'
import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import type { RefName } from '@/types/RefName.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { ModelBase } from '@/dsl/model/ModelBase.ts'
import * as v from 'valibot'

Deno.test('toModelBase - returns a class constructor', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(typeof ModelClass, 'function')
  assertEquals(typeof ModelClass.prototype, 'object')
})

Deno.test('toModelBase - sets static id from config', () => {
  const ModelClass = toModelBase({
    id: 'typescript-models',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(ModelClass.id, 'typescript-models')
})

Deno.test('toModelBase - sets static type to model', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(ModelClass.type, 'model')
})

Deno.test('toModelBase - sets static toIdentifier from config', () => {
  const identifierFn = (refName: RefName) => Identifier.createType(refName)

  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: identifierFn,
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  const identifier = ModelClass.toIdentifier('User' as RefName)
  assertEquals(identifier.name, 'User')
  // Verify identifier has expected properties
  assertEquals(typeof identifier.toString, 'function')
})

Deno.test('toModelBase - sets static toExportPath from config', () => {
  const exportPathFn = (refName: RefName) => `./generated/${refName}.ts`

  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: exportPathFn
  })

  const exportPath = ModelClass.toExportPath('User' as RefName)
  assertEquals(exportPath, './generated/User.ts')
})

Deno.test('toModelBase - toEnrichments returns undefined when no enrichmentSchema provided', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  const enrichments = ModelClass.toEnrichments({
    refName: 'User' as RefName,
    context: { settings: {} } as GenerateContextType
  })

  assertEquals(enrichments, undefined)
})

Deno.test('toModelBase - toEnrichments returns undefined when no enrichments in context', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
    // No enrichment schema provided
  })

  const enrichments = ModelClass.toEnrichments({
    refName: 'User' as RefName,
    context: { settings: {} } as GenerateContextType
  })

  assertEquals(enrichments, undefined)
})

Deno.test('toModelBase - sets static isSupported that returns true', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(ModelClass.isSupported(), true)
})

Deno.test('toModelBase - toIdentifier works with different refNames', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createVariable(`${refName}Model`),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  const userIdentifier = ModelClass.toIdentifier('User' as RefName)
  assertEquals(userIdentifier.name, 'UserModel')

  const productIdentifier = ModelClass.toIdentifier('Product' as RefName)
  assertEquals(productIdentifier.name, 'ProductModel')
})

Deno.test('toModelBase - toExportPath works with different refNames', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./types/${refName.toLowerCase()}.d.ts`
  })

  assertEquals(ModelClass.toExportPath('User' as RefName), './types/user.d.ts')
  assertEquals(ModelClass.toExportPath('Product' as RefName), './types/product.d.ts')
})

Deno.test('toModelBase - constructor creates correct generatorKey', () => {
  const ModelClass = toModelBase({
    id: 'typescript-models',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  const mockContext = {} as GenerateContextType

  const instance = new ModelClass({
    context: mockContext,
    refName: 'User' as RefName,
    settings: {
      identifier: Identifier.createType('User'),
      exportPath: './models/User.ts',
      enrichments: undefined
    } as any
  })

  // Verify generatorKey has expected format: id|refName
  assertEquals(instance.generatorKey, 'typescript-models|User')
})

Deno.test('toModelBase - instance is ModelBase', () => {
  const ModelClass = toModelBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  const mockContext = {} as GenerateContextType

  const instance = new ModelClass({
    context: mockContext,
    refName: 'Product' as RefName,
    settings: {
      identifier: Identifier.createType('Product'),
      exportPath: './models/Product.ts',
      enrichments: undefined
    } as any
  })

  assertEquals(instance instanceof ModelBase, true)
  assertEquals(instance instanceof ModelClass, true)
})

Deno.test('toModelBase - toEnrichments validates with schema', () => {
  const ModelClass = toModelBase<{ readonly: boolean; nullable?: boolean }>({
    id: 'typescript-interfaces',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        readonly: v.boolean(),
        nullable: v.optional(v.boolean())
      })
  })

  const mockContext = {
    settings: {
      enrichments: {
        'typescript-interfaces': {
          User: {
            readonly: true,
            nullable: false
          }
        }
      }
    }
  } as any

  const enrichments = ModelClass.toEnrichments({
    refName: 'User' as RefName,
    context: mockContext
  })

  assertEquals(enrichments, {
    readonly: true,
    nullable: false
  })
})

Deno.test('toModelBase - toEnrichments retrieves from correct nested path', () => {
  const ModelClass = toModelBase<{ strictMode: boolean; customRule: string }>({
    id: 'zod-schemas',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./schemas/${refName}.ts`,
    toEnrichmentSchema: () =>
      v.object({
        strictMode: v.boolean(),
        customRule: v.string()
      })
  })

  // Place enrichments at path: enrichments.{id}.{refName}
  const mockContext = {
    settings: {
      enrichments: {
        'zod-schemas': {
          Product: { strictMode: true, customRule: 'validate-stock' }
        }
      }
    }
  } as any

  const enrichments = ModelClass.toEnrichments({
    refName: 'Product' as RefName,
    context: mockContext
  })

  // Verify it retrieved from the correct path: enrichments.{id}.{refName}
  assertEquals(enrichments, { strictMode: true, customRule: 'validate-stock' })
})
