import { assertEquals, assertStringIncludes } from '@std/assert'
import { formatMissingArgError, resolveInputMode } from '@/lib/strict-mode.ts'

Deno.test('resolveInputMode - --no-input flag forces strict mode even with a TTY', () => {
  assertEquals(resolveInputMode({ noInputFlag: true }), 'strict')
})

// Deno test runs typically have stdin/stdout that are not TTYs (piped).
// Treat that as the implicit signal — the default call should return
// strict in CI / test environments. This is the agent path.
Deno.test('resolveInputMode - non-TTY stdin/stdout resolves to strict', () => {
  assertEquals(resolveInputMode(), 'strict')
})

Deno.test('formatMissingArgError - includes arg, usage, and example', () => {
  const message = formatMissingArgError({
    command: 'install',
    arg: '<project>',
    usage: 'skmtc install <generators...> <project>',
    example: 'skmtc install @skmtc/gen-zod my-api'
  })

  assertStringIncludes(message, 'missing required argument: <project>')
  assertStringIncludes(message, 'Usage:   skmtc install <generators...> <project>')
  assertStringIncludes(message, 'Example: skmtc install @skmtc/gen-zod my-api')
})

Deno.test('formatMissingArgError - includes discover hint when provided', () => {
  const message = formatMissingArgError({
    command: 'install',
    arg: '<project>',
    usage: 'skmtc install <generators...> <project>',
    example: 'skmtc install @skmtc/gen-zod my-api',
    discover: 'ls .skmtc/'
  })

  assertStringIncludes(message, 'Discover valid values: ls .skmtc/')
})

Deno.test('formatMissingArgError - omits discover line when not provided', () => {
  const message = formatMissingArgError({
    command: 'init',
    arg: '<projectName>',
    usage: 'skmtc init <projectName> <basePath>',
    example: 'skmtc init my-api ./web/app/src'
  })

  assertEquals(message.includes('Discover'), false)
})
