import { assertEquals } from '@std/assert'
import { CsAttribute } from './CsAttribute.ts'
import { CsMethodSignature } from './CsMethodSignature.ts'

Deno.test('abstract interface-member form: no modifiers, semicolon, defaults', () => {
  const signature = new CsMethodSignature({
    name: 'GetUsers',
    parameters: [{ name: 'limit', type: 'int?', defaultValue: 'null' }],
    returnType: 'Task<IReadOnlyList<User>>'
  })

  assertEquals(signature.toString(), '    Task<IReadOnlyList<User>> GetUsers(int? limit = null);')
})

Deno.test('XML-doc summary renders above the attributes, indented and escaped', () => {
  const signature = new CsMethodSignature({
    name: 'GetUser',
    parameters: [],
    returnType: 'Task<User>',
    description: 'Fetch a <User> & friends'
  })

  assertEquals(
    signature.toString(),
    '    /// <summary>\n' +
      '    /// Fetch a &lt;User&gt; &amp; friends\n' +
      '    /// </summary>\n' +
      '    Task<User> GetUser();'
  )
})

Deno.test('the delegating controller form: attributes, modifiers, inline parameter attributes, expression body', () => {
  const signature = new CsMethodSignature({
    name: 'PostUsers',
    parameters: [
      {
        name: 'body',
        type: 'UserCreate',
        attributes: [new CsAttribute('FromBody')]
      }
    ],
    returnType: 'Task<ActionResult<User>>',
    attributes: [
      new CsAttribute('HttpPost', ['"/users"']),
      new CsAttribute('ProducesResponseType', ['201'])
    ],
    modifiers: 'public async',
    expressionBody: 'StatusCode(201, await service.PostUsers(body))'
  })

  assertEquals(
    signature.toString(),
    '    [HttpPost("/users")]\n' +
      '    [ProducesResponseType(201)]\n' +
      '    public async Task<ActionResult<User>> PostUsers([FromBody] UserCreate body) => StatusCode(201, await service.PostUsers(body));'
  )
})

Deno.test('absent returnType renders void (no Kotlin implicit Unit)', () => {
  const signature = new CsMethodSignature({ name: 'Reset', parameters: [] })

  assertEquals(signature.toString(), '    void Reset();')
})
