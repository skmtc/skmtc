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
