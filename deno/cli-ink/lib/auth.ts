import invariant from 'tiny-invariant'
import { createSupabaseClient } from '../auth/supabase-client.ts'
import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { createAuthHandler } from '../auth/auth-handler.ts'
import type { AlertState } from '../components/types.ts'

// Cross-platform server creation
async function createServer(
  port: number,
  handler: (request: Request) => Response | Promise<Response>
) {
  // Use globalThis to avoid dnt shim type checking issues
  const denoGlobal = (
    globalThis as unknown as {
      Deno?: {
        serve?: (
          options: { port: number },
          handler: (request: Request) => Response | Promise<Response>
        ) => { shutdown: () => void }
      }
    }
  ).Deno
  if (typeof denoGlobal?.serve === 'function') {
    // Deno runtime
    return denoGlobal.serve({ port }, handler)
  } else {
    // Node.js runtime - create HTTP server
    return await createNodeServer(port, handler)
  }
}

// Node.js HTTP server implementation
async function createNodeServer(
  port: number,
  handler: (request: Request) => Response | Promise<Response>
) {
  // Dynamic import to avoid issues during Deno compilation
  const http = await import('node:http')

  const server = http.createServer(async (req: any, res: any) => {
    try {
      // Convert Node.js request to Web API Request
      const fullUrl = `http://localhost:${port}${req.url}`
      const request = new Request(fullUrl, {
        method: req.method,
        headers: req.headers,
        body: req.method !== 'GET' && req.method !== 'HEAD' ? req : undefined
      })

      // Call the handler
      const response = await handler(request)

      // Convert Web API Response to Node.js response
      res.statusCode = response.status

      // Set headers
      response.headers.forEach((value, key) => {
        res.setHeader(key, value)
      })

      // Send body
      if (response.body) {
        const reader = response.body.getReader()
        const pump = () => {
          reader.read().then(({ done, value }) => {
            if (done) {
              res.end()
            } else {
              res.write(value)
              pump()
            }
          })
        }
        pump()
      } else {
        res.end()
      }
    } catch (error) {
      console.error('Server error:', error)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  server.listen(port)

  return {
    shutdown: () => {
      server.close()
    }
  }
}

type LogoutArgs = {
  notify: (alert: AlertState) => void
}

export class Auth {
  supabase: SupabaseClient

  constructor() {
    this.supabase = createSupabaseClient()
  }

  async toSession() {
    const { data } = await this.supabase.auth.getSession()

    return data.session
  }
  async ensureAuth(emitLoginLink: (loginLink: string) => void): Promise<Session> {
    const session = await this.toSession()

    return session ? session : await this.login(emitLoginLink)
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

  async login(emitLoginLink: (loginLink: string) => void): Promise<Session> {
    const sessionRes = await this.supabase.auth.getSession()

    if (sessionRes.data.session) {
      // console.log('You are already logged in')

      return sessionRes.data.session
    }

    const authHandler = createAuthHandler({ supabase: this.supabase })

    const server = await createServer(9000, authHandler)

    const signInRes = await this.supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `http://localhost:9000/oauth/callback`
      }
    })

    invariant(signInRes.data.url, 'Login link is null')

    emitLoginLink(signInRes.data.url)

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

  async logout({ notify }: LogoutArgs) {
    const sessionRes = await this.supabase.auth.getSession()

    if (!sessionRes.data.session) {
      notify({ type: 'info', message: 'You are not logged in' })

      return
    }

    const logoutPromise = new Promise(resolve => {
      this.supabase.auth.onAuthStateChange((_event, session) => {
        if (!session) {
          notify({ type: 'info', message: 'You are now logged out' })

          resolve(null)
        }
      })
    })

    await this.supabase.auth.signOut()

    return logoutPromise
  }
}
