import { assertEquals, assertThrows } from '@std/assert'
import type { GenerateContextType } from '@skmtc/core/generate'
import { IdentifierBase } from '@skmtc/core'
import { CsAttribute } from './CsAttribute.ts'
import { CsDefinition } from './CsDefinition.ts'
import { CsPropertyList } from './CsPropertyList.ts'
import {
  createAbstractRecord,
  createClass,
  createEnum,
  createInterface,
  createRecord
} from './createIdentifier.ts'

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

  assertEquals(definition.toString(), 'public enum Status\n{\n    Active,\n\n    Archived\n}')
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
    attributes = [new CsAttribute('JsonConverter', ['typeof(JsonStringEnumConverter)'])]

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
    '[JsonConverter(typeof(JsonStringEnumConverter))]\n' + 'public enum Status\n{\n    Active\n}'
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

Deno.test('the CsBased clause renders between the name and the body (record family)', () => {
  class BasedValue {
    baseTypes = ['Animal']
    properties: CsPropertyList

    constructor(properties: CsPropertyList) {
      this.properties = properties
    }

    toString(): string {
      return `${this.properties}`
    }
  }

  const withBody = new CsDefinition({
    context,
    identifier: createRecord('Dog'),
    value: new BasedValue(new CsPropertyList([{ name: 'Name', type: 'string', required: true }]))
  })

  assertEquals(
    withBody.toString(),
    'public sealed partial record Dog : Animal\n' +
      '{\n' +
      '    public required string Name { get; init; }\n' +
      '}'
  )

  // Empty-after-omission member: the clause precedes the semicolon.
  const bodyless = new CsDefinition({
    context,
    identifier: createRecord('Ghost'),
    value: new BasedValue(new CsPropertyList([]))
  })

  assertEquals(bodyless.toString(), 'public sealed partial record Ghost : Animal;')
})

Deno.test('the abstract-record parent renders bodyless with parent-side attributes', () => {
  class PolymorphicParentValue {
    attributes = [
      new CsAttribute('JsonPolymorphic', ['TypeDiscriminatorPropertyName = "petType"']),
      new CsAttribute('JsonDerivedType', ['typeof(Dog)', '"dog"']),
      new CsAttribute('JsonDerivedType', ['typeof(Cat)', '"cat"'])
    ]

    toString(): string {
      return ''
    }
  }

  const definition = new CsDefinition({
    context,
    identifier: createAbstractRecord('Animal'),
    value: new PolymorphicParentValue()
  })

  assertEquals(
    definition.toString(),
    '[JsonPolymorphic(TypeDiscriminatorPropertyName = "petType")]\n' +
      '[JsonDerivedType(typeof(Dog), "dog")]\n' +
      '[JsonDerivedType(typeof(Cat), "cat")]\n' +
      'public abstract partial record Animal;'
  )
})

Deno.test('a foreign identifier throws (no silent fallback)', () => {
  // A neutral IdentifierBase built for another language — the engine holds
  // identifiers as IdentifierBase, so CsDefinition narrows to CsIdentifier
  // and refuses anything else (cast-free, via isCsIdentifier).
  const definition = new CsDefinition({
    context,
    identifier: new IdentifierBase({ name: 'User' }),
    value: new CsPropertyList([])
  })

  assertThrows(
    () => definition.toString(),
    Error,
    "CsDefinition needs a CsIdentifier to render 'User', got a foreign identifier"
  )
})

Deno.test('the class shell composes the primary constructor (CsConstructed) with the base clause', () => {
  class ControllerValue {
    attributes = [new CsAttribute('ApiController')]
    constructorParameters = 'IUsersService service'
    baseTypes = ['ControllerBase']

    toString(): string {
      return '    public void X();'
    }
  }

  const definition = new CsDefinition({
    context,
    identifier: createClass('UsersController'),
    value: new ControllerValue()
  })

  assertEquals(
    definition.toString(),
    '[ApiController]\n' +
      'public sealed partial class UsersController(IUsersService service) : ControllerBase\n' +
      '{\n' +
      '    public void X();\n' +
      '}'
  )
})

Deno.test('the interface shell renders body and bodyless forms', () => {
  const withBody = new CsDefinition({
    context,
    identifier: createInterface('IUsersService'),
    value: '    Task<User> GetUser();'
  })

  assertEquals(
    withBody.toString(),
    'public interface IUsersService\n{\n    Task<User> GetUser();\n}'
  )

  const bodyless = new CsDefinition({
    context,
    identifier: createInterface('IMarker'),
    value: ''
  })

  assertEquals(bodyless.toString(), 'public interface IMarker;')
})
