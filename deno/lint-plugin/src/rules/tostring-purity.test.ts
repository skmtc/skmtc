import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'tostring-purity'

Deno.test('tostring-purity: flags construction inside toString', () => {
  const messages = messagesFrom(
    RULE,
    `class DataClassValue extends KtSnippet {
       override toString(): string {
         return \`\${new KtParameterList(this.parameters)}\`
       }
     }`
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'new KtParameterList(…) inside toString()')
})

Deno.test('tostring-purity: flags construction inside an arrow nested in toString', () => {
  const messages = messagesFrom(
    RULE,
    `class Value extends TsSnippet {
       override toString(): string {
         return this.items.map(item => new ItemSnippet(item)).join(', ')
       }
     }`
  )
  assertEquals(messages.length, 1)
})

Deno.test('tostring-purity: flags every register-family call inside toString', () => {
  const source = `class Value extends TsSnippet {
      override toString(): string {
        this.register({ imports: {} })
        this.registerInto('a.ts', { imports: {} })
        this.context.insertModel(Peer, 'Thing')
        this.context.insertOperation(Peer, op)
        this.context.insertNormalizedModel(Peer, 'Thing')
        defineAndRegister({ context: this.context })
        return ''
      }
    }`
  assertEquals(lint(RULE, source).length, 6)
})

Deno.test('tostring-purity: flags this-rooted mutation and assignment inside toString', () => {
  const source = `class Value extends TsSnippet {
      override toString(): string {
        this.rendered = true
        this.cache ??= 'x'
        this.lines.push('a')
        this.seen.add('b')
        this.byName.set('c', 1)
        return ''
      }
    }`
  const messages = messagesFrom(RULE, source)
  assertEquals(messages.length, 5)
  assertStringIncludes(messages.join('\n'), 'this.rendered = … inside toString()')
  assertStringIncludes(messages.join('\n'), 'this.cache ??= … inside toString()')
  assertStringIncludes(messages.join('\n'), 'this.lines.push(…) inside toString()')
})

Deno.test('tostring-purity: flags a register reached through a same-class method', () => {
  const messages = messagesFrom(
    RULE,
    `class Value extends TsSnippet {
       wireImports() {
         this.register({ imports: { './x.ts': ['X'] } })
       }
       override toString(): string {
         this.wireImports()
         return 'x'
       }
     }`
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'wireImports(…) registers, and is called from toString()')
})

Deno.test('tostring-purity: flags a register reached through a module-level helper', () => {
  const messages = messagesFrom(
    RULE,
    `const wire = (context: GenerateContextType) => {
       context.insertModel(Peer, 'Thing')
     }
     class Value extends TsSnippet {
       override toString(): string {
         wire(this.context)
         return 'x'
       }
     }`
  )
  assertEquals(messages.length, 1)
})

Deno.test('tostring-purity: silent on a pure toString reading settled state', () => {
  const source = `class DataClassValue extends KtSnippet {
      parameterList: KtParameterList

      constructor({ context, objectSchema, destinationPath, modifiers }: Args) {
        super({ context })
        this.parameters = Object.entries(objectSchema.properties ?? {}).map(([wireName, property]) => ({
          wireName,
          type: toKtValue({ context, schema: property, destinationPath, required: true })
        }))
        this.parameterList = new KtParameterList(this.parameters)
        this.context.insertModel(Peer, 'Thing')
        if (objectSchema.additionalProperties) {
          throw new Error('DataClassValue: additionalProperties is not mapped yet')
        }
      }

      override toString(): string {
        return \`\${this.parameterList}\`
      }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('tostring-purity: silent on mutation of a local, and on a same-name call to another object', () => {
  const source = `class Value extends TsSnippet {
      wireImports() {
        this.register({ imports: {} })
      }
      override toString(): string {
        const lines: string[] = []
        lines.push('a')
        this.child.wireImports()
        return lines.join('\\n')
      }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('tostring-purity: silent in test files', () => {
  const source = `class Value extends TsSnippet {
      override toString(): string {
        return \`\${new Thing()}\`
      }
    }`
  assertEquals(lint(RULE, source, '/gen-thing/src/Value.test.ts'), [])
})
