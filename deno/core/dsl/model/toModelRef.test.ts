import { assertEquals } from '@std/assert'
import { assertSpyCalls, spy } from '@std/testing/mock'
import { toModelRef } from './ModelDriver.ts'
import type { ModelProjection } from './types.ts'
import type { GenerateContextType } from '../../context/generateTypes.ts'
import type { ContentSettings } from '@/dsl/ContentSettings.ts'
import type { GeneratedValue } from '../GeneratedValue.ts'
import type { GeneratorKey } from '../GeneratorKeys.ts'
import type { RefName } from '@/types/RefName.ts'
import type { Lang } from '@/dsl/Lang.ts'
import { createType, typescript } from '@skmtc/lang-typescript'

class MockProjection implements GeneratedValue {
  static id = 'mock-generator'
  static isSupported = () => true
  static lang: Lang = typescript
  static constructed = 0
  generatedType = 'value' as const
  type = 'mockValue' as const
  generatorKey?: GeneratorKey

  constructor(_args: { refName: RefName; settings: ContentSettings<undefined> }) {
    MockProjection.constructed++
  }
}

const projection = MockProjection as unknown as ModelProjection<MockProjection, undefined>

type RegisterArgs = { destinationPath: string; imports?: { module: string }[] }

/** A context whose models each live in `@/types/<refName>.ts`, with spies on the calls the tests read. */
const createMockContext = () => {
  const modelDepth: Record<string, number> = {}
  const register = spy((_args: RegisterArgs) => {})
  const findDefinition = spy(() => undefined)
  const context = {
    modelDepth,
    toModelContentSettings: ({ refName, variant }: { refName: RefName; variant: string }) => ({
      identifier: createType(refName),
      exportPath: `@/types/${refName}.ts`,
      enrichments: undefined,
      variant
    }),
    findDefinition,
    register,
    getFile: () => undefined,
    addFile: () => {},
    stackTrail: { slice: () => ({ stackTrail: [] }) }
  } as unknown as GenerateContextType

  return { context, register, findDefinition }
}

Deno.test('toModelRef', async t => {
  await t.step('a back-reference across files imports the model and builds nothing', () => {
    const { context, register, findDefinition } = createMockContext()
    // `Group` is being built further up the walk; `Condition`, in its own
    // file, refers back to it. Before toModelRef the ref snippets skipped
    // the Driver here, and with it the import: `Cannot find name 'group'`.
    context.modelDepth[`${MockProjection.id}:Group`] = 1
    MockProjection.constructed = 0

    const ref = toModelRef({
      context,
      projection,
      refName: 'Group' as RefName,
      destinationPath: '@/types/Condition.ts'
    })

    assertEquals(ref.suspended, true)
    assertEquals(ref.settings.identifier.name, 'Group')
    // The import of `Group` lands in Condition's file.
    assertSpyCalls(register, 1)
    const [registered] = register.calls[0].args
    assertEquals(registered.destinationPath, '@/types/Condition.ts')
    assertEquals(registered.imports?.map(({ module }) => module), ['@/types/Group.ts'])
    // The depth goes to 2: Group's projection reads `> 1` as "recursive".
    assertEquals(context.modelDepth[`${MockProjection.id}:Group`], 2)
    // Nothing was built or looked up: building Group again would never end.
    assertEquals(MockProjection.constructed, 0)
    assertSpyCalls(findDefinition, 0)
  })

  await t.step('a back-reference in the model\'s own file registers no import', () => {
    const { context, register } = createMockContext()
    context.modelDepth[`${MockProjection.id}:Node`] = 1

    const ref = toModelRef({
      context,
      projection,
      refName: 'Node' as RefName,
      destinationPath: '@/types/Node.ts'
    })

    assertEquals(ref.suspended, true)
    assertSpyCalls(register, 0)
  })

  await t.step('a model that is not being built goes through the Driver', () => {
    const { context } = createMockContext()
    MockProjection.constructed = 0

    const ref = toModelRef({
      context,
      projection,
      refName: 'Address' as RefName,
      destinationPath: '@/types/User.ts'
    })

    assertEquals(ref.suspended, false)
    assertEquals(MockProjection.constructed, 1)
    // The Driver brackets the build: Address is closed again afterwards.
    assertEquals(context.modelDepth[`${MockProjection.id}:Address`], 0)
  })
})
