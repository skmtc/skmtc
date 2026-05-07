import { toModelProjectionBase } from './toModelProjectionBase.ts'
import { assertEquals } from '@std/assert/equals'
import { Identifier } from '@/dsl/Identifier.ts'
import type { RefName } from '@/types/RefName.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import { ModelProjectionBase } from '@/dsl/model/ModelProjectionBase.ts'
import * as v from 'valibot'

Deno.test('toModelProjectionBase - returns a class constructor', () => {
  const ModelClass = toModelProjectionBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(typeof ModelClass, 'function')
  assertEquals(typeof ModelClass.prototype, 'object')
})

Deno.test('toModelProjectionBase - sets static id from config', () => {
  const ModelClass = toModelProjectionBase({
    id: 'typescript-models',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(ModelClass.id, 'typescript-models')
})

Deno.test('toModelProjectionBase - sets static type to model', () => {
  const ModelClass = toModelProjectionBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(ModelClass.type, 'model')
})

Deno.test('toModelProjectionBase - sets static toIdentifier from config', () => {
  const identifierFn = (refName: RefName) => Identifier.createType(refName)

  const ModelClass = toModelProjectionBase({
    id: 'test-model',
    toIdentifier: identifierFn,
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  const identifier = ModelClass.toIdentifier('User' as RefName)
  assertEquals(identifier.name, 'User')
  // Verify identifier has expected properties
  assertEquals(typeof identifier.toString, 'function')
})

Deno.test('toModelProjectionBase - sets static toExportPath from config', () => {
  const exportPathFn = (refName: RefName) => `./generated/${refName}.ts`

  const ModelClass = toModelProjectionBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: exportPathFn
  })

  const exportPath = ModelClass.toExportPath('User' as RefName)
  assertEquals(exportPath, './generated/User.ts')
})

Deno.test('toModelProjectionBase - toEnrichments returns undefined when no enrichmentSchema provided', () => {
  const ModelClass = toModelProjectionBase({
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

Deno.test('toModelProjectionBase - toEnrichments returns undefined when no enrichments in context', () => {
  const ModelClass = toModelProjectionBase({
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

Deno.test('toModelProjectionBase - sets static isSupported that returns true', () => {
  const ModelClass = toModelProjectionBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  assertEquals(ModelClass.isSupported(), true)
})

Deno.test('toModelProjectionBase - toIdentifier works with different refNames', () => {
  const ModelClass = toModelProjectionBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createVariable(`${refName}Model`),
    toExportPath: (refName) => `./models/${refName}.ts`
  })

  const userIdentifier = ModelClass.toIdentifier('User' as RefName)
  assertEquals(userIdentifier.name, 'UserModel')

  const productIdentifier = ModelClass.toIdentifier('Product' as RefName)
  assertEquals(productIdentifier.name, 'ProductModel')
})

Deno.test('toModelProjectionBase - toExportPath works with different refNames', () => {
  const ModelClass = toModelProjectionBase({
    id: 'test-model',
    toIdentifier: (refName) => Identifier.createType(refName),
    toExportPath: (refName) => `./types/${refName.toLowerCase()}.d.ts`
  })

  assertEquals(ModelClass.toExportPath('User' as RefName), './types/user.d.ts')
  assertEquals(ModelClass.toExportPath('Product' as RefName), './types/product.d.ts')
})

Deno.test('toModelProjectionBase - constructor creates correct generatorKey', () => {
  const ModelClass = toModelProjectionBase({
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

Deno.test('toModelProjectionBase - instance is ModelProjectionBase', () => {
  const ModelClass = toModelProjectionBase({
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

  assertEquals(instance instanceof ModelProjectionBase, true)
  assertEquals(instance instanceof ModelClass, true)
})

Deno.test('toModelProjectionBase - toEnrichments validates with schema', () => {
  const ModelClass = toModelProjectionBase<{ readonly: boolean; nullable?: boolean }>({
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

Deno.test('toModelProjectionBase - toEnrichments retrieves from correct nested path', () => {
  const ModelClass = toModelProjectionBase<{ strictMode: boolean; customRule: string }>({
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
