import { Auth } from '@/lib/auth.ts'
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
}
