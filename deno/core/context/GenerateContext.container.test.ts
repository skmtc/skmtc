/**
 * A declaration as an insertion target.
 *
 * Files were the only place definitions could be inserted into, which forced
 * every generator grouping its output into a declaration — a Kotlin
 * interface, a C# class — to invent an accumulating `add` method on the
 * value. These tests cover the alternative: a definition whose value holds
 * members is a place, addressed with the same `findDefinition` / `register`
 * pair a file is, with the order independence that gives.
 */
import { assertEquals, assertThrows } from '@std/assert'
import type * as log from '@std/log'
import { GenerateContext } from '@/context/GenerateContext.ts'
import { CodeFileBase, matchDefinitions } from '@/dsl/CodeFileBase.ts'
import type { FindDefinitionsQuery } from '@/dsl/CodeFileBase.ts'
import { DefinitionBase } from '@/dsl/Definition.ts'
import { isDefinitionContainer } from '@/dsl/DefinitionContainer.ts'
import type { ImportBase } from '@/dsl/ImportBase.ts'
import type { ReExportBase } from '@/dsl/ReExportBase.ts'
import { IdentifierBase } from '@/dsl/IdentifierBase.ts'
import { OasDocument } from '@/oas/document/Document.ts'
import { OasInfo } from '@/oas/info/Info.ts'
import type { GenerateContextType } from '@/context/generateTypes.ts'
import {
  fromGeneratorKey,
  isContainerGeneratorKey,
  isWebhookGeneratorKey,
  toContainerGeneratorKey,
  toGeneratorId
} from '@/dsl/GeneratorKeys.ts'

const mockLogger: log.Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
  critical: () => {}
} as unknown as log.Logger

const createContext = () =>
  new GenerateContext({
    document: {
      type: 'oas',
      value: new OasDocument({
        openapi: '3.0.0',
        info: new OasInfo({ title: 'Test', version: '1.0.0' }),
        operations: []
      })
    },
    settings: undefined,
    logger: mockLogger,
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })

/** A lang-style code file — the engine never constructs one itself. */
class TestFile extends CodeFileBase {
  definitions: DefinitionBase[] = []

  override addDefinition(definition: DefinitionBase): void {
    this.definitions.push(definition)
  }
  override addImports(_imports: ImportBase[]): void {}
  override addReExports(_reExports: ReExportBase[]): void {}
  override findDefinitions(query?: FindDefinitionsQuery): DefinitionBase[] | undefined {
    return matchDefinitions(this.definitions, query, () => undefined)
  }
  override toString(): string {
    return this.definitions.join('\n')
  }
}

class TestDefinition extends DefinitionBase {
  override toString(): string {
    return `${this.identifier.name} = ${this.value}`
  }
}

/** A value that holds members — what makes its definition a place. */
class TestContainerValue {
  members: DefinitionBase[] = []

  addDefinition(definition: DefinitionBase): void {
    this.members.push(definition)
  }
  findDefinitions(query?: FindDefinitionsQuery): DefinitionBase[] | undefined {
    return matchDefinitions(this.members, query, () => undefined)
  }
  toString(): string {
    return `{ ${this.members.join(', ')} }`
  }
}

/** A value that does not. */
class TestPlainValue {
  toString(): string {
    return 'plain'
  }
}

type SeedArgs = {
  context: GenerateContextType
  path: string
  containerName?: string
}

const seed = ({ context, path, containerName = 'UsersService' }: SeedArgs) => {
  const file = new TestFile({ path })

  context.addFile(file)

  const container = new TestContainerValue()

  context.register({
    definitions: [
      new TestDefinition({
        context,
        identifier: new IdentifierBase({ name: containerName }),
        value: container
      })
    ],
    destinationPath: path
  })

  return { file, container }
}

const toMember = (context: GenerateContextType, name: string) =>
  new TestDefinition({
    context,
    identifier: new IdentifierBase({ name }),
    value: new TestPlainValue()
  })

Deno.test('a member registered with `into` lands in the container, not the file', () => {
  const context = createContext()
  const { file, container } = seed({ context, path: '@/api/UsersApi.kt' })

  context.register({
    definitions: [toMember(context, 'getUsersId')],
    destinationPath: '@/api/UsersApi.kt',
    into: 'UsersService'
  })

  assertEquals(container.members.map(member => member.identifier.name), ['getUsersId'])
  // The file still holds only the container itself.
  assertEquals(file.definitions.map(definition => definition.identifier.name), ['UsersService'])
})

Deno.test('findDefinition looks inside the named container, and only there', () => {
  const context = createContext()
  const path = '@/api/UsersApi.kt'
  seed({ context, path })

  context.register({
    definitions: [toMember(context, 'getUsersId')],
    destinationPath: path,
    into: 'UsersService'
  })

  assertEquals(context.findDefinition({ name: 'getUsersId', exportPath: path, into: 'UsersService' })
    ?.identifier.name, 'getUsersId')
  // Not visible at file level — a member and a top-level declaration may
  // share a name without colliding, so the place is part of the lookup.
  assertEquals(context.findDefinition({ name: 'getUsersId', exportPath: path }), undefined)
})

Deno.test('members arrive in any order — the second producer finds the first one', () => {
  const context = createContext()
  const path = '@/api/UsersApi.kt'
  const { container } = seed({ context, path })

  const insert = (name: string) => {
    const existing = context.findDefinition({ name, exportPath: path, into: 'UsersService' })

    if (existing) {
      return existing
    }

    const member = toMember(context, name)

    context.register({ definitions: [member], destinationPath: path, into: 'UsersService' })

    return member
  }

  insert('getUsersId')
  insert('postUsers')
  const reused = insert('getUsersId')

  assertEquals(container.members.map(member => member.identifier.name), ['getUsersId', 'postUsers'])
  assertEquals(reused.identifier.name, 'getUsersId')
})

Deno.test('a missing container fails the register rather than falling back to the file', () => {
  const context = createContext()
  const path = '@/api/UsersApi.kt'
  seed({ context, path })

  assertThrows(
    () =>
      context.register({
        definitions: [toMember(context, 'getUsersId')],
        destinationPath: path,
        into: 'NoSuchService'
      }),
    Error,
    "Cannot register into 'NoSuchService'"
  )
})

Deno.test('a declaration that does not hold members is not an insertion target', () => {
  const context = createContext()
  const path = '@/api/UsersApi.kt'
  const file = new TestFile({ path })

  context.addFile(file)
  context.register({
    definitions: [
      new TestDefinition({
        context,
        identifier: new IdentifierBase({ name: 'ApiError' }),
        value: new TestPlainValue()
      })
    ],
    destinationPath: path
  })

  assertThrows(
    () =>
      context.register({
        definitions: [toMember(context, 'status')],
        destinationPath: path,
        into: 'ApiError'
      }),
    Error,
    'does not hold members'
  )
})

Deno.test('findDefinition returns undefined for a member of a container that does not exist', () => {
  const context = createContext()
  const path = '@/api/UsersApi.kt'
  seed({ context, path })

  assertEquals(
    context.findDefinition({ name: 'getUsersId', exportPath: path, into: 'NoSuchService' }),
    undefined
  )
})

Deno.test('isDefinitionContainer is structural, so a value from any module instance passes', () => {
  assertEquals(isDefinitionContainer(new TestContainerValue()), true)
  assertEquals(isDefinitionContainer(new TestPlainValue()), false)
  assertEquals(isDefinitionContainer(undefined), false)
  assertEquals(isDefinitionContainer({ addDefinition: () => {}, findDefinitions: () => undefined }), true)
})

Deno.test('a container key round-trips and stays disjoint from the webhook key', () => {
  const key = toContainerGeneratorKey({
    generatorId: '@skmtc/gen-kotlin-spring',
    group: 'Users',
    name: 'UsersService'
  })

  assertEquals(key, '@skmtc/gen-kotlin-spring|container|Users|UsersService|main')
  assertEquals(isContainerGeneratorKey(key), true)
  assertEquals(isWebhookGeneratorKey(key), false)
  assertEquals(toGeneratorId(key), '@skmtc/gen-kotlin-spring')
  assertEquals(fromGeneratorKey(key), {
    type: 'container',
    generatorId: '@skmtc/gen-kotlin-spring',
    group: 'Users',
    name: 'UsersService',
    variant: 'main'
  })
})

Deno.test('every member of a group computes the same key for its container', () => {
  const forMember = (tag: string) =>
    toContainerGeneratorKey({
      generatorId: '@skmtc/gen-kotlin-spring',
      group: tag,
      name: `${tag}Service`
    })

  // Same group, different subjects — one key.
  assertEquals(forMember('Users'), forMember('Users'))
  // Different groups are different containers, even in one file.
  assertEquals(forMember('Users') === forMember('Orders'), false)
})

Deno.test('the tag-file shape: members create the container on demand, no accumulating method', () => {
  const context = createContext()
  const path = '@/api/UsersApi.kt'

  context.addFile(new TestFile({ path }))

  // What a generator's transform would do for one subject. Nothing here
  // knows whether it is the first subject of the group, and nothing calls a
  // method the container had to invent.
  const contribute = (containerName: string, memberName: string) => {
    const container =
      context.findDefinition({ name: containerName, exportPath: path }) ??
      (() => {
        const definition = new TestDefinition({
          context,
          identifier: new IdentifierBase({ name: containerName }),
          value: new TestContainerValue()
        })

        context.register({ definitions: [definition], destinationPath: path })

        return definition
      })()

    if (!context.findDefinition({ name: memberName, exportPath: path, into: containerName })) {
      context.register({
        definitions: [toMember(context, memberName)],
        destinationPath: path,
        into: containerName
      })
    }

    return container
  }

  // Two containers in one file, subjects arriving interleaved.
  contribute('UsersService', 'getUsersId')
  contribute('UsersController', 'getUsersId')
  contribute('UsersService', 'postUsers')
  contribute('UsersController', 'postUsers')

  const file = context.getFile(path) as TestFile

  assertEquals(file.definitions.map(definition => definition.identifier.name), [
    'UsersService',
    'UsersController'
  ])
  assertEquals(
    `${file}`,
    'UsersService = { getUsersId = plain, postUsers = plain }\n' +
      'UsersController = { getUsersId = plain, postUsers = plain }'
  )
})
