import { Command } from '@cliffy/command'
import { createSupabaseClient } from './supabase-client.ts'
import { createAuthHandler } from './auth-handler.ts'

export const toLoginPrompt = async () => {
  await login()
}

export const toLoginCommand = () => {
  return new Command().description('Log in to Codesquared').action(async () => {
    await login()
  })
}

export const toLogoutPrompt = async () => {
  await logout()
}

export const toLogoutCommand = () => {
  return new Command().description('Log out of Codesquared').action(async () => await logout())
}

const login = async () => {
  const kv = await Deno.openKv()
  const supabase = createSupabaseClient({ kv })

  const sessionRes = await supabase.auth.getSession()

  if (sessionRes.data.session) {
    console.log('You are already logged in')

    return
  }

  const authHandler = createAuthHandler({ supabase })

  const server = Deno.serve({ port: 9000 }, authHandler)

  const signInRes = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `http://localhost:9000/oauth/callback`
    }
  })

  console.log('Click the link to login')
  console.log(signInRes.data.url)

  return new Promise(resolve => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        console.log('You are now logged in')

        kv.close()
        server.shutdown()

        resolve(session)
      }
    })
  })
}

const logout = async () => {
  const kv = await Deno.openKv()

  const supabase = createSupabaseClient({ kv })

  const sessionRes = await supabase.auth.getSession()

  if (!sessionRes.data.session) {
    console.log('You are not logged in')

    return
  }

  const logoutPromise = new Promise(resolve => {
    supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        console.log('You are now logged out')
        kv.close()

        resolve(null)
      }
    })
  })

  await supabase.auth.signOut()

  return logoutPromise
}
