import type { Session } from '@supabase/supabase-js'

export const toMockSession = () => {
  const mockSession: Session = {
    access_token: 'test-token',
    refresh_token: 'refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-123',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date().toISOString()
    }
  }

  return mockSession
}
