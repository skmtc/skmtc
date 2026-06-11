import { assertEquals, assertThrows } from '@std/assert'
import type { GenerateContextType } from '@skmtc/core/generate'
import { Identifier } from '@skmtc/core'
import { CsAttribute } from './CsAttribute.ts'
import { CsDefinition } from './CsDefinition.ts'
import { CsPropertyList } from './CsPropertyList.ts'
import { createEnum, createRecord } from './createIdentifier.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('record shell renders sealed partial with a brace body', () => {
  const definition = new CsDefinition({
    context,
    identifier: createRecord('User'),
    value: new CsPropertyList([{ name: 'UserId', type: 'string', required: true }])
  })

  assertEquals(
    definition.toString(),
    'public sealed partial record User\n' +
      '{\n' +
      '    public required string UserId { get; init; }\n' +
      '}'
  )
})

Deno.test('an empty record body collapses to the bodyless form', () => {
  const definition = new CsDefinition({
    context,
    identifier: createRecord('Marker'),
    value: new CsPropertyList([])
  })

  assertEquals(definition.toString(), 'public sealed partial record Marker;')
})

Deno.test('enum shell renders a brace body', () => {
  const definition = new CsDefinition({
    context,
    identifier: createEnum('Status'),
    value: '    Active,\n\n    Archived'
  })

  assertEquals(
    definition.toString(),
    'public enum Status\n{\n    Active,\n\n    Archived\n}'
  )
})

Deno.test('BOTH visibility states render a keyword (the fifth exported behavior)', () => {
  const exported = new CsDefinition({
    context,
    identifier: createRecord('Visible'),
    value: new CsPropertyList([])
  })
  const internal = new CsDefinition({
    context,
    identifier: createRecord('Hidden', { exported: false }),
    value: new CsPropertyList([])
  })

  assertEquals(exported.toString(), 'public sealed partial record Visible;')
  assertEquals(internal.toString(), 'internal sealed partial record Hidden;')
})

Deno.test('noExport restricts the same way as exported: false', () => {
  const definition = new CsDefinition({
    context,
    identifier: createRecord('Hidden'),
    value: new CsPropertyList([]),
    noExport: true
  })

  assertEquals(definition.toString(), 'internal sealed partial record Hidden;')
})

Deno.test('class-level attributes ride the CsAttributed protocol, one per line above the shell', () => {
  class AttributedValue {
    attributes = [
      new CsAttribute('JsonConverter', ['typeof(JsonStringEnumConverter)'])
    ]

    toString(): string {
      return '    Active'
    }
  }

  const definition = new CsDefinition({
    context,
    identifier: createEnum('Status'),
    value: new AttributedValue()
  })

  assertEquals(
    definition.toString(),
    '[JsonConverter(typeof(JsonStringEnumConverter))]\n' +
      'public enum Status\n{\n    Active\n}'
  )
})

Deno.test('description renders an XML-doc summary above the attributes, XML-escaped', () => {
  class AttributedValue {
    attributes = [new CsAttribute('JsonExtensionData')]

    toString(): string {
      return '    Active'
    }
  }

  const definition = new CsDefinition({
    context,
    identifier: createEnum('Status'),
    value: new AttributedValue(),
    description: 'Statuses for <Order> records & friends'
  })

  assertEquals(
    definition.toString(),
    '/// <summary>\n' +
      '/// Statuses for &lt;Order&gt; records &amp; friends\n' +
      '/// </summary>\n' +
      '[JsonExtensionData]\n' +
      'public enum Status\n{\n    Active\n}'
  )
})

Deno.test('the CsDocumented protocol supplies the description when the constructor does not', () => {
  class DocumentedValue {
    description = 'From the value protocol'

    toString(): string {
      return '    Active'
    }
  }

  const definition = new CsDefinition({
    context,
    identifier: createEnum('Status'),
    value: new DocumentedValue()
  })

  assertEquals(
    definition.toString(),
    '/// <summary>\n/// From the value protocol\n/// </summary>\npublic enum Status\n{\n    Active\n}'
  )
})

Deno.test('a foreign-language kind throws (no silent fallback)', () => {
  const definition = new CsDefinition({
    context,
    identifier: new Identifier({ name: 'User', kind: 'data-class' }),
    value: new CsPropertyList([])
  })

  assertThrows(() => definition.toString(), Error, 'Unknown C# entity kind: data-class')
})
