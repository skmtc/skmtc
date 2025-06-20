import { Auth } from './auth.ts'
type AsyncAction = () => Promise<void>

type ManagerArgs = {
  kv: Deno.Kv
  logSuccess?: string
}

export class Manager {
  kv: Deno.Kv
  auth: Auth
  cleanupActions: AsyncAction[]
  logSuccess?: string

  constructor({ kv, logSuccess }: ManagerArgs) {
    this.kv = kv
    this.auth = new Auth(kv)
    this.logSuccess = logSuccess
    this.cleanupActions = [() => Promise.resolve(kv.close())]
  }

  async cleanup() {
    const promises = this.cleanupActions.map(action => action())

    await Promise.all(promises)
  }

  async success() {
    await this.cleanup()

    if (this.logSuccess) {
      console.log(this.logSuccess)
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
