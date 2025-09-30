import type { SupabaseClient } from '@supabase/supabase-js'

type MockInvocation = {
  path: string
  method: string
  body?: unknown
}

export class MockSupabaseClient {
  invocations: MockInvocation[] = []
  responses: Map<string, { data?: unknown; error?: unknown }> = new Map()

  mockResponse(path: string, response: { data?: unknown; error?: unknown }) {
    this.responses.set(path, response)
  }

  createClient(): SupabaseClient {
    const self = this

    return {
      functions: {
        invoke: async (path: string, options?: { method?: string; body?: unknown }) => {
          self.invocations.push({
            path,
            method: options?.method || 'GET',
            body: options?.body
          })

          const response = self.responses.get(path) || { data: null, error: null }
          return Promise.resolve(response)
        }
      },
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        signInWithOAuth: async () => ({ data: { url: 'https://mock-auth-url' }, error: null }),
        signOut: async () => ({ error: null })
      }
    } as unknown as SupabaseClient
  }

  reset() {
    this.invocations = []
    this.responses.clear()
  }

  getInvocations(path?: string): MockInvocation[] {
    if (path) {
      return this.invocations.filter(inv => inv.path === path)
    }
    return this.invocations
  }
}

export function createMockSupabaseClient(): {
  client: SupabaseClient
  mock: MockSupabaseClient
} {
  const mock = new MockSupabaseClient()
  return {
    client: mock.createClient(),
    mock
  }
}