import { assertStringIncludes } from '@std/assert/string-includes'
import { toServer } from './to-server.ts'

Deno.test('toMod - generates server code with single generator', () => {
  const generatorIds = ['@skmtc/shadcn-ui']
  const result = toServer(generatorIds)

  assertStringIncludes(result, "import { createServer } from 'jsr:@skmtc/server'")
  assertStringIncludes(result, "import skmtcShadcnUi from '@skmtc/shadcn-ui'")
  assertStringIncludes(result, 'skmtcShadcnUi')
  assertStringIncludes(result, 'toGeneratorConfigMap')
})

Deno.test('toMod - generates server code with multiple generators', () => {
  const generatorIds = ['@skmtc/shadcn-ui', '@skmtc/msw', '@skmtc/tanstack-query']
  const result = toServer(generatorIds)

  assertStringIncludes(result, "import skmtcShadcnUi from '@skmtc/shadcn-ui'")
  assertStringIncludes(result, "import skmtcMsw from '@skmtc/msw'")
  assertStringIncludes(result, "import skmtcTanstackQuery from '@skmtc/tanstack-query'")
  assertStringIncludes(result, 'skmtcShadcnUi')
  assertStringIncludes(result, 'skmtcMsw')
  assertStringIncludes(result, 'skmtcTanstackQuery')
})

Deno.test('toMod - handles generator IDs with hyphens correctly', () => {
  const generatorIds = ['@skmtc/my-custom-generator']
  const result = toServer(generatorIds)

  // camelCase conversion should change @skmtc/my-custom-generator to skmtcMyCustomGenerator
  assertStringIncludes(result, "import skmtcMyCustomGenerator from '@skmtc/my-custom-generator'")
  assertStringIncludes(result, 'skmtcMyCustomGenerator')
})

Deno.test('toMod - generates empty generators array when no generators provided', () => {
  const generatorIds: string[] = []
  const result = toServer(generatorIds)

  assertStringIncludes(result, "import { createServer } from 'jsr:@skmtc/server'")
  assertStringIncludes(
    result,
    'toGeneratorConfigMap: () => Object.fromEntries([].map(g => [g.id, g]))'
  )
  assertStringIncludes(result, 'logsPath: undefined')
})

Deno.test('toMod - generates correct Object.fromEntries mapping structure', () => {
  const generatorIds = ['@skmtc/zod']
  const result = toServer(generatorIds)

  assertStringIncludes(result, 'Object.fromEntries([skmtcZod].map(g => [g.id, g]))')
})

Deno.test('toMod - handles scoped packages correctly', () => {
  const generatorIds = ['@company/my-generator', '@other/another-gen']
  const result = toServer(generatorIds)

  assertStringIncludes(result, "import companyMyGenerator from '@company/my-generator'")
  assertStringIncludes(result, "import otherAnotherGen from '@other/another-gen'")
  assertStringIncludes(result, 'companyMyGenerator')
  assertStringIncludes(result, 'otherAnotherGen')
})

Deno.test('toMod - includes logsPath: undefined in server config', () => {
  const generatorIds = ['@skmtc/test']
  const result = toServer(generatorIds)

  assertStringIncludes(result, 'logsPath: undefined')
})

Deno.test('toMod - exports default from createServer', () => {
  const generatorIds = ['@skmtc/generator']
  const result = toServer(generatorIds)

  assertStringIncludes(result, 'export default createServer')
})
