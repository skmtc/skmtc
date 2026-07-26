import { assertEquals, assertStringIncludes } from '@std/assert'
import { lint, messagesFrom } from '../test/lint.ts'

const RULE = 'single-dispatch'

Deno.test('single-dispatch: silent on the router switch', () => {
  const source = `export const toKtValue = (args: TypeSystemArgs<SchemaType>): TypeSystemValue => {
      const { schema, destinationPath, required, context } = args
      switch (schema.type) {
        case 'string':
          return new StringValue({ context, stringSchema: schema, destinationPath })
        case 'object':
          return new DataClassValue({ context, objectSchema: schema, destinationPath })
        default:
          throw new Error(\`toKtValue: schema type '\${schema.type}' is not mapped yet\`)
      }
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('single-dispatch: silent on a router recognised by its SchemaToValueFn annotation', () => {
  const source = `const dispatch: SchemaToValueFn = args => {
      if (args.schema.type === 'union') return new UnionValue(args)
      return new UnknownValue(args)
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('single-dispatch: silent inside the metadata policies', () => {
  const source = `export const KtModelBase = toKtModelProjectionBase({
      id: denoJson.name,
      toIdentifierType: (refName, context): KtIdentifierType => {
        const schema = context.resolveSchemaRefOnce(refName, denoJson.name).resolve()
        return { type: schema.type === 'object' ? 'data-class' : 'typealias' }
      },
      isSupported: ({ schema }) => schema.type !== 'unknown'
    })`
  assertEquals(lint(RULE, source), [])
})

Deno.test('single-dispatch: flags a switch in a producer constructor', () => {
  const messages = messagesFrom(
    RULE,
    `class KtType extends KtSnippet {
       constructor({ schema }: Args) {
         super({})
         switch (schema.type) {
           case 'string':
             this.rendered = 'String'
             break
           case 'integer':
             this.rendered = 'Int'
             break
         }
       }
     }`
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', 'switch (schema.type) outside the router')
})

Deno.test('single-dispatch: flags a comparison in a dispatching helper', () => {
  const messages = messagesFrom(
    RULE,
    `const toTypeName = (schema: OasSchema): string =>
       schema.type === 'array' ? 'List' : 'Any'`
  )
  assertEquals(messages.length, 1)
  assertStringIncludes(messages[0] ?? '', "schema.type === 'array' outside the router")
})

Deno.test('single-dispatch: flags a comparison in a producer toString', () => {
  const source = `class Value extends TsSnippet {
      override toString(): string {
        if (this.schema.type !== 'object') return 'unknown'
        return 'object'
      }
    }`
  assertEquals(lint(RULE, source).length, 1)
})

Deno.test('single-dispatch: flags optional-chained dispatch', () => {
  const source = `const toShape = (body: OasSchema | undefined): string => {
      if (body?.type !== 'object') return 'unknown'
      return 'object'
    }`
  assertEquals(lint(RULE, source).length, 1)
})

Deno.test('single-dispatch: silent on .type checks that are not schema dispatch', () => {
  const source = `const visit = (node: Node): string => {
      switch (node.type) {
        case 'Program':
          return 'program'
        case 'Identifier':
          return 'identifier'
      }
      if (identifier.type === 'data-class') return 'kotlin'
      if (manifest.type === 'artifact') return 'artifact'
      return ''
    }`
  assertEquals(lint(RULE, source), [])
})

Deno.test('single-dispatch: silent in test files', () => {
  const source = `const toTypeName = (schema: OasSchema): string =>
      schema.type === 'array' ? 'List' : 'Any'`
  assertEquals(lint(RULE, source, '/gen-thing/src/Value.test.ts'), [])
})
