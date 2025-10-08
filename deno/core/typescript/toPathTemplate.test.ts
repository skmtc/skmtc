import { assertEquals } from '@std/assert'
import { toPathTemplate } from './toPathTemplate.ts'

Deno.test('toPathTemplate - converts single parameter', () => {
  const result = toPathTemplate('/users/{id}')
  assertEquals(result, '/users/${id}')
})

Deno.test('toPathTemplate - converts multiple parameters', () => {
  const result = toPathTemplate('/users/{id}/posts/{postId}')
  assertEquals(result, '/users/${id}/posts/${postId}')
})

Deno.test('toPathTemplate - adds query arg prefix', () => {
  const result = toPathTemplate('/users/{id}', 'params')
  assertEquals(result, '/users/${params.id}')
})

Deno.test('toPathTemplate - handles path without parameters', () => {
  const result = toPathTemplate('/users')
  assertEquals(result, '/users')
})

Deno.test('toPathTemplate - handles complex nested paths', () => {
  const result = toPathTemplate('/orgs/{orgId}/projects/{projectId}/issues/{issueId}')
  assertEquals(result, '/orgs/${orgId}/projects/${projectId}/issues/${issueId}')
})

Deno.test('toPathTemplate - with qualified complex path', () => {
  const result = toPathTemplate('/users/{userId}/posts/{postId}', 'params')
  assertEquals(result, '/users/${params.userId}/posts/${params.postId}')
})
