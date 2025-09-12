import { walk } from '@std/fs/walk'
import { relative } from '@std/path/relative'
import type { AssetEntry, DenoFile } from './types.ts'

type ToAssetsArgs = {
  projectRoot: string
}

export const toAssets = async ({
  projectRoot
}: ToAssetsArgs): Promise<Record<string, DenoFile>> => {
  const items = await Array.fromAsync(walk(projectRoot, {}))

  const fileEntries = items
    .map(({ path, isDirectory }): AssetEntry | undefined => {
      if (isDirectory) {
        return
      }

      if (skipFile({ path, projectRoot })) {
        return
      }

      const file: DenoFile = {
        kind: 'file',
        encoding: 'utf-8',
        content: Deno.readTextFileSync(path)
      }

      return [relative(projectRoot, path), file]
    })
    .filter((item): item is AssetEntry => Boolean(item))

  return Object.fromEntries(fileEntries)
}

type SkipFileArgs = {
  path: string
  projectRoot: string
}

const skipFile = ({ path, projectRoot }: SkipFileArgs) => {
  const relativePath = relative(projectRoot, path)

  return (
    relativePath.includes('.DS_Store') ||
    relativePath.includes('.prettierrc.json') ||
    relativePath.startsWith('.logs/') ||
    relativePath.startsWith('openapi.json') ||
    relativePath.startsWith('openapi.yaml') ||
    relativePath.startsWith('.settings/files.json') ||
    relativePath.startsWith('.settings/manifest.json') ||
    relativePath.startsWith('.settings/client.json')
  )
}
