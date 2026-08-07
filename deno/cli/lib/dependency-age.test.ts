import { assertEquals } from '@std/assert/equals'
import { assertStringIncludes } from '@std/assert/string-includes'
import {
  DEPENDENCY_AGE_FLAG,
  isWithinDependencyAgeWindow,
  supportsDependencyAgeFlag,
  toCliInstallCommand,
  toDependencyAgeArgs,
  toHoursSincePublish
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
