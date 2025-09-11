import { createClient } from '@supabase/supabase-js'
import { toAuthStore } from './store.ts'

// Mock Supabase client for testing
class MockSupabaseClient {
  private mockSession: any = null

  auth = {
    getSession: async () => {
      if (Deno.env.get('SKMTC_SKIP_AUTH') === 'true') {
        return { data: { session: null }, error: null }
      }
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
      if (Deno.env.get('SKMTC_TEST_MODE') === 'true') {
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
  // Use mock client in test mode
  if (Deno.env.get('SKMTC_TEST_MODE') === 'true') {
    return new MockSupabaseClient() as any
  }

  const authStore = toAuthStore()
  // Create a single supabase client for interacting with your database
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? 'https://api.skm.tc',
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ?? 'sb_publishable_9_SstJccHh_uQqDqDt13LA_ZCbJ00y3',
    {
      auth: {
        detectSessionInUrl: true,
        flowType: 'pkce',
        storage: authStore
      }
    }
  )

  return supabase
}
