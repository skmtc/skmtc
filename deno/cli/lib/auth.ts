import invariant from 'tiny-invariant'
import { createSupabaseClient } from '../auth/supabase-client.ts'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createAuthHandler } from '../auth/auth-handler.ts'

export class Auth {
  supabase: SupabaseClient

  constructor() {
    this.supabase = createSupabaseClient()
  }

  async toSession() {
    const { data } = await this.supabase.auth.getSession()

    return data.session
  }
  async ensureAuth(): Promise<Session> {
    const session = await this.toSession()

    return session ? session : await this.login()
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

  async login(): Promise<Session> {
    const sessionRes = await this.supabase.auth.getSession()

    if (sessionRes.data.session) {
      console.log('You are already logged in')

      return sessionRes.data.session
    }

    const authHandler = createAuthHandler({ supabase: this.supabase })

    const server = Deno.serve({ port: 9000 }, authHandler)

    const signInRes = await this.supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `http://localhost:9000/oauth/callback`
      }
    })

    console.log('Click the link to login')
    console.log(signInRes.data.url)

    return new Promise(resolve => {
      this.supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
          setTimeout(() => {
            server.shutdown()
          }, 5000)

          resolve(session)
        }
      })
    })
  }

  async logout() {
    const sessionRes = await this.supabase.auth.getSession()

    if (!sessionRes.data.session) {
      console.log('You are not logged in')

      return
    }

    const logoutPromise = new Promise(resolve => {
      this.supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          console.log('You are now logged out')

          resolve(null)
        }
      })
    })

    await this.supabase.auth.signOut()

    return logoutPromise
  }
}
