import { join } from '@std/path/join'
import { ensureDir } from '@std/fs/ensure-dir'
import { exists } from '@std/fs/exists'

export interface TestEnvironment {
  tempDir: string
  homeDir: string
  projectsDir: string
  kvPath: string
  cleanup: () => Promise<void>
}

export class TestEnvironmentManager {
  private environments: TestEnvironment[] = []

  async setup(testName: string): Promise<TestEnvironment> {
    const timestamp = Date.now()
    const safeName = testName.replace(/[^a-zA-Z0-9]/g, '-')
    const tempDir = await Deno.makeTempDir({
      prefix: `skmtc-test-${safeName}-${timestamp}-`,
    })

    const homeDir = join(tempDir, 'home')
    const projectsDir = join(homeDir, '.skmtc')
    const kvPath = join(tempDir, 'kv.db')

    await ensureDir(projectsDir)

    const env: TestEnvironment = {
      tempDir,
      homeDir,
      projectsDir,
      kvPath,
      cleanup: async () => {
        try {
          await Deno.remove(tempDir, { recursive: true })
        } catch {
          // Ignore cleanup errors
        }
      },
    }

    this.environments.push(env)
    return env
  }

  async cleanupAll(): Promise<void> {
    await Promise.all(this.environments.map(env => env.cleanup()))
    this.environments = []
  }

  getEnvVars(env: TestEnvironment): Record<string, string> {
    return {
      HOME: env.homeDir,
      SKMTC_ROOT: env.projectsDir,
      DENO_KV_PATH: env.kvPath,
      SKMTC_DISABLE_TELEMETRY: 'true',
      SKMTC_TEST_MODE: 'true',
      SKMTC_OFFLINE_MODE: 'true',
      SKMTC_SKIP_AUTH: 'true',
      SKMTC_SKIP_REMOTE_PROJECT: 'true',
      NO_COLOR: '1',
      FORCE_COLOR: '0',
    }
  }
}

export async function createMockProject(
  env: TestEnvironment,
  projectName: string,
  options: {
    generators?: string[]
    basePath?: string
    hasSchema?: boolean
  } = {}
): Promise<string> {
  const { generators = [], basePath = './src', hasSchema = false } = options
  
  const projectPath = join(env.projectsDir, projectName)
  await ensureDir(projectPath)

  const denoJson = {
    name: `@skmtc-test/${projectName}`,
    version: '0.0.1',
    exports: './mod.ts',
    tasks: {
      generate: 'deno run --allow-all generate.ts',
    },
  }

  await Deno.writeTextFile(
    join(projectPath, 'deno.json'),
    JSON.stringify(denoJson, null, 2)
  )

  const clientJson = {
    basePath,
    generators: generators.reduce((acc, gen) => {
      acc[gen] = { version: '0.0.1' }
      return acc
    }, {} as Record<string, { version: string }>),
  }

  await Deno.writeTextFile(
    join(projectPath, 'client.json'),
    JSON.stringify(clientJson, null, 2)
  )

  if (hasSchema) {
    const mockSchema = {
      openapi: '3.0.0',
      info: {
        title: 'Test API',
        version: '1.0.0',
      },
      paths: {
        '/users': {
          get: {
            operationId: 'getUsers',
            responses: {
              '200': {
                description: 'Success',
                content: {
                  'application/json': {
                    schema: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'string' },
                          name: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    }

    await Deno.writeTextFile(
      join(projectPath, 'schema.json'),
      JSON.stringify(mockSchema, null, 2)
    )
  }

  return projectPath
}

export async function createMockOpenAPISchema(
  path: string,
  options: {
    title?: string
    version?: string
    paths?: Record<string, any>
  } = {}
): Promise<void> {
  const {
    title = 'Test API',
    version = '1.0.0',
    paths = {
      '/test': {
        get: {
          operationId: 'testOperation',
          responses: {
            '200': {
              description: 'Success',
            },
          },
        },
      },
    },
  } = options

  const schema = {
    openapi: '3.0.0',
    info: { title, version },
    paths,
  }

  await Deno.writeTextFile(path, JSON.stringify(schema, null, 2))
}

export class MockSupabaseClient {
  private authState = {
    isLoggedIn: false,
    user: null as any,
  }

  auth = {
    getSession: async () => {
      if (this.authState.isLoggedIn) {
        return {
          data: {
            session: {
              user: this.authState.user,
              access_token: 'mock-token',
            },
          },
          error: null,
        }
      }
      return { data: { session: null }, error: null }
    },
    signInWithOAuth: async () => {
      this.authState.isLoggedIn = true
      this.authState.user = { id: 'test-user', email: 'test@example.com' }
      return { data: { url: 'http://mock-oauth-url' }, error: null }
    },
    signOut: async () => {
      this.authState.isLoggedIn = false
      this.authState.user = null
      return { error: null }
    },
  }

  from() {
    return {
      select: () => ({
        single: async () => ({ data: {}, error: null }),
        execute: async () => ({ data: [], error: null }),
      }),
      insert: () => ({
        single: async () => ({ data: {}, error: null }),
      }),
      update: () => ({
        eq: () => ({
          single: async () => ({ data: {}, error: null }),
        }),
      }),
      delete: () => ({
        eq: () => ({
          execute: async () => ({ data: null, error: null }),
        }),
      }),
    }
  }
}

export function createMockKVStore(): Map<string, any> {
  const store = new Map<string, any>()
  
  ;(globalThis as any).Deno = {
    ...Deno,
    openKv: async () => ({
      get: async (key: string[]) => {
        const keyStr = key.join(':')
        return { value: store.get(keyStr), versionstamp: '1' }
      },
      set: async (key: string[], value: any) => {
        const keyStr = key.join(':')
        store.set(keyStr, value)
        return { ok: true }
      },
      delete: async (key: string[]) => {
        const keyStr = key.join(':')
        store.delete(keyStr)
      },
      list: async function* (selector: { prefix: string[] }) {
        const prefix = selector.prefix.join(':')
        for (const [key, value] of store.entries()) {
          if (key.startsWith(prefix)) {
            yield { key: key.split(':'), value, versionstamp: '1' }
          }
        }
      },
      close: () => {},
    }),
  }
  
  return store
}