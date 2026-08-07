import type { Generator } from '@/lib/generator.ts'
import { maxSatisfying } from '@std/semver/max-satisfying'
import { parse } from '@std/semver/parse'
import { parseRange } from '@std/semver/parse-range'
import { toJsrUrl } from '@/lib/jsr-registry.ts'

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

export type JsrPkgMetaVersion = {
  yanked?: boolean
  /** Publish time, as JSR reports it. Optional — a registry mirror need
   *  not carry it, and callers must degrade without it. */
  createdAt?: string
}

export type JsrPkgMetaVersions = {
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
    const url = toJsrUrl(`${scopeName}/${packageName}/meta.json`)

    const res = await fetch(url)

    if (!res.ok) {
      const resText = await res.text()

      console.error(resText)

      throw new Error(`Failed to get latest meta for jsr:${scopeName}/${packageName}`)
    }

    const meta: JsrPkgMetaVersions = await res.json()

    return meta
  }

  /**
   * {@link getLatestMeta} for a caller that must not fail or print when
   * the registry is unreachable — a diagnostic, not a step in a workflow.
   * Returns `undefined` on any network, status or parse failure, and
   * bounds the wait so an offline machine does not stall the command.
   */
  static async tryGetLatestMeta({
    scopeName,
    packageName,
    timeoutMs = 2_000
  }: GetLatestMetaArgs & { timeoutMs?: number }): Promise<
    JsrPkgMetaVersions | undefined
  > {
    try {
      const url = toJsrUrl(`${scopeName}/${packageName}/meta.json`)
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
      if (!res.ok) return undefined
      return await res.json()
    } catch {
      return undefined
    }
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

  /**
   * Downloads every file of the JSR package at the version satisfying
   * `generator.version` (treated as a semver constraint via
   * `getLatestVersion`'s `maxSatisfying`). Returns both the file map
   * (path → contents, paths relative to the package root and starting
   * with `/`) and the concrete resolved version — callers need the
   * version to surface it to the user (e.g. `clone` output) and to
   * write a stable record into the project's workspace.
   */
  static async download(
    generator: Generator
  ): Promise<{ files: Record<string, string>; version: string }> {
    const [scopeName, packageName] = generator.toModuleName().split('/')

    const version = await Jsr.getLatestVersion({
      scopeName,
      packageName,
      semver: generator.version
    })

    const versionMetaUrl = toJsrUrl(`${scopeName}/${packageName}/${version}_meta.json`)

    const versionMetaRes = await fetch(versionMetaUrl)

    if (!versionMetaRes.ok) {
      const resText = await versionMetaRes.text()

      throw new Error(`Failed to get latest meta for jsr:${scopeName}/${packageName}. ${resText}`)
    }

    const versionMeta: JsrPkgVersionInfo = await versionMetaRes.json()

    const fileEntries = Object.keys(versionMeta.manifest ?? {}).map(async key => {
      const fileRes = await fetch(toJsrUrl(`${scopeName}/${packageName}/${version}/${key}`))

      if (!fileRes.ok) {
        throw new Error(`Failed to get file for jsr:${scopeName}/${packageName}`)
      }

      const file = await fileRes.text()

      return [key, file] as [string, string]
    })

    const files = Object.fromEntries(await Promise.all(fileEntries))

    return { files, version }
  }
}
