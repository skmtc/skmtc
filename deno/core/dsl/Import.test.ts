import { assertEquals } from '@std/assert/equals'
import { Import, ImportName } from '@/dsl/Import.ts'

Deno.test('Import - generates basic named imports', () => {
  const importStatement = new Import({
    module: './types',
    importNames: ['User', 'Product']
  })

  assertEquals(importStatement.toString(), "import {User, Product} from './types'")
})

Deno.test('Import - generates single import', () => {
  const importStatement = new Import({
    module: 'react',
    importNames: ['useState']
  })

  assertEquals(importStatement.toString(), "import {useState} from 'react'")
})

Deno.test('Import - generates aliased imports', () => {
  const importStatement = new Import({
    module: 'react',
    importNames: [{ Component: 'ReactComponent' }]
  })

  assertEquals(importStatement.toString(), "import {Component as ReactComponent} from 'react'")
})

Deno.test('Import - generates mixed simple and aliased imports', () => {
  const importStatement = new Import({
    module: './api',
    importNames: ['ApiClient', { RequestOptions: 'Options' }]
  })

  assertEquals(
    importStatement.toString(),
    "import {ApiClient, RequestOptions as Options} from './api'"
  )
})

Deno.test('Import - handles scoped packages', () => {
  const importStatement = new Import({
    module: '@std/path/join',
    importNames: ['join']
  })

  assertEquals(importStatement.toString(), "import {join} from '@std/path/join'")
})

Deno.test('Import - toRecord returns correct format for simple imports', () => {
  const importStatement = new Import({
    module: './types',
    importNames: ['User', 'Product']
  })

  const record = importStatement.toRecord()

  assertEquals(record, {
    './types': ['User', 'Product']
  })
})

Deno.test('Import - toRecord returns correct format for aliased imports', () => {
  const importStatement = new Import({
    module: 'react',
    importNames: [{ Component: 'ReactComponent' }, 'useState']
  })

  const record = importStatement.toRecord()

  assertEquals(record, {
    react: [{ Component: 'ReactComponent' }, 'useState']
  })
})

Deno.test('ImportName - simple import name', () => {
  const importName = new ImportName('useState')

  assertEquals(importName.name, 'useState')
  assertEquals(importName.alias, undefined)
  assertEquals(importName.toString(), 'useState')
})

Deno.test('ImportName - aliased import name', () => {
  const importName = new ImportName({ Component: 'ReactComponent' })

  assertEquals(importName.name, 'Component')
  assertEquals(importName.alias, 'ReactComponent')
  assertEquals(importName.toString(), 'Component as ReactComponent')
})

Deno.test('ImportName - handles default import alias', () => {
  const importName = new ImportName({ default: 'React' })

  assertEquals(importName.name, 'default')
  assertEquals(importName.alias, 'React')
  assertEquals(importName.toString(), 'default as React')
})

Deno.test('Import - empty import names array', () => {
  const importStatement = new Import({
    module: './types',
    importNames: []
  })

  assertEquals(importStatement.toString(), "import {} from './types'")
})

Deno.test('Import - multiple aliased imports', () => {
  const importStatement = new Import({
    module: './models',
    importNames: [{ User: 'UserModel' }, { Product: 'ProductModel' }, { Order: 'OrderModel' }]
  })

  assertEquals(
    importStatement.toString(),
    "import {User as UserModel, Product as ProductModel, Order as OrderModel} from './models'"
  )
})

Deno.test('Import - generates import all (namespace) imports', () => {
  const importStatement = new Import({
    module: 'react',
    importNames: [{ '*': 'React' }]
  })

  assertEquals(importStatement.toString(), "import * as React from 'react'")
})

Deno.test('Import - generates import all with other named imports', () => {
  const importStatement = new Import({
    module: 'react',
    importNames: [{ '*': 'React' }, 'useState', 'useEffect']
  })

  assertEquals(
    importStatement.toString(),
    "import * as React, {useState, useEffect} from 'react'"
  )
})

Deno.test('ImportName - explicit form with isType', () => {
  const importName = new ImportName({ name: 'UseMutationOptions', isType: true })
  assertEquals(importName.name, 'UseMutationOptions')
  assertEquals(importName.alias, undefined)
  assertEquals(importName.isType, true)
  assertEquals(importName.toString(), 'type UseMutationOptions')
})

Deno.test('ImportName - explicit form with isType + alias', () => {
  const importName = new ImportName({ name: 'User', alias: 'IUser', isType: true })
  assertEquals(importName.name, 'User')
  assertEquals(importName.alias, 'IUser')
  assertEquals(importName.isType, true)
  assertEquals(importName.toString(), 'type User as IUser')
})

Deno.test('ImportName - explicit form without isType defaults to value', () => {
  const importName = new ImportName({ name: 'User', alias: 'IUser' })
  assertEquals(importName.isType, false)
  assertEquals(importName.toString(), 'User as IUser')
})

Deno.test('Import - emits statement-level "import type" when every name is a type', () => {
  // The all-type case prefers the statement-level form for readability.
  // Per-name `type` prefixes are valid TS but read noisier than
  // `import type { … }`.
  const importStatement = new Import({
    module: '@tanstack/react-query',
    importNames: [
      { name: 'UseMutationOptions', isType: true },
      { name: 'UseQueryOptions', isType: true }
    ]
  })

  assertEquals(
    importStatement.toString(),
    "import type {UseMutationOptions, UseQueryOptions} from '@tanstack/react-query'"
  )
})

Deno.test('Import - mixed value + type names uses per-name "type" prefix', () => {
  // When some names are values, the statement-level form is invalid; TS
  // requires the per-name `type` prefix instead.
  const importStatement = new Import({
    module: '@tanstack/react-query',
    importNames: [
      'useMutation',
      'useQueryClient',
      { name: 'UseMutationOptions', isType: true }
    ]
  })

  assertEquals(
    importStatement.toString(),
    "import {useMutation, useQueryClient, type UseMutationOptions} from '@tanstack/react-query'"
  )
})

Deno.test('Import - type imports render correctly after a Set<string> round-trip', () => {
  // This is the scenario `File.imports` exercises: register an import,
  // it gets stringified into a Set, then a new Import is rebuilt from
  // those strings before render. The `isType` flag itself does NOT
  // survive — the round-tripped name is the literal string
  // `'type UseMutationOptions'`. That still emits valid TS because
  // `import { type Foo }` is the per-name form. The visible output is
  // therefore byte-equivalent to the original, just via a different
  // code path (per-name `type` keyword instead of statement-level
  // `import type { … }`).
  const original = new Import({
    module: '@tanstack/react-query',
    importNames: [
      'useMutation',
      { name: 'UseMutationOptions', isType: true }
    ]
  })

  const stringified = original.importNames.map(n => n.toString())
  const rebuilt = new Import({ module: '@tanstack/react-query', importNames: stringified })

  assertEquals(
    rebuilt.toString(),
    "import {useMutation, type UseMutationOptions} from '@tanstack/react-query'"
  )
  assertEquals(rebuilt.toString(), original.toString())
})

Deno.test('Import - toRecord emits the explicit form for type imports', () => {
  const importStatement = new Import({
    module: '@tanstack/react-query',
    importNames: [
      'useMutation',
      { name: 'UseMutationOptions', isType: true },
      { name: 'User', alias: 'IUser', isType: true }
    ]
  })

  assertEquals(importStatement.toRecord(), {
    '@tanstack/react-query': [
      'useMutation',
      { name: 'UseMutationOptions', isType: true },
      { name: 'User', alias: 'IUser', isType: true }
    ]
  })
})
