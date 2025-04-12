import * as fs from 'fs'
import * as path from 'path'
import { window } from 'vscode'
import { ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import { toSettingsPath } from './toSettingsPath'
import * as v from 'valibot'

type ReadClientConfigArgs = {
  notifyIfMissing?: boolean
}

export const readManifest = ({ notifyIfMissing }: ReadClientConfigArgs = {}):
  | ManifestContent
  | undefined => {
  const manifestFilePath = path.resolve(toSettingsPath(), 'manifest.json')

  if (!fs.existsSync(manifestFilePath)) {
    if (notifyIfMissing) {
      window.showErrorMessage(`Manifest file not found at '${manifestFilePath}'`)
    }

    return
  }

  const manifestFile = fs.readFileSync(manifestFilePath, 'utf-8')

  const parsed = JSON.parse(manifestFile)

  return v.parse(manifestContent, parsed)
}
