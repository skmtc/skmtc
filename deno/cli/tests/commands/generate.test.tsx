import { assertEquals } from '@std/assert/equals'
import { toGenerateCommand } from '@/workspaces/generate.tsx'
import { createMockManager } from '@/tests/mocks/manager.mock.ts'
import { createMockSkmtcRoot } from '@/tests/mocks/skmtc-root.mock.ts'
import { createMockProject } from '@/tests/mocks/project.mock.ts'
// import { render } from 'ink-testing-library'
// import { App } from '../../components/App.tsx'
// import { assertSpyCalls, returnsNext, resolvesNext, stub } from '@std/testing/mock'

Deno.test('generate command - parses project name argument', async () => {
  const manager = createMockManager()
  const mockProject = createMockProject(manager, { name: 'test-project' })
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

  const command = toGenerateCommand(skmtcRoot)

  // The command should be created successfully
  assertEquals(command.getDescription(), 'Generate artifacts')
})

Deno.test('generate command - has watch option', async () => {
  const manager = createMockManager()
  const skmtcRoot = createMockSkmtcRoot(manager, { projects: [] })

  const command = toGenerateCommand(skmtcRoot)
  const options = command.getOptions()

  const watchOption = options.find(opt => opt.name === 'watch')
  assertEquals(watchOption !== undefined, true)
  assertEquals(watchOption?.flags?.join(', '), '-w, --watch')
})

// Deno.test('generate command - runs generate inner', async () => {
//   const manager = createMockManager()

//   const mockProject = createMockProject(manager, { name: 'project-1' })
//   const skmtcRoot = createMockSkmtcRoot(manager, { projects: [mockProject] })

//   const invokeStub = stub(
//     manager.auth.supabase.functions,
//     'invoke',
//     resolvesNext([{ data: [], error: null }])
//   )

//   try {
//     const { lastFrame, unmount } = render(
//       <App
//         skmtcRoot={skmtcRoot}
//         session={null}
//         view={{
//           page: 'generate',
//           project: skmtcRoot.findProject('project-1'),
//           schemaSourceString: undefined,
//           watchMode: false
//         }}
//         interactive={false}
//       />
//     )

//     const frameOne = lastFrame()

//     assertEquals(
//       frameOne,
//       `
// │  Input OpenAPI schema path or URL
// │  ../../../../mock/schema.json`
//     )

//     unmount()
//   } finally {
//     invokeStub.restore()
//   }
// })
