import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import {
  DEPENDENCY_AGE_FLAG,
  enforcesDependencyAgeGate,
  isWithinDependencyAgeWindow,
  supportsDependencyAgeFlag,
  toCliInstallCommand,
  toDependencyAgeArgs,
  toHoursSincePublish,
  toProjectInstallCommand
} from '@/lib/dependency-age.ts'

Deno.test('supportsDependencyAgeFlag - the flag parses from Deno 2.6', () => {
  // On ≤ 2.5 the flag is an unknown argument, which would fail the whole
  // subprocess — worse than the holdback it exists to clear.
  assertEquals(supportsDependencyAgeFlag('2.5.9'), false)
  assertEquals(supportsDependencyAgeFlag('2.6.0'), true)
  assertEquals(supportsDependencyAgeFlag('2.9.4'), true)
  assertEquals(supportsDependencyAgeFlag('3.0.0'), true)
  assertEquals(supportsDependencyAgeFlag('1.46.3'), false)
})

Deno.test('supportsDependencyAgeFlag - an unreadable version omits the flag', () => {
  assertEquals(supportsDependencyAgeFlag('canary'), false)
})

Deno.test('toDependencyAgeArgs - splices the flag in for a supported Deno', () => {
  assertEquals(toDependencyAgeArgs('2.9.4'), [DEPENDENCY_AGE_FLAG])
  assertEquals(toDependencyAgeArgs('2.5.0'), [])
})

Deno.test('toCliInstallCommand - the printed remediation carries the flag', () => {
  // The trap this closes: a remediation without the flag re-resolves to
  // the version the reader is trying to leave, and reports success.
  const command = toCliInstallCommand('2.9.4')
  assertStringIncludes(command, DEPENDENCY_AGE_FLAG)
  assertStringIncludes(command, '--unstable-worker-options')
  assertStringIncludes(command, 'jsr:@skmtc/cli')
})

Deno.test('toCliInstallCommand - omits the flag where Deno would reject it', () => {
  assertEquals(toCliInstallCommand('2.5.0').includes(DEPENDENCY_AGE_FLAG), false)
})

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

Deno.test('toHoursSincePublish - measures the age, or reports it unknown', () => {
  assertEquals(Math.round(toHoursSincePublish(hoursAgo(5)) ?? 0), 5)
  assertEquals(toHoursSincePublish(undefined), undefined)
  assertEquals(toHoursSincePublish('not a date'), undefined)
})

Deno.test('isWithinDependencyAgeWindow - 24 hours is the boundary', () => {
  assertEquals(isWithinDependencyAgeWindow(hoursAgo(1)), true)
  assertEquals(isWithinDependencyAgeWindow(hoursAgo(23.5)), true)
  assertEquals(isWithinDependencyAgeWindow(hoursAgo(25)), false)
  // No publish time reported: assume nothing rather than claim a hold.
  assertEquals(isWithinDependencyAgeWindow(undefined), false)
})

Deno.test('isWithinDependencyAgeWindow - a future publish time counts as inside', () => {
  // Clock skew between the machine and the registry puts `publishedAt`
  // marginally ahead. The release just landed, so it is as held back as
  // a version gets — reading it as "outside" drops the explanation in
  // the one case the window is checked for.
  assertEquals(isWithinDependencyAgeWindow(hoursAgo(-0.02)), true)
  assertEquals(isWithinDependencyAgeWindow(hoursAgo(-5)), true)
})

Deno.test('enforcesDependencyAgeGate - the holdback starts at Deno 2.9, not 2.6', () => {
  // Two versions matter and conflating them gives wrong advice: the flag
  // PARSES from 2.6, but nothing is HELD BACK until 2.9.
  assertEquals(enforcesDependencyAgeGate('2.8.5'), false)
  assertEquals(enforcesDependencyAgeGate('2.9.0'), true)
  assertEquals(enforcesDependencyAgeGate('3.0.0'), true)
  assertEquals(enforcesDependencyAgeGate('canary'), false)
  // 2.6-2.8 accept the flag but have nothing to hold back.
  assertEquals(supportsDependencyAgeFlag('2.7.0'), true)
  assertEquals(enforcesDependencyAgeGate('2.7.0'), false)
})

Deno.test('toProjectInstallCommand - the publish remediation carries the flag', () => {
  // `skmtc publish` tells you to run this inside `.skmtc/<project>/`,
  // whose deno.json holds EXACT @skmtc/* pins written at the CLI's own
  // version — the hard-error face of the gate on a fresh release.
  assertStringIncludes(toProjectInstallCommand('2.9.4'), DEPENDENCY_AGE_FLAG)
  assertEquals(toProjectInstallCommand('2.9.4').startsWith('deno install'), true)
  assertEquals(toProjectInstallCommand('2.5.0'), 'deno install')
})
