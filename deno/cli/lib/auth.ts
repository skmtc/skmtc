import invariant from 'tiny-invariant'
import { createSupabaseClient } from '../auth/supabase-client.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

export class Auth {
  kv: Deno.Kv
  supabase: SupabaseClient

  constructor(kv: Deno.Kv) {
    this.kv = kv
    this.supabase = createSupabaseClient({ kv })
  }

  async toSession() {
    const { data: auth } = await this.supabase.auth.getSession()

    return auth.session
  }

  async enforceAuth() {
    const session = await this.toSession()

    if (!session) {
      console.log('You are not logged in')

      this.kv.close()

      Deno.exit(1)
    }
  }

  async toUserName(): Promise<string> {
    const { data: auth } = await this.supabase.auth.getSession()

    invariant(auth?.session, 'User is not logged in')

    return auth.session.user.user_metadata.user_name
  }
}
