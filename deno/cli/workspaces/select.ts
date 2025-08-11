import { Input } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const toSelectProject = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Input.prompt({
    message: 'Select project',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  return projectName
}
