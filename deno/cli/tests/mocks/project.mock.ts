import { Project } from '@/lib/project.ts'
import type { Manager } from '@/lib/manager.ts'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import { ClientJson } from '@/lib/client-json.ts'
import { Manifest } from '@/lib/manifest.ts'
import { SchemaFile } from '@/lib/schema-file.ts'
import { mockRootDenoJsonContents } from '@/tests/fixtures/deno-json.fixture.ts'
import { mockClientJsonContents } from '@/tests/fixtures/client-json.fixture.ts'

type MockProjectOptions = {
  name?: string
  generators?: string[]
  hasProjectKey?: boolean
}

export function createMockProject(manager: Manager, options: MockProjectOptions = {}): Project {
  const {
    name = 'test-project',
    generators = ['@skmtc/gen-typescript', '@skmtc/gen-zod'],
    hasProjectKey = false
  } = options

  const rootDenoJson = {
    contents: {
      ...mockRootDenoJsonContents,
      imports: generators.reduce(
        (acc, gen) => {
          acc[gen] = `jsr:${gen}@^0.0.1`
          return acc
        },
        {} as Record<string, string>
      )
    },
    path: `/mock/projects/${name}/deno.json`,
    refresh: async () => {}
  } as unknown as RootDenoJson

  const clientJson = {
    contents: hasProjectKey
      ? mockClientJsonContents
      : { settings: mockClientJsonContents.settings },
    path: `/mock/projects/${name}/.skmtc/client.json`,
    refresh: async () => {},
    write: async () => {}
  } as unknown as ClientJson

  const manifest = {
    contents: null,
    path: `/mock/projects/${name}/.skmtc/manifest.json`,
    refresh: async () => {}
  } as unknown as Manifest

  const schemaFile = {
    contents: '{}',
    schemaSource: { type: 'local' as const, path: '/mock/schema.json' },
    refresh: async () => {}
  } as unknown as SchemaFile

  const mockProject = Object.create(Project.prototype)

  Object.assign(mockProject, {
    name,
    rootDenoJson,
    clientJson,
    prettierJson: null,
    manifest,
    manager,
    schemaFile,
    toGeneratorIds: () => generators,
    addGenerator: async () => {},
    installGenerator: async () => ({ name: 'test-gen', version: '0.0.1', exports: {} }),
    removeGenerator: async () => {},
    cloneGenerator: async () => {},
    deploy: async () => {},
    createServer: async () => `/mock/projects/${name}/mod.ts`,
    toManifestPath: () => `/mock/projects/${name}/.settings/manifest.json`,
    toPath: () => `/mock/projects/${name}`,
    toProjectKey: () => `@mock/${name}`
  })

  return mockProject as Project
}
