import type { SupabaseClient } from '@supabase/supabase-js'

type CreateAuthHandlerArgs = {
  supabase: SupabaseClient<any, 'public', any>
}

const createAuthHandler = ({ supabase }: CreateAuthHandlerArgs) => {
  return async (req: Request) => {
    const { pathname } = new URL(req.url)

    switch (pathname) {
      case '/oauth/callback': {
        const url = new URL(req.url)

        const code = url.searchParams.get('code')
        const next = url.searchParams.get('next') ?? '/'

        if (code) {
          await supabase.auth.exchangeCodeForSession(code)
        }

        return new Response('You are now logged in', {
          status: 303,
          headers: { Location: `/${next.slice(1)}` }
        })
      }

      default:
        return new Response(null, { status: 404 })
    }
  }
}

export { createAuthHandler }
