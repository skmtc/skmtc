import { assertEquals } from '@std/assert'
import { PathParams } from './PathParams.ts'
import type { GenerateContext } from '@skmtc/core'
import type { TypeSystemObject, TypeSystemString } from '@skmtc/core'

// Mock helper to create a simple GenerateContext
const createMockContext = (): GenerateContext => {
  return {
    // Add minimal properties needed for PathParams
  } as GenerateContext
}

// Helper to create a mock string type for testing
const mockStringType = (): TypeSystemString => ({
  type: 'string',
  format: undefined,
  enums: undefined,
  modifiers: { required: true, nullable: false }
})

// Helper to create a mock number type for testing
const mockNumberType = () => ({
  type: 'number' as const,
  modifiers: { required: true, nullable: false }
})

// Helper to create a TypeSystemObject with properties
const createTypeSystemObject = (
  properties: Record<string, TypeSystemString | ReturnType<typeof mockNumberType>>
): TypeSystemObject => ({
  type: 'object',
  recordProperties: null,
  objectProperties: {
    properties
  },
  modifiers: { required: true, nullable: false }
})

Deno.test('PathParams - constructor creates instance with destructured parameters', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType(),
    format: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    // No argName provided - should use destructuring
    typeName: 'GetUserParams',
    typeValue,
    pathTemplate: '/users/{id}'
  })

  assertEquals(pathParams.parameter.properties.type, 'destructured')
})

Deno.test('PathParams - constructor creates instance with named parameters', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    userId: mockStringType(),
    projectId: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'params',
    typeName: 'UserPathParams',
    typeValue,
    pathTemplate: '/users/{userId}/projects/{projectId}'
  })

  assertEquals(pathParams.parameter.properties.type, 'regular')
  if (pathParams.parameter.properties.type === 'regular') {
    assertEquals(pathParams.parameter.properties.name, 'params')
  }
})

Deno.test('PathParams - constructor creates correct typeDefinition with proper identifier', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'TestParams',
    typeValue,
    pathTemplate: '/test/{id}'
  })

  assertEquals(pathParams.typeDefinition.identifier.name, 'TestParams')
  assertEquals(pathParams.typeDefinition.value, typeValue)
})

Deno.test('PathParams - constructor creates FunctionParameter with destructure=true when argName is undefined', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'Params',
    typeValue,
    pathTemplate: '/items/{id}'
  })

  assertEquals(pathParams.parameter.properties.type, 'destructured')
})

Deno.test('PathParams - constructor creates FunctionParameter with regular type when argName is provided', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'pathData',
    typeName: 'Params',
    typeValue,
    pathTemplate: '/items/{id}'
  })

  assertEquals(pathParams.parameter.properties.type, 'regular')
})

Deno.test('PathParams - constructor stores context correctly', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'Params',
    typeValue,
    pathTemplate: '/items/{id}'
  })

  assertEquals(pathParams.context, context)
})

Deno.test('PathParams - path template with single parameter without queryArg (destructured)', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    // No argName = destructured = no queryArg
    typeName: 'Params',
    typeValue,
    pathTemplate: '/users/{id}'
  })

  assertEquals(pathParams.path, '/users/${id}')
})

Deno.test('PathParams - path template with single parameter with queryArg (named)', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'params',
    typeName: 'Params',
    typeValue,
    pathTemplate: '/users/{id}'
  })

  assertEquals(pathParams.path, '/users/${params.id}')
})

Deno.test('PathParams - path template with multiple parameters without queryArg', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    userId: mockStringType(),
    postId: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'Params',
    typeValue,
    pathTemplate: '/users/{userId}/posts/{postId}'
  })

  assertEquals(pathParams.path, '/users/${userId}/posts/${postId}')
})

Deno.test('PathParams - path template with multiple parameters with queryArg', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    userId: mockStringType(),
    postId: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'pathParams',
    typeName: 'Params',
    typeValue,
    pathTemplate: '/users/{userId}/posts/{postId}'
  })

  assertEquals(pathParams.path, '/users/${pathParams.userId}/posts/${pathParams.postId}')
})

Deno.test('PathParams - path template with no parameters', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({})

  const pathParams = new PathParams({
    context,
    typeName: 'EmptyParams',
    typeValue,
    pathTemplate: '/users/list'
  })

  assertEquals(pathParams.path, '/users/list')
})

Deno.test('PathParams - path template with complex nested parameters', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    orgId: mockStringType(),
    projectId: mockStringType(),
    issueId: mockNumberType(),
    commentId: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'pathData',
    typeName: 'ComplexParams',
    typeValue,
    pathTemplate: '/orgs/{orgId}/projects/{projectId}/issues/{issueId}/comments/{commentId}'
  })

  assertEquals(
    pathParams.path,
    '/orgs/${pathData.orgId}/projects/${pathData.projectId}/issues/${pathData.issueId}/comments/${pathData.commentId}'
  )
})

Deno.test('PathParams - path template qualification based on parameter type (destructured)', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    // No argName = destructured
    typeName: 'Params',
    typeValue,
    pathTemplate: '/items/{id}'
  })

  // Destructured should not have queryArg qualification
  assertEquals(pathParams.path, '/items/${id}')
})

Deno.test('PathParams - path template qualification based on parameter type (regular)', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'params',
    typeName: 'Params',
    typeValue,
    pathTemplate: '/items/{id}'
  })

  // Regular parameter should have queryArg qualification
  assertEquals(pathParams.path, '/items/${params.id}')
})

Deno.test('PathParams - typeDefinition property is correctly initialized', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType(),
    name: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'UserParams',
    typeValue,
    pathTemplate: '/users/{id}'
  })

  assertEquals(pathParams.typeDefinition.identifier.name, 'UserParams')
  assertEquals(pathParams.typeDefinition.value.type, 'object')
})

Deno.test('PathParams - parameter property is correctly initialized', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'params',
    typeName: 'Params',
    typeValue,
    pathTemplate: '/users/{id}'
  })

  assertEquals(pathParams.parameter.properties.type, 'regular')
  if (pathParams.parameter.properties.type === 'regular') {
    assertEquals(pathParams.parameter.properties.required, true)
  }
})

Deno.test('PathParams - path property contains processed template', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    userId: mockStringType(),
    postId: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'Params',
    typeValue,
    pathTemplate: '/users/{userId}/posts/{postId}'
  })

  // Should be processed with template literal syntax
  assertEquals(pathParams.path.includes('${'), true)
  assertEquals(pathParams.path.includes('}'), true)
})

Deno.test('PathParams - context property is stored correctly', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'Params',
    typeValue,
    pathTemplate: '/items/{id}'
  })

  assertEquals(pathParams.context, context)
})

Deno.test('PathParams - works with simple path parameters', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'params',
    typeName: 'GetUserParams',
    typeValue,
    pathTemplate: '/users/{id}'
  })

  // Check all properties are correctly set up
  assertEquals(pathParams.typeDefinition.identifier.name, 'GetUserParams')
  assertEquals(pathParams.parameter.properties.type, 'regular')
  assertEquals(pathParams.path, '/users/${params.id}')
})

Deno.test('PathParams - works with complex nested paths', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    orgId: mockStringType(),
    projectId: mockStringType(),
    issueId: mockNumberType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'IssueParams',
    typeValue,
    pathTemplate: '/orgs/{orgId}/projects/{projectId}/issues/{issueId}'
  })

  // Destructured (no argName)
  assertEquals(pathParams.parameter.properties.type, 'destructured')
  assertEquals(pathParams.path, '/orgs/${orgId}/projects/${projectId}/issues/${issueId}')
})

Deno.test('PathParams - parameter toString() generates correct TypeScript syntax', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType(),
    format: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'params',
    typeName: 'UserParams',
    typeValue,
    pathTemplate: '/users/{id}'
  })

  const paramString = pathParams.parameter.toString()

  // Should contain the parameter name, type annotation
  assertEquals(paramString.includes('params'), true)
  assertEquals(paramString.includes('UserParams'), true)
  assertEquals(paramString.includes(':'), true)
})

Deno.test('PathParams - combined usage scenario (parameter + path template)', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    userId: mockStringType(),
    projectId: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'pathParams',
    typeName: 'ProjectPathParams',
    typeValue,
    pathTemplate: '/users/{userId}/projects/{projectId}'
  })

  // Verify the complete setup works together
  const paramString = pathParams.parameter.toString()
  const pathTemplate = pathParams.path

  assertEquals(paramString, 'pathParams: ProjectPathParams')
  assertEquals(pathTemplate, '/users/${pathParams.userId}/projects/${pathParams.projectId}')
})

Deno.test('PathParams - empty path template', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    typeName: 'Params',
    typeValue,
    pathTemplate: ''
  })

  assertEquals(pathParams.path, '')
})

Deno.test('PathParams - path template with special characters', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({
    id: mockStringType()
  })

  const pathParams = new PathParams({
    context,
    argName: 'params',
    typeName: 'Params',
    typeValue,
    pathTemplate: '/api/v1/users-list/{id}/profile_data'
  })

  assertEquals(pathParams.path, '/api/v1/users-list/${params.id}/profile_data')
})

Deno.test('PathParams - typeValue with empty object properties', () => {
  const context = createMockContext()
  const typeValue = createTypeSystemObject({})

  const pathParams = new PathParams({
    context,
    typeName: 'EmptyParams',
    typeValue,
    pathTemplate: '/static/path'
  })

  // Should handle empty properties gracefully
  assertEquals(pathParams.typeDefinition.value.type, 'object')
  assertEquals(pathParams.path, '/static/path')
})
