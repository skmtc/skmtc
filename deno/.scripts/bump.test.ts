import { assertEquals, assertThrows } from '@std/assert'
import { incrementVersion, parseBumpArgs, planBump } from './bump.ts'
import type { WorkspacePackage } from './release.ts'

Deno.test('incrementVersion - bumps the requested component, zeroing below it', () => {
  assertEquals(incrementVersion('0.20.0', 'patch'), '0.20.1')
  assertEquals(incrementVersion('0.20.5', 'minor'), '0.21.0')
  assertEquals(incrementVersion('1.2.3', 'major'), '2.0.0')
  assertThrows(() => incrementVersion('0.6', 'patch'), Error, 'x.y.z')
  assertThrows(() => incrementVersion('0.6', 'minor'), Error, 'x.y.z')
})

Deno.test('parseBumpArgs - tokens, level flag, dry-run; rejects unknown flags', () => {
  assertEquals(parseBumpArgs(['core']), { tokens: ['core'], level: 'patch', dryRun: false })
  assertEquals(parseBumpArgs(['cli', 'core', '--minor']), {
    tokens: ['cli', 'core'],
    level: 'minor',
    dryRun: false
  })
  assertEquals(parseBumpArgs(['core', '--major', '--dry-run']), {
    tokens: ['core'],
    level: 'major',
    dryRun: true
  })
  assertThrows(() => parseBumpArgs(['--minor']), Error, 'Usage')
  assertThrows(() => parseBumpArgs(['core', '--bogus']), Error, 'Unknown flag')
})

/** Build a WorkspacePackage; deps are derived from its @skmtc/* imports. */
const wp = (
  name: string,
  version: string,
  imports: Record<string, string> = {}
): WorkspacePackage => ({
  name,
  version,
  dir: `/${name}`,
  imports,
  deps: [
    ...new Set(
      Object.values(imports)
        .map(v => v.match(/^jsr:(@skmtc\/[^@/\s]+)@/)?.[1])
        .filter((d): d is string => d !== undefined)
    )
  ]
})

Deno.test('planBump - an explicit minor bump cascades a patch + repin to every dependent', () => {
  const packages = [
    wp('@skmtc/core', '0.6.3'),
    wp('@skmtc/worker', '0.3.2', { '@skmtc/core': 'jsr:@skmtc/core@0.6.3' }),
    wp('@skmtc/cli', '0.3.4', {
      '@skmtc/core': 'jsr:@skmtc/core@0.6.3',
      '@skmtc/worker': 'jsr:@skmtc/worker@0.3.2',
      '@skmtc/worker/types': 'jsr:@skmtc/worker@0.3.2/types'
    })
  ]
  const plan = planBump(packages, new Map([['@skmtc/core', 'minor']]))

  // core: explicit minor bump.
  assertEquals(plan.get('@skmtc/core')?.version, '0.7.0')
  // worker: cascade patch + core pin rewritten to the new 0.7.0.
  assertEquals(plan.get('@skmtc/worker')?.version, '0.3.3')
  assertEquals(plan.get('@skmtc/worker')?.imports['@skmtc/core'], 'jsr:@skmtc/core@0.7.0')
  // cli: cascade patch + repins core AND worker (to its *cascaded* 0.3.3).
  assertEquals(plan.get('@skmtc/cli')?.version, '0.3.5')
  assertEquals(plan.get('@skmtc/cli')?.imports['@skmtc/core'], 'jsr:@skmtc/core@0.7.0')
  assertEquals(plan.get('@skmtc/cli')?.imports['@skmtc/worker'], 'jsr:@skmtc/worker@0.3.3')
  assertEquals(
    plan.get('@skmtc/cli')?.imports['@skmtc/worker/types'],
    'jsr:@skmtc/worker@0.3.3/types'
  )
})

Deno.test('planBump - an explicitly named dependent uses its own level, not a cascade patch', () => {
  const packages = [
    wp('@skmtc/core', '0.6.3'),
    wp('@skmtc/cli', '0.3.4', { '@skmtc/core': 'jsr:@skmtc/core@0.6.3' })
  ]
  const plan = planBump(
    packages,
    new Map([
      ['@skmtc/core', 'minor'],
      ['@skmtc/cli', 'major']
    ])
  )

  assertEquals(plan.get('@skmtc/core')?.version, '0.7.0')
  // cli is named with --major: 1.0.0, NOT a cascade patch of 0.3.4.
  assertEquals(plan.get('@skmtc/cli')?.version, '1.0.0')
  assertEquals(plan.get('@skmtc/cli')?.imports['@skmtc/core'], 'jsr:@skmtc/core@0.7.0')
})

Deno.test('planBump - bumping a leaf with no dependents changes only that package', () => {
  const packages = [
    wp('@skmtc/core', '0.6.3'),
    wp('@skmtc/cli', '0.3.4', { '@skmtc/core': 'jsr:@skmtc/core@0.6.3' })
  ]
  // core does not depend on cli, so nothing cascades.
  const plan = planBump(packages, new Map([['@skmtc/cli', 'patch']]))

  assertEquals(plan.size, 1)
  assertEquals(plan.get('@skmtc/cli')?.version, '0.3.5')
  assertEquals(plan.has('@skmtc/core'), false)
})
