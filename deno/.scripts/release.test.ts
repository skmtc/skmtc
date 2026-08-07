import { assertEquals, assertThrows } from '@std/assert'
import { assertStringIncludes } from '@std/assert/string-includes'
import {
  assertNoPrivateDeps,
  incrementPatch,
  planRelease,
  toDependencyOrder,
  toJsrInstallArgs,
  toJsrReinstallCommand,
  toWorkspaceDep,
  type WorkspacePackage
} from './release.ts'

Deno.test('incrementPatch - bumps the patch component', () => {
  assertEquals(incrementPatch('0.6.2'), '0.6.3')
  assertEquals(incrementPatch('1.0.9'), '1.0.10')
  assertThrows(() => incrementPatch('0.6'), Error, 'x.y.z')
})

Deno.test('toWorkspaceDep - extracts a workspace package from a jsr: import', () => {
  const names = new Set(['@skmtc/core', '@skmtc/worker'])
  assertEquals(toWorkspaceDep('jsr:@skmtc/core@0.6.3', names), '@skmtc/core')
  // A `/sub-path` entry still resolves to its package.
  assertEquals(toWorkspaceDep('jsr:@skmtc/worker@0.3.2/types', names), '@skmtc/worker')
})

Deno.test('toWorkspaceDep - returns null for non-workspace and non-jsr imports', () => {
  const names = new Set(['@skmtc/core'])
  assertEquals(toWorkspaceDep('jsr:@std/path@^1', names), null) // not a workspace package
  assertEquals(toWorkspaceDep('npm:valibot@1.1.0', names), null) // not a jsr: specifier
  assertEquals(toWorkspaceDep('./local/mod.ts', names), null) // relative path
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

Deno.test('toDependencyOrder - a dependency always precedes its dependent', () => {
  const order = toDependencyOrder([
    wp('@skmtc/cli', '1.0.0', { '@skmtc/core': 'jsr:@skmtc/core@1.0.0' }),
    wp('@skmtc/core', '1.0.0')
  ]).map(p => p.name)
  assertEquals(order, ['@skmtc/core', '@skmtc/cli'])
})

Deno.test('toDependencyOrder - throws on a dependency cycle', () => {
  assertThrows(
    () =>
      toDependencyOrder([
        { name: 'a', version: '1', dir: '/a', imports: {}, deps: ['b'] },
        { name: 'b', version: '1', dir: '/b', imports: {}, deps: ['a'] }
      ]),
    Error,
    'cycle'
  )
})

Deno.test('planRelease - a direct core bump cascades to every dependent', () => {
  const packages = [
    wp('@skmtc/core', '0.6.3'),
    wp('@skmtc/worker', '0.3.2', { '@skmtc/core': 'jsr:@skmtc/core@0.6.2' }),
    wp('@skmtc/cli', '0.3.4', {
      '@skmtc/core': 'jsr:@skmtc/core@0.6.2',
      '@skmtc/worker': 'jsr:@skmtc/worker@0.3.2',
      '@skmtc/worker/types': 'jsr:@skmtc/worker@0.3.2/types'
    })
  ]
  // worker@0.3.2 and cli@0.3.4 are published; core@0.6.3 is not — it
  // was just bumped, the direct trigger for the release.
  const published = new Set(['@skmtc/worker@0.3.2', '@skmtc/cli@0.3.4'])

  const plan = planRelease(packages, published)

  // core: direct.
  assertEquals(plan.get('@skmtc/core')?.version, '0.6.3')
  // worker: cascade — patch-bumped, core pin rewritten.
  assertEquals(plan.get('@skmtc/worker')?.version, '0.3.3')
  assertEquals(plan.get('@skmtc/worker')?.imports['@skmtc/core'], 'jsr:@skmtc/core@0.6.3')
  // cli: cascade — patch-bumped, both core and worker pins rewritten
  // (worker to its *cascaded* 0.3.3, not its old version).
  assertEquals(plan.get('@skmtc/cli')?.version, '0.3.5')
  assertEquals(plan.get('@skmtc/cli')?.imports['@skmtc/core'], 'jsr:@skmtc/core@0.6.3')
  assertEquals(plan.get('@skmtc/cli')?.imports['@skmtc/worker'], 'jsr:@skmtc/worker@0.3.3')
  assertEquals(
    plan.get('@skmtc/cli')?.imports['@skmtc/worker/types'],
    'jsr:@skmtc/worker@0.3.3/types'
  )
})

Deno.test('planRelease - nothing to do when every version is already published', () => {
  const packages = [
    wp('@skmtc/core', '0.6.3'),
    wp('@skmtc/worker', '0.3.3', { '@skmtc/core': 'jsr:@skmtc/core@0.6.3' })
  ]
  const published = new Set(['@skmtc/core@0.6.3', '@skmtc/worker@0.3.3'])
  assertEquals(planRelease(packages, published).size, 0)
})

Deno.test('planRelease - a directly-bumped dependent keeps its own version', () => {
  // core bumped to 0.6.3; cli ALSO directly bumped (to 0.4.0). cli
  // publishes at the human's 0.4.0 — not a cascade patch of 0.3.4 —
  // and still gets its core pin rewritten.
  const packages = [
    wp('@skmtc/core', '0.6.3'),
    wp('@skmtc/cli', '0.4.0', { '@skmtc/core': 'jsr:@skmtc/core@0.6.2' })
  ]
  const plan = planRelease(packages, new Set())

  assertEquals(plan.get('@skmtc/cli')?.version, '0.4.0')
  assertEquals(plan.get('@skmtc/cli')?.imports['@skmtc/core'], 'jsr:@skmtc/core@0.6.3')
})

Deno.test('assertNoPrivateDeps - a private package may depend on publishable ones', () => {
  assertNoPrivateDeps([
    wp('@skmtc/core', '1.0.0'),
    {
      ...wp('@skmtc/lang-java', '0.0.1', { '@skmtc/core': 'jsr:@skmtc/core@1.0.0' }),
      private: true
    }
  ])
})

Deno.test('assertNoPrivateDeps - throws when a publishable package pins a private one', () => {
  assertThrows(
    () =>
      assertNoPrivateDeps([
        { ...wp('@skmtc/swagger2openapi', '0.1.2'), private: true },
        wp('@skmtc/convert', '0.1.16', {
          '@skmtc/swagger2openapi': 'jsr:@skmtc/swagger2openapi@0.1.2'
        })
      ]),
    Error,
    'private'
  )
})

Deno.test('planRelease - a private package is never direct-released from registry absence', () => {
  const packages = [{ ...wp('@skmtc/lang-java', '0.0.1'), private: true }]
  assertEquals(planRelease(packages, new Set()).size, 0)
})

Deno.test('planRelease - a private package still cascade-bumps when a dependency moves', () => {
  const packages = [
    wp('@skmtc/core', '0.6.3'),
    {
      ...wp('@skmtc/lang-java', '0.0.1', { '@skmtc/core': 'jsr:@skmtc/core@0.6.2' }),
      private: true
    }
  ]
  const plan = planRelease(packages, new Set())

  assertEquals(plan.get('@skmtc/lang-java')?.version, '0.0.2')
  assertEquals(plan.get('@skmtc/lang-java')?.imports['@skmtc/core'], 'jsr:@skmtc/core@0.6.3')
})

Deno.test('toJsrInstallArgs - the just-published pin carries the dependency-age flag', () => {
  // An exact pin published seconds ago is the HARD-error face of Deno's
  // dependency-age gate, so the release script's own reinstall would
  // fail to resolve the version it just published.
  const args = toJsrInstallArgs('0.9.42')

  assertEquals(args.includes('--minimum-dependency-age=0'), true)
  assertEquals(args.at(-1), 'jsr:@skmtc/cli@0.9.42')
  assertEquals(args[0], 'install')
})

Deno.test('toJsrReinstallCommand - the printed recovery line carries it too', () => {
  // This line is aimed at consumers outside this workspace, where
  // `deno/deno.json`'s `minimumDependencyAge: "0"` does not apply.
  const command = toJsrReinstallCommand('https://jsr.io/', '0.9.42')

  assertStringIncludes(command, '--minimum-dependency-age=0')
  assertStringIncludes(command, 'JSR_URL=https://jsr.io/')
  assertStringIncludes(command, 'jsr:@skmtc/cli@0.9.42')
})
