import { assertEquals } from '@std/assert'
import { KtParameterList } from './KtParameterList.ts'
import { KtAnnotation } from './KtAnnotation.ts'

Deno.test('parameters render nullability, defaults, and inline annotations', () => {
  const parameters = new KtParameterList([
    {
      name: 'userId',
      type: 'String',
      annotations: [new KtAnnotation('SerialName', ['"user_id"'])]
    },
    { name: 'name', type: 'String' },
    { name: 'email', type: 'String', nullable: true, defaultValue: 'null' }
  ])

  assertEquals(
    parameters.toString(),
    '    @SerialName("user_id") val userId: String,\n' +
      '    val name: String,\n' +
      '    val email: String? = null'
  )
})

Deno.test('parameters render visibility after annotations (Kotlin modifier order)', () => {
  const parameters = new KtParameterList([
    { name: 'service', type: 'UsersService', visibility: 'private' },
    {
      name: 'tagged',
      type: 'String',
      visibility: 'internal',
      annotations: [new KtAnnotation('SerialName', ['"t"'])]
    }
  ])

  assertEquals(
    parameters.toString(),
    '    private val service: UsersService,\n' +
      '    @SerialName("t") internal val tagged: String'
  )
})

Deno.test('no trailing comma after the last parameter (formatter territory)', () => {
  const parameters = new KtParameterList([{ name: 'id', type: 'String' }])

  assertEquals(parameters.toString(), '    val id: String')
})

Deno.test('KtAnnotation renders bare and with args', () => {
  assertEquals(new KtAnnotation('Serializable').toString(), '@Serializable')
  assertEquals(
    new KtAnnotation('SerialName', ['"user_id"']).toString(),
    '@SerialName("user_id")'
  )
})
