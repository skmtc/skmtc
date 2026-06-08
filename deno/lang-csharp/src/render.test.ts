import { assertEquals } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { CsDefinition } from './CsDefinition.ts'
import { CsRecord } from './CsRecord.ts'
import { CsFile } from './CsFile.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('CsDefinition + CsRecord render the User DTO as a positional record', () => {
  const definition = new CsDefinition({
    context,
    identifier: Identifier.createType('User', { kind: 'record' }),
    value: new CsRecord([
      { name: 'Id', type: 'string' },
      { name: 'Name', type: 'string' },
      { name: 'Email', type: 'string', nullable: true }
    ])
  })

  assertEquals(
    definition.toString(),
    'public record User(\n' +
      '    string Id,\n' +
      '    string Name,\n' +
      '    string? Email\n' +
      ');'
  )
})

Deno.test('declaration keyword follows opaque Identifier.kind', () => {
  const asInterface = new CsDefinition({
    context,
    identifier: Identifier.createType('Named', { kind: 'interface' }),
    value: new CsRecord([{ name: 'Id', type: 'string' }])
  })

  assertEquals(asInterface.toString().startsWith('public interface Named('), true)
})

Deno.test('exported renders public vs internal (fifth exported behaviour)', () => {
  const internal = new CsDefinition({
    context,
    identifier: Identifier.createType('User', { exported: false, kind: 'record' }),
    value: new CsRecord([{ name: 'Id', type: 'string' }])
  })

  assertEquals(internal.toString().startsWith('internal record User('), true)
})

Deno.test('CsFile renders the file-scoped namespace header', () => {
  const file = new CsFile({ path: 'Models/User.cs', namespace: 'App.Models' })
  file.definitions.set(
    'User',
    new CsDefinition({
      context,
      identifier: Identifier.createType('User', { kind: 'record' }),
      value: new CsRecord([{ name: 'Id', type: 'string' }])
    })
  )

  assertEquals(
    file.toString(),
    'namespace App.Models;\n\npublic record User(\n    string Id\n);'
  )
})
