import type { Generator } from '../../lib/generator.ts'
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
    // Return mock data
    return {
      scope: scopeName,
      name: packageName,
      latest: '0.0.1',
      versions: {
        '0.0.1': {}
      }
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

  static async download(generator: Generator): Promise<Record<string, string>> {
    // Return mock files
    return {
      'mod.ts': '// Mock generator file\nexport const generate = () => "mock output";\n',
      'deno.json': '{ "name": "mock-generator", "version": "0.0.1" }'
    }
  }
}