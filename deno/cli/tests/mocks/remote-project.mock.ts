import type { RemoteProject } from '@/lib/remote-project.ts'
import type { Manager } from '@/lib/manager.ts'
import { ClientJson } from '@/lib/client-json.ts'
import { SchemaFile } from '@/lib/schema-file.ts'
import { mockClientJsonContents } from '@/tests/fixtures/client-json.fixture.ts'

type MockRemoteProjectOptions = {
  accountName?: string
  name?: string
  projectKey?: string
  hasSchemaFile?: boolean
}

export function createMockRemoteProject(
  manager: Manager,
  options: MockRemoteProjectOptions = {}
): RemoteProject {
  const {
    accountName = 'test-account',
    name = 'test-remote-project',
    projectKey = '@test-account/test-remote-project',
    hasSchemaFile = true
  } = options

  const clientJson = {
    contents: {
      ...mockClientJsonContents,
      projectKey
    },
    path: `/mock/remote-projects/${accountName}/${name}/.skmtc/client.json`,
    refresh: async () => {},
    write: async () => {}
  } as unknown as ClientJson

  const schemaFile = {
    contents: hasSchemaFile ? '{"openapi": "3.0.0"}' : '',
    schemaSource: hasSchemaFile
      ? { type: 'local' as const, path: '/mock/remote-schema.json' }
      : { type: 'none' as const },
    refresh: async () => {},
    promptOrFail: async () => {}
  } as unknown as SchemaFile

  const mockRemoteProject: RemoteProject = {
    accountName: accountName.replace(/^@/, ''),
    name,
    schemaFile,
    clientJson,
    prettierJson: null,
    manager,
    toProjectKey: () => projectKey as any,
    toManifestPath: () => `/mock/remote-projects/${accountName}/${name}/.settings/manifest.json`,
    ensureSchemaFile: async () => {}
  } as unknown as RemoteProject

  return mockRemoteProject
}
