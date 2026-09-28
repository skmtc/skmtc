import { assertEquals } from '@std/assert/equals'
import { toBareJsrSpecifiers } from '@/lib/to-bare-jsr-specifiers.ts'

Deno.test('toBareJsrSpecifiers - rewrites versioned jsr imports to bare names', () => {
  const content = [
    `import { List, type ListObject } from 'jsr:@skmtc/lang-typescript@0.12.22'`,
    `import { capitalize } from 'jsr:@skmtc/core@0.29.0'`,
    `import type { OasOperationProjectionConstructorArgs } from "jsr:@skmtc/core@0.29.0"`,
    `import { TanstackQueryBase } from './base.ts'`
  ].join('\n')

  const result = toBareJsrSpecifiers(content)

  assertEquals(
    result.content,
    [
      `import { List, type ListObject } from '@skmtc/lang-typescript'`,
      `import { capitalize } from '@skmtc/core'`,
      `import type { OasOperationProjectionConstructorArgs } from "@skmtc/core"`,
      `import { TanstackQueryBase } from './base.ts'`
    ].join('\n')
  )
  assertEquals(result.pins, {
    '@skmtc/lang-typescript': 'jsr:@skmtc/lang-typescript@0.12.22',
    '@skmtc/core': 'jsr:@skmtc/core@0.29.0'
  })
})

Deno.test('toBareJsrSpecifiers - keeps the subpath', () => {
  const result = toBareJsrSpecifiers(`import { join } from 'jsr:@std/path@1.0.8/join'`)

  assertEquals(result.content, `import { join } from '@std/path/join'`)
  assertEquals(result.pins, { '@std/path': 'jsr:@std/path@1.0.8' })
})

Deno.test('toBareJsrSpecifiers - rewrites multiline, re-export, side-effect and dynamic imports', () => {
  const content = [
    `import {`,
    `  a,`,
    `  b`,
    `} from 'jsr:@skmtc/core@0.29.0'`,
    `export * from 'jsr:@skmtc/gen-zod@0.2.7'`,
    `export { c } from 'jsr:@skmtc/gen-typescript@0.2.7'`,
    `import 'jsr:@skmtc/side-effect@1.0.0'`,
    `const lazy = await import('jsr:@skmtc/lazy@2.0.0-rc.1/sub/path')`
  ].join('\n')

  const result = toBareJsrSpecifiers(content)

  assertEquals(
    result.content,
    [
      `import {`,
      `  a,`,
      `  b`,
      `} from '@skmtc/core'`,
      `export * from '@skmtc/gen-zod'`,
      `export { c } from '@skmtc/gen-typescript'`,
      `import '@skmtc/side-effect'`,
      `const lazy = await import('@skmtc/lazy/sub/path')`
    ].join('\n')
  )
  assertEquals(result.pins, {
    '@skmtc/core': 'jsr:@skmtc/core@0.29.0',
    '@skmtc/gen-zod': 'jsr:@skmtc/gen-zod@0.2.7',
    '@skmtc/gen-typescript': 'jsr:@skmtc/gen-typescript@0.2.7',
    '@skmtc/side-effect': 'jsr:@skmtc/side-effect@1.0.0',
    '@skmtc/lazy': 'jsr:@skmtc/lazy@2.0.0-rc.1'
  })
})

Deno.test('toBareJsrSpecifiers - leaves jsr strings outside import positions alone', () => {
  const content = [
    `import { a } from '@skmtc/core'`,
    `import { b } from 'npm:valibot@1.1.0'`,
    `const pin = 'jsr:@skmtc/core@0.29.0'`
  ].join('\n')

  const result = toBareJsrSpecifiers(content)

  assertEquals(result.content, content)
  assertEquals(result.pins, {})
})
