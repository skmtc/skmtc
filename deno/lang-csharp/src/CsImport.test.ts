import { assertEquals } from '@std/assert'
import { CsImport } from './CsImport.ts'

Deno.test('plain specifiers collapse to ONE namespace-level using', () => {
  const csImport = CsImport.fromConcise('System.Text.Json.Serialization', [
    'JsonPropertyName',
    'JsonIgnore',
    'JsonExtensionData'
  ])

  assertEquals(csImport.toLines(), ['using System.Text.Json.Serialization;'])
})

Deno.test('aliased specifiers render the per-symbol alias-using form', () => {
  const csImport = CsImport.fromConcise('Acme.Shared', [
    'Money',
    { name: 'Task', alias: 'AcmeTask' }
  ])

  assertEquals(csImport.toLines(), ['using Acme.Shared;', 'using AcmeTask = Acme.Shared.Task;'])
})

Deno.test('an all-aliased import renders no plain using', () => {
  const csImport = CsImport.fromConcise('Acme.Shared', [{ name: 'Task', alias: 'AcmeTask' }])

  assertEquals(csImport.toLines(), ['using AcmeTask = Acme.Shared.Task;'])
})

Deno.test('a path-form module resolves to its namespace', () => {
  const csImport = CsImport.fromConcise('@/Acme/Api/Models/User.generated.cs', ['User'])

  assertEquals(csImport.resolvedNamespace(), 'Acme.Api.Models')
  assertEquals(csImport.toLines(), ['using Acme.Api.Models;'])
})

Deno.test('a global-namespace module renders nothing (visible everywhere without a using)', () => {
  const csImport = CsImport.fromConcise('@/Scratch.generated.cs', ['Scratch'])

  assertEquals(csImport.toLines(), [])
})

Deno.test('merge dedups specifiers by name + alias', () => {
  const first = CsImport.fromConcise('System.Text.Json', ['JsonElement'])
  const second = CsImport.fromConcise('System.Text.Json', ['JsonElement', 'JsonDocument'])

  const merged = first.merge(second)

  assertEquals(merged.toString(), 'using System.Text.Json;')
  assertEquals(
    merged instanceof CsImport ? merged.specifiers.map(specifier => specifier.name) : [],
    ['JsonElement', 'JsonDocument']
  )
})
