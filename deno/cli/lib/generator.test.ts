import { assertEquals } from '@std/assert'
import { Generator } from '@/lib/generator.ts'

Deno.test('Generator.create - creates instance with correct properties', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  assertEquals(generator.projectName, 'my-project')
  assertEquals(generator.scopeName, '@skmtc')
  assertEquals(generator.packageName, 'test-generator')
  assertEquals(generator.version, '1.0.0')
})

Deno.test('Generator.fromName - creates instance from name components', () => {
  const generator = Generator.fromName({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '2.0.0'
  })

  assertEquals(generator.projectName, 'my-project')
  assertEquals(generator.scopeName, '@skmtc')
  assertEquals(generator.packageName, 'test-generator')
  assertEquals(generator.version, '2.0.0')
})

Deno.test('Generator.toModuleName - returns correct module name format', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const moduleName = generator.toModuleName()

  assertEquals(moduleName, '@skmtc/test-generator')
})

Deno.test('Generator.toModuleName - handles scope without @ prefix', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: 'skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const moduleName = generator.toModuleName()

  assertEquals(moduleName, 'skmtc/test-generator')
})

Deno.test('Generator.toFullName - returns full JSR reference with version', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.2.3'
  })

  const fullName = generator.toFullName()

  assertEquals(fullName, 'jsr:@skmtc/test-generator@1.2.3')
})

Deno.test('Generator.toPath - returns relative path when relative is true', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const path = generator.toPath({ relative: true })

  assertEquals(path, './test-generator')
})

Deno.test('Generator.toPath - returns absolute path when relative is false', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const path = generator.toPath({ relative: false })

  // Path should end with the package name and include .skmtc
  assertEquals(path.includes('.skmtc'), true)
  assertEquals(path.endsWith('my-project/test-generator'), true)
})

Deno.test('Generator.toModPath - returns relative mod.ts path when relative is true', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const modPath = generator.toModPath({ relative: true })

  assertEquals(modPath, './test-generator/mod.ts')
})

Deno.test('Generator.toModPath - returns absolute mod.ts path when relative is false', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-generator',
    version: '1.0.0'
  })

  const modPath = generator.toModPath({ relative: false })

  // Path should end with mod.ts and include package name
  assertEquals(modPath.endsWith('test-generator/mod.ts'), true)
  assertEquals(modPath.includes('.skmtc'), true)
})

Deno.test('Generator - handles hyphenated package names correctly', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'shadcn-ui',
    version: '1.0.0'
  })

  assertEquals(generator.toModuleName(), '@skmtc/shadcn-ui')
  assertEquals(generator.toPath({ relative: true }), './shadcn-ui')
  assertEquals(generator.toModPath({ relative: true }), './shadcn-ui/mod.ts')
})

Deno.test('Generator - handles different scopes correctly', () => {
  const generator = Generator.create({
    projectName: 'my-project',
    scopeName: '@custom-org',
    packageName: 'my-generator',
    version: '0.1.0'
  })

  assertEquals(generator.toModuleName(), '@custom-org/my-generator')
  assertEquals(generator.toFullName(), 'jsr:@custom-org/my-generator@0.1.0')
})

Deno.test('Generator - handles version strings with various formats', () => {
  const semverGen = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-gen',
    version: '1.2.3'
  })
  assertEquals(semverGen.toFullName(), 'jsr:@skmtc/test-gen@1.2.3')

  const majorMinor = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-gen',
    version: '2.0'
  })
  assertEquals(majorMinor.toFullName(), 'jsr:@skmtc/test-gen@2.0')

  const latest = Generator.create({
    projectName: 'my-project',
    scopeName: '@skmtc',
    packageName: 'test-gen',
    version: 'latest'
  })
  assertEquals(latest.toFullName(), 'jsr:@skmtc/test-gen@latest')
})

Deno.test('Generator - multiple generators in same project have different package names', () => {
  const gen1 = Generator.create({
    projectName: 'shared-project',
    scopeName: '@skmtc',
    packageName: 'generator-one',
    version: '1.0.0'
  })
  const gen2 = Generator.create({
    projectName: 'shared-project',
    scopeName: '@skmtc',
    packageName: 'generator-two',
    version: '1.0.0'
  })
  // Both should have same project but different paths
  assertEquals(gen1.projectName, gen2.projectName)
  assertEquals(gen1.toPath({ relative: true }) !== gen2.toPath({ relative: true }), true)
  assertEquals(gen1.toModuleName() !== gen2.toModuleName(), true)
})
