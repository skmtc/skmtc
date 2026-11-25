import { assertEquals } from '@std/assert'
import { toParameterVariable } from '@/src/toParameterVariable.ts'
import { handleKey } from '@/src/identifiers.ts'

const variables = {
  id: 'id',
  user_id: 'user_id',
  $top: '$top',
  export: 'exportValue',
  class: 'classValue',
  await: 'awaitValue',
  arguments: 'argumentsValue',
  'enterprise-team': 'enterpriseTeam',
  'actor.ip': 'actorIp',
  '2fa': '_2fa'
}

Object.entries(variables).forEach(([name, variable]) => {
  Deno.test(`toParameterVariable - ${name} gives ${variable}`, () => {
    assertEquals(toParameterVariable(name), variable)
  })

  Deno.test(`toParameterVariable - the key of ${name} gives the same variable`, () => {
    assertEquals(toParameterVariable(handleKey(name)), variable)
  })
})
