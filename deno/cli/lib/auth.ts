import invariant from 'tiny-invariant'
import { createSupabaseClient } from '../auth/supabase-client.ts'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { login } from '../auth/auth.ts'

export class Auth {
  kv: Deno.Kv
  supabase: SupabaseClient

  constructor(kv: Deno.Kv) {
    this.kv = kv
    this.supabase = createSupabaseClient({ kv })
  }

  async toSession() {
    const { data } = await this.supabase.auth.getSession()

    return data.session
  }
  async enforceAuth(): Promise<Session> {
    const session = await this.toSession()

    return session ? session : await login()
  }

  async isLoggedIn(): Promise<boolean> {
    const { data } = await this.supabase.auth.getSession()

    return Boolean(data.session)
  }

  async toUserName(): Promise<string> {
    const { data } = await this.supabase.auth.getSession()

    invariant(data?.session, 'User is not logged in')

    return data.session.user.user_metadata.user_name
  }
}
