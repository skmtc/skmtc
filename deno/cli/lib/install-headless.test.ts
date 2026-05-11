import { assertEquals, assertRejects } from '@std/assert'
import { installHeadless } from '@/lib/install-headless.ts'

type InstallCall = { moduleName: string }

type FakeProject = {
  name: string
  installs: InstallCall[]
  installGenerator: (args: InstallCall) => Promise<void>
}

const createFakeProject = (name: string): FakeProject => {
  const installs: InstallCall[] = []
  return {
    name,
    installs,
    installGenerator: async (args: InstallCall) => {
      installs.push(args)
    }
  }
}

type FakeRoot = {
  projects: FakeProject[]
  findProject: (name: string) => FakeProject
}

const createFakeRoot = (projects: FakeProject[]): FakeRoot => ({
  projects,
  findProject(name) {
    const project = projects.find(p => p.name === name)
    if (!project) throw new Error(`Project "${name}" not found`)
    return project
  }
})

Deno.test('installHeadless - installs each generator with jsr: prefix', async () => {
  const project = createFakeProject('my-api')
  const root = createFakeRoot([project])

  const result = await installHeadless({
    // deno-lint-ignore no-explicit-any
    skmtcRoot: root as any,
    projectName: 'my-api',
    generators: ['@skmtc/gen-zod', '@skmtc/gen-tanstack-query']
  })

  assertEquals(project.installs, [
    { moduleName: 'jsr:@skmtc/gen-zod' },
    { moduleName: 'jsr:@skmtc/gen-tanstack-query' }
  ])
  assertEquals(result.projectName, 'my-api')
  assertEquals(result.installed, ['@skmtc/gen-zod', '@skmtc/gen-tanstack-query'])
})

Deno.test('installHeadless - preserves existing jsr: prefix instead of double-prefixing', async () => {
  const project = createFakeProject('my-api')
  const root = createFakeRoot([project])

  await installHeadless({
    // deno-lint-ignore no-explicit-any
    skmtcRoot: root as any,
    projectName: 'my-api',
    generators: ['jsr:@skmtc/gen-zod']
  })

  assertEquals(project.installs, [{ moduleName: 'jsr:@skmtc/gen-zod' }])
})

Deno.test('installHeadless - propagates findProject error when project does not exist', async () => {
  const root = createFakeRoot([])

  await assertRejects(
    () =>
      installHeadless({
        // deno-lint-ignore no-explicit-any
        skmtcRoot: root as any,
        projectName: 'missing',
        generators: ['@skmtc/gen-zod']
      }),
    Error,
    'Project "missing" not found'
  )
})

Deno.test('installHeadless - surfaces underlying install error instead of swallowing it', async () => {
  // Regression guard for the "install reports success but deno.json is
  // empty" bug — Project.installGenerator now re-throws on failure so
  // installHeadless propagates it to the caller.
  const project = createFakeProject('my-api')
  project.installGenerator = async () => {
    throw new Error('JSR returned 404')
  }
  const root = createFakeRoot([project])

  await assertRejects(
    () =>
      installHeadless({
        // deno-lint-ignore no-explicit-any
        skmtcRoot: root as any,
        projectName: 'my-api',
        generators: ['@skmtc/gen-zod']
      }),
    Error,
    'JSR returned 404'
  )
})
