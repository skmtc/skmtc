type AsyncAction = () => Promise<void>

export class Manager {
  cleanupActions: AsyncAction[]

  constructor() {
    this.cleanupActions = []
  }

  async cleanup() {
    const promises = this.cleanupActions.map(action => action())

    await Promise.all(promises)
  }
}
