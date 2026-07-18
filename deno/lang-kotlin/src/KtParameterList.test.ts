import { assertEquals } from '@std/assert'
import type { GenerateContextType } from '@skmtc/core/generate'
import { KtParameterList } from './KtParameterList.ts'
import { KtAnnotation } from './KtAnnotation.ts'

// Construction only stores `context`; annotations here carry no
// packageName, so nothing registers (test-only cast).
const context = {} as unknown as GenerateContextType
const destinationPath = '@/test/Test.generated.kt'

Deno.test('parameters render nullability, defaults, and own-line annotations', () => {
  const parameters = new KtParameterList([
    {
      name: 'userId',
      type: 'String',
      annotations: [new KtAnnotation({ context, destinationPath, name: 'SerialName', args: ['"user_id"'] })]
    },
    { name: 'name', type: 'String' },
    { name: 'email', type: 'String', nullable: true, defaultValue: 'null' }
  ])

  assertEquals(
    parameters.toString(),
    '(\n' +
      '    @SerialName("user_id")\n' +
      '    val userId: String,\n' +
      '    val name: String,\n' +
      '    val email: String? = null\n' +
      ')'
  )
})

Deno.test('parameters render visibility after annotations (Kotlin modifier order)', () => {
  const parameters = new KtParameterList([
    { name: 'service', type: 'UsersService', visibility: 'private' },
    {
      name: 'tagged',
      type: 'String',
      visibility: 'internal',
      annotations: [new KtAnnotation({ context, destinationPath, name: 'SerialName', args: ['"t"'] })]
    }
  ])

  assertEquals(
    parameters.toString(),
    '(\n' +
      '    private val service: UsersService,\n' +
      '    @SerialName("t")\n' +
      '    internal val tagged: String\n' +
      ')'
  )
})

Deno.test('no trailing comma after the last parameter (formatter territory)', () => {
  const parameters = new KtParameterList([{ name: 'id', type: 'String' }])

  assertEquals(parameters.toString(), '(\n    val id: String\n)')
})

Deno.test('KtAnnotation renders bare and with args', () => {
  assertEquals(new KtAnnotation({ context, destinationPath, name: 'Serializable' }).toString(), '@Serializable')
  assertEquals(new KtAnnotation({ context, destinationPath, name: 'SerialName', args: ['"user_id"'] }).toString(), '@SerialName("user_id")')
})
