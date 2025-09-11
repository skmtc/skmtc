import type { Generator } from './generator.ts'
import { maxSatisfying } from '@std/semver/max-satisfying'
import { parse } from '@std/semver/parse'
import { parseRange } from '@std/semver/parse-range'

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

export type JsrPkgMetaVersion = { yanked?: boolean }

type JsrPkgMetaVersions = {
  scope: string
  name: string
  latest: string
  versions: {
    [version: string]: JsrPkgMetaVersion
  }
}

type GetLatestMetaArgs = {
  scopeName: string
  packageName: string
}

type GetLatestVersionArgs = {
  scopeName: string
  packageName: string
  semver: string
}

export class Jsr {
  static async getLatestMeta({
    scopeName,
    packageName
  }: GetLatestMetaArgs): Promise<JsrPkgMetaVersions> {
    const res = await fetch(`https://jsr.io/${scopeName}/${packageName}/meta.json`)

    if (!res.ok) {
      throw new Error(`Failed to get latest meta for jsr:${scopeName}/${packageName}`)
    }

    const meta: JsrPkgMetaVersions = await res.json()

    return meta
  }

  static async getLatestVersion({
    scopeName,
    packageName,
    semver
  }: GetLatestVersionArgs): Promise<string> {
    const meta = await Jsr.getLatestMeta({ scopeName, packageName })

    const versions = Object.keys(meta.versions).map(version => parse(version))

    const parsedVersion = maxSatisfying(versions, parseRange(semver))

    if (!parsedVersion) {
      throw new Error(
        `Failed to find package for jsr:${scopeName}/${packageName} with version matching ${semver}`
      )
    }

    const { major, minor, patch } = parsedVersion

    const version = `${major}.${minor}.${patch}`

    return version
  }

  static async download(generator: Generator): Promise<Record<string, string>> {
    const [scopeName, packageName] = generator.toModuleName().split('/')

    const version = await Jsr.getLatestVersion({
      scopeName,
      packageName,
      semver: generator.version
    })

    const versionMetaUrl = `https://jsr.io/${scopeName}/${packageName}/${version}_meta.json`

    const versionMetaRes = await fetch(versionMetaUrl)

    if (!versionMetaRes.ok) {
      const resText = await versionMetaRes.text()

      throw new Error(`Failed to get latest meta for jsr:${scopeName}/${packageName}. ${resText}`)
    }

    const versionMeta: JsrPkgVersionInfo = await versionMetaRes.json()

    const files = Object.keys(versionMeta.manifest ?? {}).map(async key => {
      const fileRes = await fetch(`https://jsr.io/${scopeName}/${packageName}/${version}/${key}`)

      if (!fileRes.ok) {
        throw new Error(`Failed to get file for jsr:${scopeName}/${packageName}`)
      }

      const file = await fileRes.text()

      return [key, file] as [string, string]
    })

    return Object.fromEntries(await Promise.all(files))
  }
}
