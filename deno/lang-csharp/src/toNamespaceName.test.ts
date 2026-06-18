import { assertEquals, assertThrows } from '@std/assert'
import { toNamespaceName } from './toNamespaceName.ts'

Deno.test('derives the dotted namespace from the export path', () => {
  assertEquals(toNamespaceName('@/Acme/Api/Models/User.generated.cs'), 'Acme.Api.Models')
  assertEquals(toNamespaceName('@/Acme/User.generated.cs'), 'Acme')
})

Deno.test('a root-level file maps to the global namespace (empty string)', () => {
  assertEquals(toNamespaceName('@/User.generated.cs'), '')
  assertEquals(toNamespaceName('./User.cs'), '')
})

Deno.test('throws on a segment that is not a C# identifier', () => {
  assertThrows(
    () => toNamespaceName('@/my-models/User.cs'),
    Error,
    "segment 'my-models' is not a valid namespace name part"
  )
  assertThrows(() => toNamespaceName('@/1st/User.cs'), Error, 'not a valid namespace name part')
})

Deno.test('throws on a reserved-keyword segment (loud beats @-escaped namespaces)', () => {
  assertThrows(
    () => toNamespaceName('@/class/User.cs'),
    Error,
    "segment 'class' is not a valid namespace name part"
  )
})
