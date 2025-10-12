import type { Session } from '@supabase/supabase-js'

export const createTestSession = (username = 'testuser'): Session => {
    return {
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_in: 3600,
      token_type: 'bearer',
      user: {
        id: 'test-id',
        app_metadata: {
          provider: 'test-provider'
        },
        aud: 'test-aud',
        created_at: '2024-01-01',
        user_metadata: {
          user_name: username
        }
      }
    }
  }