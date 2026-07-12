import { assertEquals, assertRejects } from '@std/assert'
import { Generator, CorePinMismatchError } from '@/lib/generator.ts'
import type { RootDenoJson } from '@/lib/root-deno-json.ts'
import { readCliCorePin } from '@/lib/doctor-headless.ts'

/**
 * Lightweight fake for {@link RootDenoJson}'s shape used by
 * `Generator.clone`'s pre-flight check. The real class has
 * persistence + workspace-list behavior we don't exercise here;
 * we only need `contents.imports['@skmtc/core']` to be readable.
 */
const toFakeRootDenoJson = (corePin: string): RootDenoJson =>
  ({
    contents: {
      imports: { '@skmtc/core': corePin }
    }
  }) as unknown as RootDenoJson

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

Deno.test('CorePinMismatchError - carries both pins + hint for recipe formatting', () => {
  const err = new CorePinMismatchError({
    projectPin: '^0.0.974',
    cliCorePin: '^0.3.7',
    hint: 'Update the pin or pass --force.'
  })

  assertEquals(err.name, 'CorePinMismatchError')
  assertEquals(err.projectPin, '^0.0.974')
  assertEquals(err.cliCorePin, '^0.3.7')
  assertEquals(err.hint, 'Update the pin or pass --force.')
  // Message threads both pins through so log readers see them inline.
  assertEquals(err.message.includes('^0.0.974') && err.message.includes('^0.3.7'), true)
})

Deno.test('Generator.clone - refuses on @skmtc/core peer-pin mismatch (pre-flight)', async () => {
  // The check needs the CLI's own pin to compare against. Skip if
  // that's unreadable (e.g. test runs outside a proper CLI build).
  const cliPin = readCliCorePin()
  if (cliPin === null) return

  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@skmtc',
    packageName: 'gen-test',
    // Doesn't matter — we never reach `Jsr.download` because the
    // pre-flight check fires first.
    version: '0.0.55'
  })

  // Pick a pin that's deliberately incompatible with whatever the
  // CLI currently uses. `^0.0.1` is in the 0.0.x range which can
  // never match a CLI on 0.x≥1 or 1.x.
  const badPin = 'jsr:@skmtc/core@^0.0.1'

  await assertRejects(async () => {
    await generator.clone({
      denoJson: toFakeRootDenoJson(badPin),
      // Manager / files aren't reached; pass null-ish and rely on
      // the pre-flight throwing before any Jsr work happens.
      manager: null as never
    })
  }, CorePinMismatchError)
})

Deno.test('Generator.clone - --force bypasses the pre-flight pin check', async () => {
  // With force, the pin mismatch should NOT throw a CorePinMismatchError.
  // The clone will still fail downstream (Jsr.download against an
  // invalid manager), but the failure shape must not be the
  // pre-flight check — confirms the gate honors the flag.
  const cliPin = readCliCorePin()
  if (cliPin === null) return

  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@skmtc',
    packageName: 'gen-test',
    version: '0.0.55'
  })

  const badPin = 'jsr:@skmtc/core@^0.0.1'

  const error = await assertRejects(async () => {
    await generator.clone({
      denoJson: toFakeRootDenoJson(badPin),
      manager: null as never,
      force: true
    })
  })

  // Whatever failure we hit, it must NOT be the pre-flight gate.
  assertEquals(error instanceof CorePinMismatchError, false)
})

Deno.test('Generator.clone - aligned pins pass the pre-flight check', async () => {
  const cliPin = readCliCorePin()
  if (cliPin === null) return

  const generator = Generator.create({
    projectName: 'test-project',
    scopeName: '@skmtc',
    packageName: 'gen-test',
    version: '0.0.55'
  })

  // Use the CLI's own pin verbatim — major.minor will match itself.
  const alignedPin = `jsr:@skmtc/core@${cliPin}`

  const error = await assertRejects(async () => {
    await generator.clone({
      denoJson: toFakeRootDenoJson(alignedPin),
      manager: null as never
    })
  })

  // The clone still fails (we passed null for manager and don't have
  // a real JSR mock), but specifically NOT with CorePinMismatchError —
  // the pre-flight check correctly let the aligned pin through.
  assertEquals(error instanceof CorePinMismatchError, false)
})
