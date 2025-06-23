import type { Generator } from './generator.ts'

export type Pkg = {
  name: string
  version: string
}

export type JsrPkgVersionInfo = {
  pkg: Pkg
  manifest?: JsrPkgManifest
  exports?: { [key: string]: string }
  moduleGraph1?: unknown
  moduleGraph2?: unknown
}

export type JsrPkgManifest = {
  [path: string]: JsrPkgManifestFile
}

export type JsrPkgManifestFile = {
  readonly size: number
  readonly checksum: string
}

type GetLatestVersionArgs = {
  scopeName: string
  generatorName: string
}

export type JsrPkgMetaVersion = { yanked?: boolean }

type JsrPkgMetaVersions = {
  scope: string
  name: string
  latest: string
  versions: {
    [version: string]: JsrPkgMetaVersion
  }
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
