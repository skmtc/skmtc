import { Auth } from './auth.ts'
type AsyncAction = () => Promise<void>

type ManagerArgs = {
  kv: Deno.Kv
}

export class Manager {
  kv: Deno.Kv
  auth: Auth
  cleanupActions: AsyncAction[]

  constructor({ kv }: ManagerArgs) {
    this.kv = kv
    this.auth = new Auth(kv)
    this.cleanupActions = []
  }

  async cleanup() {
    const promises = this.cleanupActions.map(action => action())

    await Promise.all(promises)
  }

  async success(logSuccess?: string) {
    await this.cleanup()

    if (logSuccess) {
      console.log(logSuccess)
    }
  }

  async fail(message: string) {
    await this.cleanup()

    if (message) {
      console.error(message)
    }

    Deno.exit(1)
  }
}
