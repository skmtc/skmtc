import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { OperationGenerator } from '@/lib/operation-generator.ts'
import { Generator } from '@/lib/generator.ts'
import { join } from '@std/path/join'

Deno.test('OperationGenerator - toOperationMod generates correct mod.ts content', () => {
  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@test',
    packageName: 'user-operations',
    version: '1.0.0'
  })

  const operationGenerator = new OperationGenerator(generator)
  const result = operationGenerator.toOperationMod('UserOperations')

  assertStringIncludes(result, "import { toOperationEntry } from '@skmtc/core'")
  assertStringIncludes(result, "import { UserOperations } from './UserOperations.ts'")
  assertStringIncludes(result, 'export const UserOperationsEntry = toOperationEntry({')
  assertStringIncludes(result, "id: '@test/user-operations'")
  assertStringIncludes(result, 'isSupported({ operation })')
  assertStringIncludes(result, 'return true')
  assertStringIncludes(result, 'context.insertOperation(UserOperations, operation)')
})

Deno.test('OperationGenerator - toOperationBase generates correct base.ts content', () => {
  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@skmtc',
    packageName: 'product-ops',
    version: '2.0.0'
  })

  const operationGenerator = new OperationGenerator(generator)
  const result = operationGenerator.toOperationBase('ProductOps')

  assertStringIncludes(result, 'export const ProductOpsBase = toOperationBase({')
  assertStringIncludes(result, "id: '@skmtc/product-ops'")
  assertStringIncludes(result, 'toIdentifier(operation): Identifier')
  assertStringIncludes(result, 'toExportPath(operation): string')
  assertStringIncludes(result, "import { camelCase, capitalize, Identifier, toMethodVerb, toOperationBase } from '@skmtc/core'")
  assertStringIncludes(result, "import { join } from '@std/path/join'")
})

Deno.test('OperationGenerator - toOperationMainModule generates correct main module content', () => {
  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@company',
    packageName: 'order-ops',
    version: '1.5.0'
  })

  const operationGenerator = new OperationGenerator(generator)
  const result = operationGenerator.toOperationMainModule('OrderOps')

  assertStringIncludes(result, "import type { OperationInsertableArgs } from '@skmtc/core'")
  assertStringIncludes(result, "import { OrderOpsBase } from './base.ts'")
  assertStringIncludes(result, 'export class OrderOps extends OrderOpsBase')
  assertStringIncludes(result, 'constructor({ context, operation, settings }: OperationInsertableArgs)')
  assertStringIncludes(result, 'super({ context, operation, settings })')
  assertStringIncludes(result, 'override toString()')
})

Deno.test('OperationGenerator - createOperationFiles creates correct file structure', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const generator = Generator.create({
      projectName: 'test-project',
      scopeName: '@test',
      packageName: 'test-ops',
      version: '1.0.0'
    })

    const operationGenerator = new OperationGenerator(generator)
    const generatorPath = join(tempDir, 'test-ops')

    await operationGenerator.createOperationFiles(generatorPath)

    // Verify files were created
    const srcPath = join(generatorPath, 'src')
    const modExists = await Deno.stat(join(srcPath, 'mod.ts')).then(() => true).catch(() => false)
    const baseExists = await Deno.stat(join(srcPath, 'base.ts')).then(() => true).catch(() => false)
    const mainModuleExists = await Deno.stat(join(srcPath, 'TestOps.ts')).then(() => true).catch(() => false)

    assertEquals(modExists, true)
    assertEquals(baseExists, true)
    assertEquals(mainModuleExists, true)

    // Verify content
    const modContent = await Deno.readTextFile(join(srcPath, 'mod.ts'))
    assertStringIncludes(modContent, 'TestOps')
    assertStringIncludes(modContent, '@test/test-ops')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OperationGenerator - handles different package names correctly', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@org',
    packageName: 'my-custom-operations',
    version: '3.0.0'
  })

  const operationGenerator = new OperationGenerator(generator)
  const modContent = operationGenerator.toOperationMod('MyCustomOperations')
  const baseContent = operationGenerator.toOperationBase('MyCustomOperations')
  const mainContent = operationGenerator.toOperationMainModule('MyCustomOperations')

  // Verify module name is used correctly
  assertStringIncludes(modContent, 'MyCustomOperationsEntry')
  assertStringIncludes(modContent, '@org/my-custom-operations')
  assertStringIncludes(baseContent, 'MyCustomOperationsBase')
  assertStringIncludes(baseContent, '@org/my-custom-operations')
  assertStringIncludes(mainContent, 'export class MyCustomOperations')
})

Deno.test('OperationGenerator - generates files with proper TypeScript syntax', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const generator = Generator.create({
      projectName: 'syntax-test',
      scopeName: '@syntax',
      packageName: 'syntax-ops',
      version: '1.0.0'
    })

    const operationGenerator = new OperationGenerator(generator)
    const generatorPath = join(tempDir, 'syntax-ops')

    await operationGenerator.createOperationFiles(generatorPath)

    const srcPath = join(generatorPath, 'src')
    const modContent = await Deno.readTextFile(join(srcPath, 'mod.ts'))
    const baseContent = await Deno.readTextFile(join(srcPath, 'base.ts'))
    const mainContent = await Deno.readTextFile(join(srcPath, 'SyntaxOps.ts'))

    // Verify proper imports
    assertStringIncludes(modContent, 'import {')
    assertStringIncludes(baseContent, 'import {')
    assertStringIncludes(mainContent, 'import type {')

    // Verify exports
    assertStringIncludes(modContent, 'export const')
    assertStringIncludes(baseContent, 'export const')
    assertStringIncludes(mainContent, 'export class')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('OperationGenerator - toOperationMod includes isSupported predicate', () => {
  const generator = Generator.create({
    projectName: 'test',
    scopeName: '@test',
    packageName: 'api',
    version: '1.0.0'
  })

  const operationGenerator = new OperationGenerator(generator)
  const result = operationGenerator.toOperationMod('Api')

  // Verify isSupported function is present and returns true by default
  assertStringIncludes(result, 'isSupported({ operation }) {')
  assertStringIncludes(result, 'return true')
})

Deno.test('OperationGenerator - toOperationBase includes identifier generation logic', () => {
  const generator = Generator.create({
    projectName: 'test',
    scopeName: '@test',
    packageName: 'rest-api',
    version: '1.0.0'
  })

  const operationGenerator = new OperationGenerator(generator)
  const result = operationGenerator.toOperationBase('RestApi')

  // Verify identifier generation uses verb and camelCase
  assertStringIncludes(result, 'const verb = capitalize(toMethodVerb(operation.method))')
  assertStringIncludes(result, 'const name = `${verb}${camelCase(operation.path, { upperFirst: true })}`')
  assertStringIncludes(result, 'return Identifier.createVariable(name)')
})
