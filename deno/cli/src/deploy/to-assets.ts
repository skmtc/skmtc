import { walk } from '@std/fs'
import { relative } from '@std/path'
import type { AssetEntry, DenoFile } from './types.ts'

type ToAssetsArgs = {
  skmtcRoot: string
}

export const toAssets = async ({ skmtcRoot }: ToAssetsArgs): Promise<Record<string, DenoFile>> => {
  const things = await Array.fromAsync(walk(skmtcRoot, {}))
  const fileEntries = things
    .map(({ path }): AssetEntry | undefined => {
      if (skipFile({ path, skmtcRoot })) {
        return
      }

      if (Deno.statSync(path).isDirectory) {
        return
      }

      const file: DenoFile = {
        kind: 'file',
        encoding: 'utf-8',
        content: Deno.readTextFileSync(path)
      }

      return [relative(skmtcRoot, path), file]
    })
    .filter((item): item is AssetEntry => Boolean(item))

  return Object.fromEntries(fileEntries)
}

type SkipFileArgs = {
  path: string
  skmtcRoot: string
}

const skipFile = ({ path, skmtcRoot }: SkipFileArgs) => {
  const relativePath = relative(skmtcRoot, path)

  return (
    relativePath.includes('.DS_Store') ||
    relativePath.includes('.prettierrc.json') ||
    relativePath.startsWith('.logs/') ||
    relativePath.startsWith('.schema.json') ||
    relativePath.startsWith('.schema.yaml') ||
    relativePath.startsWith('.settings/files.json') ||
    relativePath.startsWith('.settings/manifest.json') ||
    relativePath.startsWith('.settings/client.json')
  )
}
