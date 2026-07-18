import { assertEquals } from '@std/assert'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtFunctionParameter, KtFunctionSignature } from './KtFunctionSignature.ts'
import { KtAnnotation } from './KtAnnotation.ts'

// Construction only stores `context`; annotations here carry no
// packageName, so nothing registers (test-only cast).
const context = {} as unknown as GenerateContextType
const destinationPath = '@/test/Test.generated.kt'

Deno.test('parameter renders name and type', () => {
  const parameter = new KtFunctionParameter({ name: 'id', type: 'String' })

  assertEquals(parameter.toString(), 'id: String')
})

Deno.test('parameter renders nullable types and inline annotations', () => {
  const nullable = new KtFunctionParameter({ name: 'verbose', type: 'Boolean', nullable: true })
  const annotated = new KtFunctionParameter({
    name: 'id',
    type: 'String',
    annotations: [new KtAnnotation({ context, destinationPath, name: 'PathVariable', args: ['"id"'] })]
  })

  assertEquals(nullable.toString(), 'verbose: Boolean?')
  assertEquals(annotated.toString(), '@PathVariable("id") id: String')
})

Deno.test('signature renders the abstract-method form with no parameters', () => {
  const signature = new KtFunctionSignature({
    name: 'listUsers',
    parameters: [],
    returnType: 'List<User>'
  })

  assertEquals(signature.toString(), '    fun listUsers(): List<User>')
})

Deno.test('signature omits the return type (implicit Unit)', () => {
  const signature = new KtFunctionSignature({
    name: 'deleteUsersId',
    parameters: [{ name: 'id', type: 'String' }]
  })

  assertEquals(signature.toString(), '    fun deleteUsersId(id: String)')
})

Deno.test('signature renders the worked Spring example', () => {
  const signature = new KtFunctionSignature({
    name: 'getUsersId',
    parameters: [
      { name: 'id', type: 'String', annotations: [new KtAnnotation({ context, destinationPath, name: 'PathVariable', args: ['"id"'] })] },
      {
        name: 'verbose',
        type: 'Boolean',
        nullable: true,
        annotations: [new KtAnnotation({ context, destinationPath, name: 'RequestParam', args: ['"verbose"'] })]
      }
    ],
    returnType: 'User',
    annotations: [new KtAnnotation({ context, destinationPath, name: 'GetMapping', args: ['"/users/{id}"'] })]
  })

  assertEquals(
    signature.toString(),
    '    @GetMapping("/users/{id}")\n' +
      '    fun getUsersId(@PathVariable("id") id: String, @RequestParam("verbose") verbose: Boolean?): User'
  )
})

Deno.test('signature renders an expression body, with and without a return type', () => {
  const delegating = new KtFunctionSignature({
    name: 'getUsersId',
    parameters: [{ name: 'id', type: 'String' }],
    returnType: 'User',
    body: 'service.getUsersId(id)'
  })
  const unitDelegating = new KtFunctionSignature({
    name: 'deleteUsersId',
    parameters: [{ name: 'id', type: 'String' }],
    body: 'service.deleteUsersId(id)'
  })

  assertEquals(
    delegating.toString(),
    '    fun getUsersId(id: String): User = service.getUsersId(id)'
  )
  assertEquals(
    unitDelegating.toString(),
    '    fun deleteUsersId(id: String) = service.deleteUsersId(id)'
  )
})

Deno.test('signature renders multiple above-annotations one per line', () => {
  const signature = new KtFunctionSignature({
    name: 'postUsers',
    parameters: [
      { name: 'body', type: 'CreateUserBody', annotations: [new KtAnnotation({ context, destinationPath, name: 'RequestBody' })] }
    ],
    returnType: 'User',
    annotations: [
      new KtAnnotation({ context, destinationPath, name: 'PostMapping', args: ['"/users"'] }),
      new KtAnnotation({ context, destinationPath, name: 'Deprecated', args: ['"use v2"'] })
    ]
  })

  assertEquals(
    signature.toString(),
    '    @PostMapping("/users")\n' +
      '    @Deprecated("use v2")\n' +
      '    fun postUsers(@RequestBody body: CreateUserBody): User'
  )
})

Deno.test('signature renders KDoc above annotations; parameters render defaults', () => {
  const signature = new KtFunctionSignature({
    name: 'getCreditNotes',
    parameters: [{ name: 'limit', type: 'Int', nullable: true, defaultValue: 'null' }],
    returnType: 'CreditNotePage',
    description: 'List all Credit Notes.',
    annotations: [new KtAnnotation({ context, destinationPath, name: 'GetMapping', args: ['"/credit-notes"'] })]
  })

  assertEquals(
    signature.toString(),
    '    /** List all Credit Notes. */\n' +
      '    @GetMapping("/credit-notes")\n' +
      '    fun getCreditNotes(limit: Int? = null): CreditNotePage'
  )
})
