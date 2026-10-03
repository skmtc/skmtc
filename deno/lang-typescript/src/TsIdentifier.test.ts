import { assertStrictEquals, assertThrows } from '@std/assert'
import { IdentifierBase } from '@skmtc/core'
import { createVariable } from './createIdentifier.ts'
import { toTsIdentifier } from './TsIdentifier.ts'

Deno.test('toTsIdentifier - hands back the TsIdentifier the lang layer built, not a copy', () => {
  const identifier = createVariable('user')
  const neutral: IdentifierBase = identifier

  assertStrictEquals(toTsIdentifier(neutral), identifier)
})

Deno.test('toTsIdentifier - refuses an identifier another lang layer built', () => {
  // A neutral identifier stands in for a foreign one: it has a name but no
  // TypeScript `type`, so rendering it as an import or re-export would guess.
  const foreign = new IdentifierBase({ name: 'User' })

  assertThrows(() => toTsIdentifier(foreign), Error, "'User' was not built by the TypeScript lang layer")
})
