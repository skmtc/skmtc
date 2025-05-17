import { Command, type StringType } from '@cliffy/command'
import { OAuth2Client } from '@cmd-johnson/oauth2-client'
import { createClient } from '@supabase/supabase-js'

// Create a single supabase client for interacting with your database
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!)

export const toLoginCommand = () => {
  console.log('TO LOGIN COMMAND')
  return new Command().description('Log in to Codesquared').action(async () => {
    console.log('LOGIN COMMAND')

    await login()
  })
}

export const toLogoutCommand = () => {
  return new Command().description('Log out of Codesquared').action(async () => await logout())
}

const login = async () => {
  console.log('LOGIN')

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github'
  })

  console.log('DATA', data)
  console.log('ERROR', error)

  return data
}

const logout = async () => {
  console.log('LOGOUT')
}
