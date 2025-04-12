import * as fs from 'fs'
import * as path from 'path'
import { window } from 'vscode'
import { skmtcStackConfig, SkmtcStackConfig } from '@skmtc/core/Settings'
import { toSettingsPath } from './toSettingsPath'
import * as v from 'valibot'

type ReadStackConfigArgs<ApplyDefault extends boolean> = {
  applyDefault?: ApplyDefault
  notifyIfMissing?: boolean
}

type StackConfigReturn<ApplyDefault extends boolean> = ApplyDefault extends true
  ? SkmtcStackConfig
  : SkmtcStackConfig | undefined

export const readStackConfig = <ApplyDefault extends boolean>({
  notifyIfMissing,
  applyDefault
}: ReadStackConfigArgs<ApplyDefault> = {}): StackConfigReturn<ApplyDefault> => {
  const stackConfigPath = path.resolve(toSettingsPath(), 'stack.json')

  if (!fs.existsSync(stackConfigPath)) {
    if (applyDefault) {
      return createEmptyStackConfig('New project')
    }

    if (notifyIfMissing) {
      window.showErrorMessage(`Stack config file not found at '${stackConfigPath}'`)
    }

    return undefined as StackConfigReturn<ApplyDefault>
  }

  const stackConfigFile = fs.readFileSync(stackConfigPath, 'utf-8')

  const parsed = JSON.parse(stackConfigFile)

  return v.parse(skmtcStackConfig, parsed)
}

export const createEmptyStackConfig = (name: string): SkmtcStackConfig => ({
  name,
  generators: []
})
