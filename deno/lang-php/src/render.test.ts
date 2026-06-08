import { assertEquals } from '@std/assert'
import { Identifier } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core/generate'
import { PhpDefinition } from './PhpDefinition.ts'
import { PhpClass } from './PhpClass.ts'
import { PhpFile } from './PhpFile.ts'

// Construction only stores `context`; `toString()` never reads it (test-only cast).
const context = {} as unknown as GenerateContextType

Deno.test('PhpDefinition + PhpClass render the User DTO as a class container', () => {
  const definition = new PhpDefinition({
    context,
    identifier: Identifier.createType('User', { kind: 'class' }),
    value: new PhpClass([
      { name: 'id', type: 'string' },
      { name: 'name', type: 'string' },
      { name: 'email', type: 'string', nullable: true }
    ])
  })

  assertEquals(
    definition.toString(),
    'class User\n' +
      '{\n' +
      '    public function __construct(\n' +
      '        public string $id,\n' +
      '        public string $name,\n' +
      '        public ?string $email,\n' +
      '    ) {}\n' +
      '}'
  )
})

Deno.test('PhpClass renders private members for unexported properties', () => {
  const value = new PhpClass([
    { name: 'id', type: 'string' },
    { name: 'secret', type: 'string', exported: false }
  ])

  assertEquals(
    value.toString(),
    '    public function __construct(\n' +
      '        public string $id,\n' +
      '        private string $secret,\n' +
      '    ) {}'
  )
})

Deno.test('declaration keyword follows opaque Identifier.kind', () => {
  // Same value, different `kind` → different container keyword. PHP is a
  // second consumer of the opaque discriminant (after Rust).
  const asInterface = new PhpDefinition({
    context,
    identifier: Identifier.createType('Named', { kind: 'interface' }),
    value: new PhpClass([{ name: 'id', type: 'string' }])
  })
  const asClass = new PhpDefinition({
    context,
    identifier: Identifier.createType('Named', { kind: 'class' }),
    value: new PhpClass([{ name: 'id', type: 'string' }])
  })

  assertEquals(asInterface.toString().startsWith('interface Named\n{'), true)
  assertEquals(asClass.toString().startsWith('class Named\n{'), true)
})

Deno.test('exported is ignored at the class level (no file-private class in PHP)', () => {
  // Unlike TS (`export`), Go (casing), and Rust (`pub`), PHP has no
  // top-level visibility keyword on a class — `exported` is a no-op here.
  const exported = new PhpDefinition({
    context,
    identifier: Identifier.createType('A', { exported: true, kind: 'class' }),
    value: new PhpClass([{ name: 'id', type: 'string' }])
  })
  const unexported = new PhpDefinition({
    context,
    identifier: Identifier.createType('A', { exported: false, kind: 'class' }),
    value: new PhpClass([{ name: 'id', type: 'string' }])
  })

  assertEquals(exported.toString(), unexported.toString())
  assertEquals(exported.toString().startsWith('class A\n{'), true)
})

Deno.test('PhpFile renders the <?php + namespace header', () => {
  const file = new PhpFile({ path: 'Models/User.php', namespace: 'App\\Models' })
  file.definitions.set(
    'User',
    new PhpDefinition({
      context,
      identifier: Identifier.createType('User', { kind: 'class' }),
      value: new PhpClass([{ name: 'id', type: 'string' }])
    })
  )

  assertEquals(
    file.toString(),
    '<?php\n\nnamespace App\\Models;\n\nclass User\n{\n' +
      '    public function __construct(\n' +
      '        public string $id,\n' +
      '    ) {}\n}'
  )
})
