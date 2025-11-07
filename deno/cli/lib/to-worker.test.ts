import { assertStringIncludes } from '@std/assert/string-includes'
import { toWorker } from './to-worker.ts'

Deno.test('toMod - generates server code with single generator', () => {
  const generatorIds = ['@skmtc/shadcn-ui']
  const result = toWorker(generatorIds)

  assertStringIncludes(result, "import toWorker from 'jsr:@skmtc/worker'")
  assertStringIncludes(result, "import skmtcShadcnUi from '@skmtc/shadcn-ui'")
  assertStringIncludes(result, 'skmtcShadcnUi')
  assertStringIncludes(result, '() => Object.fromEntries([skmtcShadcnUi].map(g => [g.id, g]))')
})

Deno.test('toMod - generates server code with multiple generators', () => {
  const generatorIds = ['@skmtc/shadcn-ui', '@skmtc/msw', '@skmtc/tanstack-query']
  const result = toWorker(generatorIds)

  console.log(result)

  assertStringIncludes(result, "import toWorker from 'jsr:@skmtc/worker'")
  assertStringIncludes(result, "import skmtcShadcnUi from '@skmtc/shadcn-ui'")
  assertStringIncludes(result, "import skmtcMsw from '@skmtc/msw'")
  assertStringIncludes(result, "import skmtcTanstackQuery from '@skmtc/tanstack-query'")
  assertStringIncludes(
    result,
    `() => Object.fromEntries([skmtcShadcnUi,
skmtcMsw,
skmtcTanstackQuery].map(g => [g.id, g]))`
  )
})

Deno.test('toMod - handles generator IDs with hyphens correctly', () => {
  const generatorIds = ['@skmtc/my-custom-generator']
  const result = toWorker(generatorIds)

  assertStringIncludes(result, "import toWorker from 'jsr:@skmtc/worker'")
  // camelCase conversion should change @skmtc/my-custom-generator to skmtcMyCustomGenerator
  assertStringIncludes(result, "import skmtcMyCustomGenerator from '@skmtc/my-custom-generator'")
  assertStringIncludes(
    result,
    '() => Object.fromEntries([skmtcMyCustomGenerator].map(g => [g.id, g]))'
  )
})

Deno.test('toMod - generates empty generators array when no generators provided', () => {
  const generatorIds: string[] = []
  const result = toWorker(generatorIds)

  assertStringIncludes(result, "import toWorker from 'jsr:@skmtc/worker'")
  assertStringIncludes(result, '() => Object.fromEntries([].map(g => [g.id, g]))')
})

Deno.test('toMod - generates correct Object.fromEntries mapping structure', () => {
  const generatorIds = ['@skmtc/zod']
  const result = toWorker(generatorIds)

  assertStringIncludes(result, 'Object.fromEntries([skmtcZod].map(g => [g.id, g]))')
})

Deno.test('toMod - handles scoped packages correctly', () => {
  const generatorIds = ['@company/my-generator', '@other/another-gen']
  const result = toWorker(generatorIds)

  assertStringIncludes(result, "import companyMyGenerator from '@company/my-generator'")
  assertStringIncludes(result, "import otherAnotherGen from '@other/another-gen'")
  assertStringIncludes(result, 'companyMyGenerator')
  assertStringIncludes(result, 'otherAnotherGen')
})

// Deno.test('toMod - includes logsPath: undefined in worker config', () => {
//   const generatorIds = ['@skmtc/test']
//   const result = toWorker(generatorIds)

//   assertStringIncludes(result, 'logsPath: undefined')
// })

Deno.test('toMod - exports default from toWorker', () => {
  const generatorIds = ['@skmtc/generator']
  const result = toWorker(generatorIds)

  assertStringIncludes(result, 'export default toWorker')
})
