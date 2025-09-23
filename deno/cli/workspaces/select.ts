import { Select } from '@cliffy/prompt'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'

export const toSelectProject = async (skmtcRoot: SkmtcRoot) => {
  const projectName = await Select.prompt({
    message: 'Select project',

    options: skmtcRoot.projects.map(({ name }) => ({
      label: name,
      value: name
    }))
  })

  return projectName
}
