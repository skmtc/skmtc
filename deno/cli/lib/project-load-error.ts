/** A project folder whose files did not load, with the error that stopped it. */
export type UnloadedProject = {
  name: string
  error: unknown
}

/** A command named a project whose files did not load. */
export class ProjectLoadError extends Error {
  readonly projectName: string

  constructor({ name, error }: UnloadedProject) {
    const reason = error instanceof Error ? error.message : String(error)
    super(`Project "${name}" did not load: ${reason}`, { cause: error })
    this.name = 'ProjectLoadError'
    this.projectName = name
  }
}
