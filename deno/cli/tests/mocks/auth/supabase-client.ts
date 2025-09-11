// Mock Supabase client for testing
class MockSupabaseClient {
  private mockSession: any = null

  auth = {
    getSession: async () => {
      return { 
        data: { session: this.mockSession }, 
        error: null 
      }
    },
    signInWithOAuth: async () => {
      this.mockSession = {
        user: { 
          id: 'test-user-id',
          user_metadata: { user_name: 'test-user' }
        },
        access_token: 'mock-access-token'
      }
      return { 
        data: { url: 'http://localhost:9000/mock-auth' }, 
        error: null 
      }
    },
    signOut: async () => {
      this.mockSession = null
      return { error: null }
    },
    onAuthStateChange: (callback: (event: string, session: any) => void) => {
      // Immediately trigger signed in state if we have a mock session
      if (this.mockSession) {
        setTimeout(() => callback('SIGNED_IN', this.mockSession), 100)
      }
      return { data: { subscription: { unsubscribe: () => {} } } }
    }
  }

  functions = {
    invoke: async (functionName: string, options: any) => {
      // Return mock server data
      if (functionName === '/servers' && options.method === 'POST') {
        return {
          data: {
            id: 'test-server-id',
            serverName: options.body.serverName,
            latestDeploymentId: null,
            latestDenoDeploymentId: null,
            denoProjectName: options.body.serverName,
            latestStatus: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          error: null
        }
      }
      return { data: null, error: new Error('Not mocked') }
    }
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

export const createSupabaseClient = () => {
  return new MockSupabaseClient() as any
}