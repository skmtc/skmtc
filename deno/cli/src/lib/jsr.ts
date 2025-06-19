import type { Generator } from './generator.ts'
import type { JsrPkgMetaVersions, JsrPkgVersionInfo } from 'jsr:@sys/jsr@0.0.65/types'

type GetLatestVersionArgs = {
  scopeName: string
  generatorName: string
}

export class Jsr {
  static async getLatestMeta({
    scopeName,
    generatorName
  }: GetLatestVersionArgs): Promise<JsrPkgMetaVersions> {
    const res = await fetch(`https://jsr.io/${scopeName}/${generatorName}/meta.json`)

    if (!res.ok) {
      throw new Error(`Failed to get latest meta for jsr:${scopeName}/${generatorName}`)
    }

    const meta: JsrPkgMetaVersions = await res.json()

    return meta
  }

  static async download(generator: Generator): Promise<Record<string, string>> {
    const packageName = generator.toPackageName()

    const versionMetaUrl = `https://jsr.io/${packageName}/${generator.version}_meta.json`

    const versionMetaRes = await fetch(versionMetaUrl)

    if (!versionMetaRes.ok) {
      throw new Error(`Failed to get latest meta for jsr:${packageName}`)
    }

    const versionMeta: JsrPkgVersionInfo = await versionMetaRes.json()

    const files = Object.keys(versionMeta.manifest ?? {}).map(async key => {
      const fileRes = await fetch(`https://jsr.io/${packageName}/${generator.version}/${key}`)

      if (!fileRes.ok) {
        throw new Error(`Failed to get file for jsr:${packageName}`)
      }

      const file = await fileRes.text()

      return [key, file] as [string, string]
    })

    return Object.fromEntries(await Promise.all(files))
  }
}
