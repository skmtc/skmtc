import { assertEquals } from '@std/assert'
import { createType, createVariable } from './createIdentifier.ts'
import { TsImport, type ImportNameArg } from './TsImport.ts'

/**
 * `TsImport` must keep rendering the exact statements the engine's legacy
 * `Import` produced — the expected strings below were pinned against it
 * before core's `Import` was deleted (step 5 of the convergence tracker),
 * so these literals are what proves the move was lossless.
 */
const cases: { name: string; module: string; names: ImportNameArg[]; expected: string }[] = [
  { name: 'plain value imports', module: 'zod', names: ['z'], expected: `import {z} from 'zod'` },
  {
    name: 'multiple value imports',
    module: './utils',
    names: ['formatDate', 'parseJson'],
    expected: `import {formatDate, parseJson} from './utils'`
  },
  {
    name: 'alias record',
    module: 'lodash',
    names: [{ isEqual: 'deepEqual' }, 'cloneDeep'],
    expected: `import {isEqual as deepEqual, cloneDeep} from 'lodash'`
  },
  {
    name: 'explicit type import (statement-level)',
    module: 'react',
    names: [{ name: 'FC', type: 'type' }],
    expected: `import type {FC} from 'react'`
  },
  {
    name: 'mixed type and value (per-name type)',
    module: '@/models',
    names: [{ name: 'User', type: 'type' }, 'createUser'],
    expected: `import {type User, createUser} from '@/models'`
  },
  {
    name: 'type alias',
    module: '@/models',
    names: [{ name: 'User', alias: 'IUser', type: 'type' }],
    expected: `import type {User as IUser} from '@/models'`
  },
  {
    name: 'namespace import',
    module: 'react',
    names: [{ '*': 'React' }],
    expected: `import * as React from 'react'`
  }
]

for (const testCase of cases) {
  Deno.test(`TsImport renders the legacy-pinned statement — ${testCase.name}`, () => {
    const tsImport = TsImport.fromConcise(testCase.module, testCase.names).toString()

    assertEquals(tsImport, testCase.expected)
  })
}

Deno.test('TsImport.fromIdentifier threads the entity type into the import form', () => {
  const variableIdentifier = createVariable('useThing')
  const typeIdentifier = createType('Thing')

  assertEquals(
    TsImport.fromIdentifier('@/hooks', variableIdentifier).toString(),
    `import {useThing} from '@/hooks'`
  )
  assertEquals(
    TsImport.fromIdentifier('@/types', typeIdentifier).toString(),
    `import type {Thing} from '@/types'`
  )
})

Deno.test('TsImport merge unions specifiers, dedup on encoded form', () => {
  const first = TsImport.fromConcise('@/models', ['User'])
  const second = TsImport.fromConcise('@/models', [{ name: 'Order' }, 'User'])

  const merged = first.merge(second)

  // Same module merges to one statement; the duplicate `User` collapses.
  // (List.toObject emits `{a, b}` with no inner padding — matching the engine.)
  assertEquals(merged.toString(), `import {User, Order} from '@/models'`)
})
