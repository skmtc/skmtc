import { assertEquals, assertExists, assertThrows, assertStrictEquals } from '@std/assert'
import { OasRef } from './Ref.ts'
import { toRefParseContextStub } from '@/test/mockParseContext.ts'
import { OasDocument } from '../document/Document.ts'
import { OasInfo } from '../info/Info.ts'
import { OasString } from '../string/String.ts'
import { OasObject } from '../object/Object.ts'
import { OasNumber } from '../number/Number.ts'
import { OasBoolean } from '../boolean/Boolean.ts'
import { OasResponse } from '../response/Response.ts'
import { OasParameter } from '../parameter/Parameter.ts'
import { OasRequestBody } from '../requestBody/RequestBody.ts'
import { OasExample } from '../example/Example.ts'
import { OasHeader } from '../header/Header.ts'
import { OasApiKeySecurityScheme } from '../securitySchemes/SecurityScheme.ts'
import { OasComponents } from '../components/Components.ts'
import { OasMediaType } from '../mediaType/MediaType.ts'
import type { RefName } from '@/types/RefName.ts'
import type { OasSchema } from '../schema/Schema.ts'

Deno.test('OasRef', async (t) => {
  await t.step('constructor and basic properties', async (t) => {
    await t.step('should initialize with schema refType', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.refType, 'schema')
      assertEquals(ref.$ref, '#/components/schemas/User')
      assertEquals(ref.document.value, document)
      assertEquals(ref.oasType, 'ref')
      assertEquals(ref.type, 'ref')
    })

    await t.step('should initialize with response refType', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'response',
        $ref: '#/components/responses/ErrorResponse'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.refType, 'response')
      assertEquals(ref.$ref, '#/components/responses/ErrorResponse')
    })

    await t.step('should initialize with parameter refType', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'parameter',
        $ref: '#/components/parameters/PageSize'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.refType, 'parameter')
      assertEquals(ref.$ref, '#/components/parameters/PageSize')
    })

    await t.step('should initialize with all supported refTypes', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const refTypes = ['schema', 'response', 'parameter', 'requestBody', 'example', 'header', 'securityScheme'] as const

      refTypes.forEach(refType => {
        const ref = new OasRef({
          refType,
          $ref: `#/components/${refType}s/TestRef`
        }, toRefParseContextStub({ type: 'oas', value: document }))

        assertEquals(ref.refType, refType)
        assertEquals(ref.oasType, 'ref')
      })
    })

    await t.step('should correctly expose getters', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const refPath = '#/components/schemas/Product'
      const ref = new OasRef({
        refType: 'schema',
        $ref: refPath
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.$ref, refPath)
      assertEquals(ref.refType, 'schema')
      assertStrictEquals(ref.document.value, document)
    })
  })

  await t.step('isRef() method', async (t) => {
    await t.step('should always return true', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.isRef(), true)
    })

    await t.step('should work as type guard', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      if (ref.isRef()) {
        // TypeScript should know this is OasRef
        assertEquals(ref.refType, 'schema')
      }
    })
  })

  await t.step('toRefName() method', async (t) => {
    await t.step('should extract name from schema reference', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.toRefName(), 'User')
    })

    await t.step('should extract name from different reference types', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const refs = [
        { refType: 'response' as const, $ref: '#/components/responses/NotFound', expected: 'NotFound' },
        { refType: 'parameter' as const, $ref: '#/components/parameters/PageNum', expected: 'PageNum' },
        { refType: 'requestBody' as const, $ref: '#/components/requestBodies/CreateUser', expected: 'CreateUser' }
      ]

      refs.forEach(({ refType, $ref, expected }) => {
        const ref = new OasRef({ refType, $ref }, toRefParseContextStub({ type: 'oas', value: document }))
        assertEquals(ref.toRefName(), expected)
      })
    })

    await t.step('should handle complex reference names', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/ComplexName_v2.1-FINAL'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.toRefName(), 'ComplexName_v2.1-FINAL')
    })
  })

  await t.step('resolveOnce() - success cases', async (t) => {
    await t.step('should resolve schema reference', () => {
      const userSchema = new OasObject({
        properties: {
          id: new OasString(),
          name: new OasString()
        }
      })

      const components = new OasComponents({
        schemas: { 'User': userSchema } as Record<RefName, OasSchema>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolveOnce()
      assertEquals(resolved, userSchema)
      assertEquals(resolved.isRef(), false)
    })

    await t.step('should resolve response reference', () => {
      const errorResponse = new OasResponse({
        description: 'Error response'
      })

      const components = new OasComponents({
        responses: { 'ErrorResponse': errorResponse } as Record<RefName, typeof errorResponse>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'response',
        $ref: '#/components/responses/ErrorResponse'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolveOnce()
      assertEquals(resolved, errorResponse)
    })

    await t.step('should resolve parameter reference', () => {
      const pageParam = new OasParameter({
        name: 'page',
        location: 'query'
      })

      const components = new OasComponents({
        parameters: { 'PageParam': pageParam } as Record<RefName, typeof pageParam>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'parameter',
        $ref: '#/components/parameters/PageParam'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolveOnce()
      assertEquals(resolved, pageParam)
    })

    await t.step('should resolve requestBody reference', () => {
      const createUserBody = new OasRequestBody({
        content: {
          'application/json': new OasMediaType({
            mediaType: 'application/json',
            schema: new OasObject({})
          })
        }
      })

      const components = new OasComponents({
        requestBodies: { 'CreateUser': createUserBody } as Record<RefName, typeof createUserBody>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'requestBody',
        $ref: '#/components/requestBodies/CreateUser'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolveOnce()
      assertEquals(resolved, createUserBody)
    })

    await t.step('should resolve example reference', () => {
      const userExample = new OasExample({
        value: { id: 1, name: 'John' }
      })

      const components = new OasComponents({
        examples: { 'UserExample': userExample } as Record<RefName, typeof userExample>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'example',
        $ref: '#/components/examples/UserExample'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolveOnce()
      assertEquals(resolved, userExample)
    })

    await t.step('should resolve header reference', () => {
      const apiKeyHeader = new OasHeader({
        schema: new OasString()
      })

      const components = new OasComponents({
        headers: { 'ApiKeyHeader': apiKeyHeader } as Record<RefName, typeof apiKeyHeader>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'header',
        $ref: '#/components/headers/ApiKeyHeader'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolveOnce()
      assertEquals(resolved, apiKeyHeader)
    })

    await t.step('should return another OasRef when target is also a reference', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const targetRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/FinalSchema'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const components = new OasComponents({
        schemas: {
          'AliasSchema': targetRef,
          'FinalSchema': new OasString()
        } as Record<RefName, OasSchema | OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/AliasSchema'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolveOnce()
      assertEquals(resolved.isRef(), true)
      assertEquals(resolved, targetRef)
    })
  })

  await t.step('resolveOnce() - error cases', async (t) => {
    await t.step('should throw when reference not found', () => {
      const components = new OasComponents({
        schemas: {}
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/NonExistent'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertThrows(
        () => ref.resolveOnce(),
        Error,
        'Ref "#/components/schemas/NonExistent" not found'
      )
    })

    await t.step('should throw when components is undefined', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertThrows(
        () => ref.resolveOnce(),
        Error,
        'not found'
      )
    })

    await t.step('should throw on refType mismatch when target is ref', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const wrongTypeRef = new OasRef({
        refType: 'response',
        $ref: '#/components/responses/Something'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const components = new OasComponents({
        schemas: {
          'WrongType': wrongTypeRef as unknown as OasSchema
        } as Record<RefName, OasSchema>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/WrongType'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertThrows(
        () => ref.resolveOnce(),
        Error,
        'Ref type mismatch'
      )
    })

    await t.step('should throw on oasType mismatch when target is resolved', () => {
      const wrongTypeObject = new OasResponse({
        description: 'This is a response, not a schema'
      })

      const components = new OasComponents({
        schemas: {
          'WrongType': wrongTypeObject as unknown as OasSchema
        } as Record<RefName, OasSchema>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/WrongType'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertThrows(
        () => ref.resolveOnce(),
        Error,
        'Type mismatch'
      )
    })

    await t.step('should throw when specific component collection is undefined', () => {
      const components = new OasComponents({
        responses: { 'SomeResponse': new OasResponse({ description: 'test' }) } as Record<RefName, OasResponse>
        // Note: schemas is not defined
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertThrows(
        () => ref.resolveOnce(),
        Error,
        'not found'
      )
    })
  })

  await t.step('resolve() - success cases', async (t) => {
    await t.step('should resolve direct reference', () => {
      const userSchema = new OasString()

      const components = new OasComponents({
        schemas: { 'User': userSchema } as Record<RefName, OasSchema>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolve()
      assertEquals(resolved, userSchema)
      assertEquals(resolved.isRef(), false)
    })

    await t.step('should follow reference chain', () => {
      const finalSchema = new OasNumber()

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const secondRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Final'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const components = new OasComponents({
        schemas: {
          'First': secondRef,
          'Final': finalSchema
        } as Record<RefName, OasSchema | OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      const firstRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/First'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = firstRef.resolve()
      assertEquals(resolved, finalSchema)
      assertEquals(resolved.isRef(), false)
    })

    await t.step('should resolve long reference chain', () => {
      const finalSchema = new OasBoolean()

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const thirdRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Final'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const secondRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Third'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const components = new OasComponents({
        schemas: {
          'First': secondRef,
          'Third': thirdRef,
          'Final': finalSchema
        } as Record<RefName, OasSchema | OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      const firstRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/First'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = firstRef.resolve()
      assertEquals(resolved, finalSchema)
    })

    await t.step('should work with different reference types', () => {
      const response = new OasResponse({
        description: 'Success'
      })

      const components = new OasComponents({
        responses: { 'Success': response } as Record<RefName, OasResponse>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'response',
        $ref: '#/components/responses/Success'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolve()
      assertEquals(resolved, response)
    })
  })

  await t.step('resolve() - circular reference detection', async (t) => {
    await t.step('should detect simple circular reference', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const refA = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/B'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const refB = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/A'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const components = new OasComponents({
        schemas: {
          'A': refA,
          'B': refB
        } as Record<RefName, OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      assertThrows(
        () => refA.resolve(),
        Error,
        'Max lookups reached'
      )
    })

    await t.step('should detect three-way circular reference', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const refA = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/B'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const refB = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/C'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const refC = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/A'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const components = new OasComponents({
        schemas: {
          'A': refA,
          'B': refB,
          'C': refC
        } as Record<RefName, OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      assertThrows(
        () => refA.resolve(),
        Error,
        'Max lookups reached'
      )
    })

    await t.step('should throw at MAX_LOOKUPS (10 levels)', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      // Create a chain of 11 references (exceeds MAX_LOOKUPS of 10)
      const schemas: Record<string, OasRef<'schema'> | OasSchema> = {}

      for (let i = 0; i < 11; i++) {
        schemas[`Schema${i}`] = new OasRef({
          refType: 'schema',
          $ref: `#/components/schemas/Schema${i + 1}`
        }, toRefParseContextStub({ type: 'oas', value: document }))
      }

      schemas['Schema11'] = new OasString()

      const components = new OasComponents({
        schemas: schemas as Record<RefName, OasSchema | OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      const firstRef = schemas['Schema0'] as OasRef<'schema'>

      assertThrows(
        () => firstRef.resolve(),
        Error,
        'Max lookups reached'
      )
    })

    await t.step('should succeed with near-max lookups (9 levels)', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      // Create a chain of exactly 9 references (within MAX_LOOKUPS)
      const schemas: Record<string, OasRef<'schema'> | OasSchema> = {}

      for (let i = 0; i < 9; i++) {
        schemas[`Schema${i}`] = new OasRef({
          refType: 'schema',
          $ref: `#/components/schemas/Schema${i + 1}`
        }, toRefParseContextStub({ type: 'oas', value: document }))
      }

      const finalSchema = new OasString()
      schemas['Schema9'] = finalSchema

      const components = new OasComponents({
        schemas: schemas as Record<RefName, OasSchema | OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      const firstRef = schemas['Schema0'] as OasRef<'schema'>
      const resolved = firstRef.resolve()

      assertEquals(resolved, finalSchema)
    })
  })

  await t.step('toJsonSchema() method', async (t) => {
    await t.step('should return reference object when resolve=false', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const result = ref.toJsonSchema({ resolve: false })

      assertEquals(result, {
        $ref: '#/components/schemas/User'
      })
    })

    await t.step('should use correct plural paths for all refTypes', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const testCases = [
        { refType: 'schema' as const, expected: 'schemas' },
        { refType: 'response' as const, expected: 'responses' },
        { refType: 'parameter' as const, expected: 'parameters' },
        { refType: 'requestBody' as const, expected: 'requestBodies' },
        { refType: 'example' as const, expected: 'examples' },
        { refType: 'header' as const, expected: 'headers' },
        { refType: 'securityScheme' as const, expected: 'securitySchemes' }
      ]

      testCases.forEach(({ refType, expected }) => {
        const ref = new OasRef({
          refType,
          $ref: `#/components/${expected}/TestName`
        }, toRefParseContextStub({ type: 'oas', value: document }))

        const result = ref.toJsonSchema({ resolve: false })
        assertEquals((result as any).$ref, `#/components/${expected}/TestName`)
      })
    })

    await t.step('should resolve and return schema JSON when resolve=true', () => {
      const userSchema = new OasObject({
        properties: {
          id: new OasNumber(),
          name: new OasString()
        }
      })

      const components = new OasComponents({
        schemas: { 'User': userSchema } as Record<RefName, OasSchema>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const result = ref.toJsonSchema({ resolve: true })
      const expected = userSchema.toJsonSchema({ resolve: true })

      assertEquals(result, expected)
    })

    await t.step('should follow reference chain before converting', () => {
      const finalSchema = new OasString()

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const secondRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Final'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const components = new OasComponents({
        schemas: {
          'First': secondRef,
          'Final': finalSchema
        } as Record<RefName, OasSchema | OasRef<'schema'>>
      })

      document.fields = {
        ...document.fields!,
        components
      }

      const firstRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/First'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const result = firstRef.toJsonSchema({ resolve: true })
      const expected = finalSchema.toJsonSchema({ resolve: true })

      assertEquals(result, expected)
    })
  })

  await t.step('toJSON() method', async (t) => {
    await t.step('should return object with correct $ref format', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const result = ref.toJSON()

      assertEquals(result, {
        $ref: '#/components/schemas/User'
      })
    })

    await t.step('should format correctly for different refTypes', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const responseRef = new OasRef({
        refType: 'response',
        $ref: '#/components/responses/NotFound'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const paramRef = new OasRef({
        refType: 'parameter',
        $ref: '#/components/parameters/PageSize'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(responseRef.toJSON(), {
        $ref: '#/components/responses/NotFound'
      })

      assertEquals(paramRef.toJSON(), {
        $ref: '#/components/parameters/PageSize'
      })
    })

    await t.step('should match OpenAPI spec format', () => {
      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const result = ref.toJSON()

      assertExists(result)
      assertEquals(typeof result, 'object')
      assertEquals(Object.keys(result).length, 1)
      assertEquals('$ref' in result, true)
    })
  })

  await t.step('integration tests', async (t) => {
    await t.step('should work with real document and multiple component types', () => {
      const userSchema = new OasObject({
        properties: {
          id: new OasString(),
          name: new OasString()
        }
      })

      const errorResponse = new OasResponse({
        description: 'Error response'
      })

      const pageParam = new OasParameter({
        name: 'page',
        location: 'query',
        schema: new OasNumber()
      })

      const components = new OasComponents({
        schemas: { 'User': userSchema } as Record<RefName, OasSchema>,
        responses: { 'Error': errorResponse } as Record<RefName, OasResponse>,
        parameters: { 'Page': pageParam } as Record<RefName, OasParameter>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test API', version: '1.0.0' }),
        operations: [],
        components
      })

      // Test schema reference
      const schemaRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/User'
      }, toRefParseContextStub({ type: 'oas', value: document }))
      assertEquals(schemaRef.resolve(), userSchema)

      // Test response reference
      const responseRef = new OasRef({
        refType: 'response',
        $ref: '#/components/responses/Error'
      }, toRefParseContextStub({ type: 'oas', value: document }))
      assertEquals(responseRef.resolve(), errorResponse)

      // Test parameter reference
      const paramRef = new OasRef({
        refType: 'parameter',
        $ref: '#/components/parameters/Page'
      }, toRefParseContextStub({ type: 'oas', value: document }))
      assertEquals(paramRef.resolve(), pageParam)
    })

    await t.step('should handle multiple references to same component', () => {
      const sharedSchema = new OasString()

      const components = new OasComponents({
        schemas: { 'Shared': sharedSchema } as Record<RefName, OasSchema>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref1 = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Shared'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const ref2 = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Shared'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved1 = ref1.resolve()
      const resolved2 = ref2.resolve()

      // Both should resolve to the same instance
      assertStrictEquals(resolved1, resolved2)
      assertStrictEquals(resolved1, sharedSchema)
    })

    await t.step('should handle reference with special characters in name', () => {
      const schema = new OasString()

      const components = new OasComponents({
        schemas: {
          'Schema.With-Special_Chars': schema
        } as Record<RefName, OasSchema>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Schema.With-Special_Chars'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(ref.toRefName(), 'Schema.With-Special_Chars')
      assertEquals(ref.resolve(), schema)
    })

    await t.step('should work with nested object schemas', () => {
      const addressSchema = new OasObject({
        properties: {
          street: new OasString(),
          city: new OasString(),
          country: new OasString()
        }
      })

      const userSchema = new OasObject({
        properties: {
          id: new OasNumber(),
          name: new OasString(),
          address: new OasRef({
            refType: 'schema',
            $ref: '#/components/schemas/Address'
          }, toRefParseContextStub({ type: 'oas', value: {} as OasDocument })) // Will be set via document
        }
      })

      const components = new OasComponents({
        schemas: {
          'User': userSchema,
          'Address': addressSchema
        } as Record<RefName, OasSchema>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      // Update the reference with the document
      const addressRef = new OasRef({
        refType: 'schema',
        $ref: '#/components/schemas/Address'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      assertEquals(addressRef.resolve(), addressSchema)
    })

    await t.step('should properly type resolved references', () => {
      const apiKeyScheme = new OasApiKeySecurityScheme({
        name: 'api_key',
        in: 'header'
      })

      const components = new OasComponents({
        securitySchemes: {
          'ApiKey': apiKeyScheme
        } as Record<string, typeof apiKeyScheme>
      })

      const document = new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: [],
        components
      })

      const ref = new OasRef({
        refType: 'securityScheme',
        $ref: '#/components/securitySchemes/ApiKey'
      }, toRefParseContextStub({ type: 'oas', value: document }))

      const resolved = ref.resolve()
      assertEquals(resolved, apiKeyScheme)
      // TypeScript should know this is a security scheme
      assertEquals(resolved.oasType, 'securityScheme')
    })
  })
})