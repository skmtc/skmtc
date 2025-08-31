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

      case '/':
        return new Response(done, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        })

      default:
        return new Response(null, { status: 404 })
    }
  }
}

export { createAuthHandler }

const done = `
<html>
  <body style="display: flex;
    flex-direction: column;
    gap: 16px;
    height: 100vh;
    width: 100vw;
    background-color: #f8f4ed;
    color: #3f3f46;
    padding: 32px;"
  >
    <h1>You now logged in</h1>

    <p>This page is no longer needed and will close automatically in 5 seconds</p>

    <script>
      setTimeout(() => {
        window.close()
      }, 5000)
    </script>
    
  </body>
</html>
`
