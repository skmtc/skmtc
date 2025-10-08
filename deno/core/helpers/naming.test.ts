import { assertEquals } from '@std/assert/equals'
import { toEndpointType, toEndpointName, toResponseName, toArgsName, toMethodVerb } from './naming.ts'
import type { OasOperation } from '../oas/operation/Operation.ts'

Deno.test('toEndpointType - returns query for GET method', () => {
  const operation = {
    method: 'get',
    path: '/users'
  } as OasOperation

  assertEquals(toEndpointType(operation), 'query')
})

Deno.test('toEndpointType - returns mutation for POST method', () => {
  const operation = {
    method: 'post',
    path: '/users'
  } as OasOperation

  assertEquals(toEndpointType(operation), 'mutation')
})

Deno.test('toEndpointType - returns mutation for PUT method', () => {
  const operation = {
    method: 'put',
    path: '/users/{id}'
  } as OasOperation

  assertEquals(toEndpointType(operation), 'mutation')
})

Deno.test('toEndpointType - returns mutation for DELETE method', () => {
  const operation = {
    method: 'delete',
    path: '/users/{id}'
  } as OasOperation

  assertEquals(toEndpointType(operation), 'mutation')
})

Deno.test('toEndpointType - returns mutation for PATCH method', () => {
  const operation = {
    method: 'patch',
    path: '/users/{id}'
  } as OasOperation

  assertEquals(toEndpointType(operation), 'mutation')
})

Deno.test('toEndpointName - generates name for simple GET path', () => {
  const operation = {
    method: 'get',
    path: '/users'
  } as OasOperation

  assertEquals(toEndpointName(operation), 'getApiUsers')
})

Deno.test('toEndpointName - generates name for POST with path params', () => {
  const operation = {
    method: 'post',
    path: '/users/{id}/profile'
  } as OasOperation

  assertEquals(toEndpointName(operation), 'createApiUsersIdProfile')
})

Deno.test('toEndpointName - generates name for PUT', () => {
  const operation = {
    method: 'put',
    path: '/users/{id}'
  } as OasOperation

  assertEquals(toEndpointName(operation), 'updateApiUsersId')
})

Deno.test('toEndpointName - generates name for DELETE', () => {
  const operation = {
    method: 'delete',
    path: '/products/{productId}'
  } as OasOperation

  assertEquals(toEndpointName(operation), 'deleteApiProductsProductId')
})

Deno.test('toEndpointName - handles complex nested paths', () => {
  const operation = {
    method: 'get',
    path: '/organizations/{orgId}/teams/{teamId}/members'
  } as OasOperation

  assertEquals(toEndpointName(operation), 'getApiOrganizationsOrgIdTeamsTeamIdMembers')
})

Deno.test('toResponseName - adds Response suffix', () => {
  const operation = {
    method: 'get',
    path: '/users'
  } as OasOperation

  assertEquals(toResponseName(operation), 'getApiUsersResponse')
})

Deno.test('toResponseName - adds Response suffix to complex name', () => {
  const operation = {
    method: 'post',
    path: '/users/{id}/settings'
  } as OasOperation

  assertEquals(toResponseName(operation), 'createApiUsersIdSettingsResponse')
})

Deno.test('toArgsName - adds Args suffix', () => {
  const operation = {
    method: 'put',
    path: '/users/{id}'
  } as OasOperation

  assertEquals(toArgsName(operation), 'updateApiUsersIdArgs')
})

Deno.test('toArgsName - adds Args suffix to GET operation', () => {
  const operation = {
    method: 'get',
    path: '/products'
  } as OasOperation

  assertEquals(toArgsName(operation), 'getApiProductsArgs')
})

Deno.test('toMethodVerb - returns Create for post', () => {
  assertEquals(toMethodVerb('post'), 'Create')
})

Deno.test('toMethodVerb - returns Update for put', () => {
  assertEquals(toMethodVerb('put'), 'Update')
})

Deno.test('toMethodVerb - returns get for get', () => {
  assertEquals(toMethodVerb('get'), 'get')
})

Deno.test('toMethodVerb - returns delete for delete', () => {
  assertEquals(toMethodVerb('delete'), 'delete')
})

Deno.test('toMethodVerb - returns patch for patch', () => {
  assertEquals(toMethodVerb('patch'), 'patch')
})
