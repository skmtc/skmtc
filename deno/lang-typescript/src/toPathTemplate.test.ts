import { assertEquals } from '@std/assert'
import type { DefinitionBase, TypeSystemObject } from '@skmtc/core'
import { createType } from '@/src/createIdentifier.ts'
import { FunctionParameter } from '@/src/FunctionParameter.ts'
import { handleKey, toStringLiteral } from '@/src/identifiers.ts'
import { toPathTemplate } from '@/src/toPathTemplate.ts'

/** The keys as gen-typescript's `TsObject` gives them, or as the document has them. */
const toParameter = (keys: string[]): FunctionParameter => {
  // A test-only structural mock: FunctionParameter reads only `identifier` and `value`.
  const typeDefinition = {
    identifier: createType('Args'),
    value: {
      type: 'object',
      recordProperties: null,
      objectProperties: {
        properties: Object.fromEntries(
          keys.map(key => [key, { type: 'string', modifiers: { required: true, nullable: false } }])
        )
      },
      modifiers: { required: true, nullable: false }
    }
  } as unknown as DefinitionBase<TypeSystemObject>

  return new FunctionParameter({ typeDefinition, destructure: true, required: true })
}

/** Evaluates an expression as a TypeScript module, where `await` and `arguments` are reserved. */
const evaluate = async (expression: string): Promise<unknown> => {
  const source = `type Args = Record<string, string>\nexport default ${expression}`
  const module = await import(`data:application/typescript,${encodeURIComponent(source)}`)

  return module.default
}

const names = ['export', 'class', 'await', 'arguments', 'enterprise-team', 'actor.ip', '2fa', 'id']

const keyForms = {
  'keys that are property names': (name: string) => name,
  'keys that are rendered': handleKey
}

Object.entries(keyForms).forEach(([label, toKey]) => {
  Deno.test(`toPathTemplate - uses the variables FunctionParameter makes, ${label}`, async () => {
    const parameter = toParameter(names.map(toKey))
    const path = toPathTemplate(names.map(name => `/{${name}}`).join(''))
    const variables = parameter.toPropertyList().values.join(', ')
    const args = names.map(name => `${handleKey(name)}: ${toStringLiteral(`value of ${name}`)}`)
    const values = names.map(name => `value of ${name}`)

    const result = await evaluate(
      `((${parameter}) => [\`${path}\`, [${variables}], ${parameter.toInbound()}])({${args.join(', ')}})`
    )

    assertEquals(result, [
      values.map(value => `/${value}`).join(''),
      values,
      Object.fromEntries(names.map(name => [name, `value of ${name}`]))
    ])
  })
})

const paths = [
  { path: '/users/{user-id}', name: 'user-id', expected: '/users/VALUE' },
  { path: '/users/{user.id}', name: 'user.id', expected: '/users/VALUE' },
  { path: '/users/{2fa}', name: '2fa', expected: '/users/VALUE' },
  { path: '/users/{export}', name: 'export', expected: '/users/VALUE' },
  { path: '/fi`les/{id}', name: 'id', expected: '/fi`les/VALUE' },
  // `{id}` is a parameter of an OpenAPI path, also after a `$`.
  { path: '/a/${id}', name: 'id', expected: '/a/$VALUE' },
  { path: '/a/{id}/${b', name: 'id', expected: '/a/VALUE/${b' },
  { path: '/a\\n/{id}', name: 'id', expected: '/a\\n/VALUE' },
  { path: '/a\\{id}', name: 'id', expected: '/a\\VALUE' }
]

paths.forEach(({ path, name, expected }) => {
  Deno.test(`toPathTemplate - ${path} evaluates to ${expected}`, async () => {
    const parameter = toParameter([handleKey(name)])
    const args = `({${handleKey(name)}: 'VALUE'})`

    assertEquals(await evaluate(`((${parameter}) => \`${toPathTemplate(path)}\`)${args}`), expected)
    assertEquals(
      await evaluate(`((params: Args) => \`${toPathTemplate(path, 'params')}\`)${args}`),
      expected
    )
  })
})

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

Deno.test('toPathTemplate - parameter at path start', () => {
  const result = toPathTemplate('/{id}/details')
  assertEquals(result, '/${id}/details')
})

Deno.test('toPathTemplate - consecutive parameters', () => {
  const result = toPathTemplate('/items/{id}/{version}')
  assertEquals(result, '/items/${id}/${version}')
})

Deno.test('toPathTemplate - single character parameter', () => {
  const result = toPathTemplate('/api/{v}')
  assertEquals(result, '/api/${v}')
})

Deno.test('toPathTemplate - underscore in parameter names', () => {
  const result = toPathTemplate('/users/{user_id}/orders/{order_id}')
  assertEquals(result, '/users/${user_id}/orders/${order_id}')
})

Deno.test('toPathTemplate - with query arg and single param', () => {
  const result = toPathTemplate('/users/{userId}', 'pathParams')
  assertEquals(result, '/users/${pathParams.userId}')
})
