import { Auth } from './auth.ts'
type AsyncAction = () => Promise<void>

export class Manager {
  auth: Auth
  cleanupActions: AsyncAction[]

  constructor() {
    this.auth = new Auth()
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
