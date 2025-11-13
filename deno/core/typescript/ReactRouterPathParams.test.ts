import { assertEquals } from '@std/assert'
import { ReactRouterPathParams } from './ReactRouterPathParams.ts'
import { OasOperation } from '@/oas/operation/Operation.ts'
import { OasParameter } from '@/oas/parameter/Parameter.ts'
import { toGenerateContext } from '@/test/toGenerateContext.ts'
import { toGeneratorOnlyKey } from '@/dsl/GeneratorKeys.ts'
import { spy, assertSpyCalls, assertSpyCall } from '@std/testing/mock'

Deno.test('ReactRouterPathParams', async (t) => {
  await t.step('constructor and property initialization', async (t) => {
    await t.step('should initialize with operation containing single path parameter', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserDetail.tsx',
      })

      assertEquals(pathParams.names, ['id'])
    })

    await t.step('should initialize with operation containing multiple path parameters', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/organizations/{orgId}/projects/{projectId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'orgId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'projectId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './ProjectDetail.tsx',
      })

      assertEquals(pathParams.names, ['orgId', 'projectId'])
    })

    await t.step('should initialize with operation containing no path parameters', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserList.tsx',
      })

      assertEquals(pathParams.names, [])
    })

    await t.step('should handle operation with undefined parameters', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: undefined,
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserList.tsx',
      })

      assertEquals(pathParams.names, [])
    })

    await t.step('should extract only path parameters, ignoring query parameters', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'filter',
            location: 'query',
            required: false,
            style: 'form',
            explode: true,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserDetail.tsx',
      })

      assertEquals(pathParams.names, ['id'])
    })
  })

  await t.step('getParams property', async (t) => {
    await t.step('should generate correct destructuring code for single parameter', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserDetail.tsx',
      })

      assertEquals(pathParams.getParams, 'const { id } = useParams()')
    })

    await t.step('should generate correct destructuring code for multiple parameters', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/organizations/{orgId}/projects/{projectId}/issues/{issueId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'orgId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'projectId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'issueId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './IssueDetail.tsx',
      })

      assertEquals(pathParams.getParams, 'const { orgId, projectId, issueId } = useParams()')
    })

    await t.step('should return empty string when no path parameters exist', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserList.tsx',
      })

      assertEquals(pathParams.getParams, '')
    })

    await t.step('should handle parameters with camelCase naming', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users/{userId}/posts/{postId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'userId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'postId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './PostDetail.tsx',
      })

      assertEquals(pathParams.getParams, 'const { userId, postId } = useParams()')
    })

    await t.step('should handle parameters with underscores', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/items/{item_id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'item_id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './ItemDetail.tsx',
      })

      assertEquals(pathParams.getParams, 'const { item_id } = useParams()')
    })
  })

  await t.step('assertParams property', async (t) => {
    await t.step('should generate invariant assertion for single parameter', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserDetail.tsx',
      })

      assertEquals(pathParams.assertParams, "invariant(id, 'Expected id to be defined')")
    })

    await t.step('should generate invariant assertions for multiple parameters', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/organizations/{orgId}/projects/{projectId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'orgId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'projectId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './ProjectDetail.tsx',
      })

      const expected =
        "invariant(orgId, 'Expected orgId to be defined')\ninvariant(projectId, 'Expected projectId to be defined')"
      assertEquals(pathParams.assertParams, expected)
    })

    await t.step('should return empty string when no path parameters exist', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserList.tsx',
      })

      assertEquals(pathParams.assertParams, '')
    })

    await t.step('should generate proper error messages in assertions', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/products/{productId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'productId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './ProductDetail.tsx',
      })

      assertEquals(
        pathParams.assertParams,
        "invariant(productId, 'Expected productId to be defined')",
      )
    })

    await t.step('should handle three parameters with proper newline formatting', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/a/{a1}/b/{b1}/c/{c1}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'a1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'b1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'c1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './Detail.tsx',
      })

      const expected =
        "invariant(a1, 'Expected a1 to be defined')\ninvariant(b1, 'Expected b1 to be defined')\ninvariant(c1, 'Expected c1 to be defined')"
      assertEquals(pathParams.assertParams, expected)
    })
  })

  await t.step('passProps property', async (t) => {
    await t.step('should generate prop passing code for single parameter', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserDetail.tsx',
      })

      assertEquals(pathParams.passProps, 'id={id}')
    })

    await t.step('should generate prop passing code for multiple parameters', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/organizations/{orgId}/projects/{projectId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'orgId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'projectId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './ProjectDetail.tsx',
      })

      assertEquals(pathParams.passProps, 'orgId={orgId} projectId={projectId}')
    })

    await t.step('should return empty string when no path parameters exist', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserList.tsx',
      })

      assertEquals(pathParams.passProps, '')
    })

    await t.step('should format props correctly with JSX syntax', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/items/{itemId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'itemId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './ItemDetail.tsx',
      })

      assertEquals(pathParams.passProps, 'itemId={itemId}')
    })

    await t.step('should handle multiple props with space separation', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/a/{a1}/b/{b1}/c/{c1}/d/{d1}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'a1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'b1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'c1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'd1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './Detail.tsx',
      })

      assertEquals(pathParams.passProps, 'a1={a1} b1={b1} c1={c1} d1={d1}')
    })
  })

  await t.step('import registration', async (t) => {
    await t.step('should register react-router-dom import when parameters exist', () => {
      const context = toGenerateContext()
      const registerSpy = spy(context, 'register')

      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserDetail.tsx',
      })

      assertSpyCalls(registerSpy, 1)
      assertSpyCall(registerSpy, 0, {
        args: [
          {
            imports: {
              'react-router-dom': ['useParams'],
              'tiny-invariant': [{ default: 'invariant' }],
            },
            destinationPath: './UserDetail.tsx',
          },
        ],
      })

      registerSpy.restore()
    })

    await t.step('should register tiny-invariant import when parameters exist', () => {
      const context = toGenerateContext()
      const registerSpy = spy(context, 'register')

      const operation = new OasOperation({
        path: '/products/{productId}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'productId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './ProductDetail.tsx',
      })

      assertSpyCalls(registerSpy, 1)
      const callArgs = registerSpy.calls[0].args[0]
      assertEquals(callArgs.imports?.['tiny-invariant'], [{ default: 'invariant' }])

      registerSpy.restore()
    })

    await t.step('should not register imports when no parameters exist', () => {
      const context = toGenerateContext()
      const registerSpy = spy(context, 'register')

      const operation = new OasOperation({
        path: '/users',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [],
      })

      new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserList.tsx',
      })

      assertSpyCalls(registerSpy, 0)

      registerSpy.restore()
    })

    await t.step('should register imports to correct destination path', () => {
      const context = toGenerateContext()
      const registerSpy = spy(context, 'register')

      const operation = new OasOperation({
        path: '/items/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const customPath = './custom/path/ItemDetail.tsx'
      new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: customPath,
      })

      assertSpyCalls(registerSpy, 1)
      const callArgs = registerSpy.calls[0].args[0]
      assertEquals(callArgs.destinationPath, customPath)

      registerSpy.restore()
    })
  })

  await t.step('toString() method', async (t) => {
    await t.step('should return empty string', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/users/{id}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './UserDetail.tsx',
      })

      assertEquals(pathParams.toString(), '')
    })
  })

  await t.step('edge cases and integration', async (t) => {
    await t.step('should handle single letter parameter names', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/api/{v}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'v',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './Api.tsx',
      })

      assertEquals(pathParams.names, ['v'])
      assertEquals(pathParams.getParams, 'const { v } = useParams()')
      assertEquals(pathParams.assertParams, "invariant(v, 'Expected v to be defined')")
      assertEquals(pathParams.passProps, 'v={v}')
    })

    await t.step('should handle parameters with numbers in names', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/items/{id1}/{id2}',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'id1',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'id2',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './Items.tsx',
      })

      assertEquals(pathParams.names, ['id1', 'id2'])
      assertEquals(pathParams.getParams, 'const { id1, id2 } = useParams()')
      assertEquals(pathParams.passProps, 'id1={id1} id2={id2}')
    })

    await t.step('should work with complex nested path patterns', () => {
      const context = toGenerateContext()
      const operation = new OasOperation({
        path: '/api/v1/organizations/{orgId}/teams/{teamId}/members/{memberId}/profile',
        method: 'get',
        pathItem: undefined,
        responses: {},
        parameters: [
          new OasParameter({
            name: 'orgId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'teamId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
          new OasParameter({
            name: 'memberId',
            location: 'path',
            required: true,
            style: 'simple',
            explode: false,
          }),
        ],
      })

      const pathParams = new ReactRouterPathParams({
        context,
        generatorKey: toGeneratorOnlyKey({ generatorId: 'test' }),
        operation,
        destinationPath: './MemberProfile.tsx',
      })

      assertEquals(pathParams.names, ['orgId', 'teamId', 'memberId'])
      assertEquals(pathParams.getParams, 'const { orgId, teamId, memberId } = useParams()')
      assertEquals(pathParams.passProps, 'orgId={orgId} teamId={teamId} memberId={memberId}')
      assertEquals(
        pathParams.assertParams,
        "invariant(orgId, 'Expected orgId to be defined')\ninvariant(teamId, 'Expected teamId to be defined')\ninvariant(memberId, 'Expected memberId to be defined')",
      )
    })
  })
})
