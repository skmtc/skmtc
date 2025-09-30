import type { Manager } from '../../lib/manager.ts'
import type { Auth } from '../../lib/auth.ts'
import { createMockSupabaseClient } from './supabase.mock.ts'

export function createMockManager(): Manager {
  const { client: supabaseClient, mock: supabaseMock } = createMockSupabaseClient()

  const mockAuth: Auth = {
    supabase: supabaseClient,
    isLoggedIn: () => false,
    login: async () => {},
    logout: async () => {},
    toSession: async () => null
  } as unknown as Auth

  const mockManager: Manager = {
    auth: mockAuth,
    cleanupActions: [],
    cleanup: async () => {},
    success: async (_logSuccess?: string) => {},
    fail: async (_message?: string) => {
      throw new Error('Manager.fail called')
    },
    _supabaseMock: supabaseMock
  } as unknown as Manager

  return mockManager
}