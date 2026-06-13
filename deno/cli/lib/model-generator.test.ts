import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import { ModelGenerator } from '@/lib/model-generator.ts'
import { Generator } from '@/lib/generator.ts'
import { join } from '@std/path/join'

Deno.test('ModelGenerator - toModelMod generates correct mod.ts content', () => {
  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@test',
    packageName: 'user-model',
    version: '1.0.0'
  })

  const modelGenerator = new ModelGenerator(generator)
  const result = modelGenerator.toModelMod('UserModel')

  assertStringIncludes(result, "import { toModelEntry } from '@skmtc/core'")
  assertStringIncludes(result, "import { UserModelProjection } from './UserModelProjection.ts'")
  assertStringIncludes(result, 'export const user-modelEntry = toModelEntry({')
  assertStringIncludes(result, "id: '@test/user-model'")
  assertStringIncludes(result, 'context.insertModel(UserModelProjection, refName)')
})

Deno.test('ModelGenerator - toModelProjectionBase generates correct base.ts content', () => {
  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@skmtc',
    packageName: 'product-model',
    version: '1.0.0'
  })

  const modelGenerator = new ModelGenerator(generator)
  const result = modelGenerator.toModelProjectionBase('ProductModel')

  assertStringIncludes(result, 'export const ProductModelBase = toModelProjectionBase({')
  assertStringIncludes(result, "id: '@skmtc/product-model'")
  assertStringIncludes(result, 'toIdentifierName({ refName }): string')
  assertStringIncludes(result, 'toIdentifierType(): TsIdentifierType')
  assertStringIncludes(result, 'toExportPath({ refName, enrichments, variant }): string')
  assertStringIncludes(result, "import { decapitalize, camelCase } from '@skmtc/core'")
  assertStringIncludes(result, "import { toModelProjectionBase } from '@skmtc/lang-typescript'")
})

Deno.test('ModelGenerator - toModelProjection generates correct projection content', () => {
  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@company',
    packageName: 'order-model',
    version: '2.0.0'
  })

  const modelGenerator = new ModelGenerator(generator)
  const result = modelGenerator.toModelProjection('OrderModel')

  assertStringIncludes(result, "import type { TypeSystemValue, GenerateContext, RefName, ContentSettings } from '@skmtc/core'")
  assertStringIncludes(result, "import { toOrderModelValue } from './OrderModel.ts'")
  assertStringIncludes(result, "import { OrderModelBase } from './base.ts'")
  assertStringIncludes(result, 'export class OrderModelProjection extends OrderModelBase')
  assertStringIncludes(result, 'value: TypeSystemValue')
  assertStringIncludes(result, 'override toString()')
})

Deno.test('ModelGenerator - createModelFiles creates correct file structure', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const generator = Generator.create({
      projectName: 'test-project',
      scopeName: '@test',
      packageName: 'test-model',
      version: '1.0.0'
    })

    const modelGenerator = new ModelGenerator(generator)
    const generatorPath = join(tempDir, 'test-model')

    await modelGenerator.createModelFiles(generatorPath)

    // Verify files were created
    const srcPath = join(generatorPath, 'src')
    const modExists = await Deno.stat(join(srcPath, 'mod.ts')).then(() => true).catch(() => false)
    const baseExists = await Deno.stat(join(srcPath, 'base.ts')).then(() => true).catch(() => false)
    const projectionExists = await Deno.stat(join(srcPath, 'TestModelProjection.ts')).then(() => true).catch(() => false)

    assertEquals(modExists, true)
    assertEquals(baseExists, true)
    assertEquals(projectionExists, true)

    // Verify content
    const modContent = await Deno.readTextFile(join(srcPath, 'mod.ts'))
    assertStringIncludes(modContent, 'TestModelProjection')
    assertStringIncludes(modContent, '@test/test-model')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})

Deno.test('ModelGenerator - handles different package names correctly', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@org',
    packageName: 'my-custom-model',
    version: '3.0.0'
  })

  const modelGenerator = new ModelGenerator(generator)
  const modContent = modelGenerator.toModelMod('MyCustomModel')
  const baseContent = modelGenerator.toModelProjectionBase('MyCustomModel')
  const projectionContent = modelGenerator.toModelProjection('MyCustomModel')

  // Verify module name is used correctly
  assertStringIncludes(modContent, 'my-custom-model')
  assertStringIncludes(modContent, '@org/my-custom-model')
  assertStringIncludes(baseContent, '@org/my-custom-model')
  assertStringIncludes(projectionContent, 'MyCustomModel')
})

Deno.test('ModelGenerator - generates files with proper TypeScript syntax', async () => {
  const tempDir = await Deno.makeTempDir()

  try {
    const generator = Generator.create({
      projectName: 'syntax-test',
      scopeName: '@syntax',
      packageName: 'syntax-model',
      version: '1.0.0'
    })

    const modelGenerator = new ModelGenerator(generator)
    const generatorPath = join(tempDir, 'syntax-model')

    await modelGenerator.createModelFiles(generatorPath)

    const srcPath = join(generatorPath, 'src')
    const modContent = await Deno.readTextFile(join(srcPath, 'mod.ts'))
    const baseContent = await Deno.readTextFile(join(srcPath, 'base.ts'))
    const projectionContent = await Deno.readTextFile(join(srcPath, 'SyntaxModelProjection.ts'))

    // Verify proper imports
    assertStringIncludes(modContent, 'import {')
    assertStringIncludes(baseContent, 'import {')
    assertStringIncludes(projectionContent, 'import type {')

    // Verify exports
    assertStringIncludes(modContent, 'export const')
    assertStringIncludes(baseContent, 'export const')
    assertStringIncludes(projectionContent, 'export class')
  } finally {
    await Deno.remove(tempDir, { recursive: true })
  }
})
