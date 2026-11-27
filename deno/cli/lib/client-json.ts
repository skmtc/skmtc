import { exists } from '@std/fs/exists'
import { basename } from '@std/path/basename'
import { dirname } from '@std/path/dirname'
import { type SkmtcClientConfig, skmtcClientConfig } from '@skmtc/core/Settings'
import type { Manager } from '@/lib/manager.ts'
import { ConfigValidationError, parseOrExplain } from '@/lib/parse-or-explain.ts'
import { writeFileSafeDir } from '@/lib/file.ts'
import type { ProjectKey } from '@/lib/project.ts'
import { validateBasePath } from '@/lib/validate-base-path.ts'
import { reportConfigDeprecations, toConfigFileText, toConfigLocation } from '@/lib/project-config.ts'

type CreateArgs = {
  path: string
  basePath: string
}

type ConstructorArgs = {
  path: string
  contents: SkmtcClientConfig | null
}

type OpenArgs = {
  path: string
  manager: Manager
}

type ToPathArgs = {
  projectPath: string | ProjectKey
}

/**
 * A project's config file: `.settings/skmtc.config.json`, or the
 * deprecated `.settings/client.json` of a project not yet migrated. It is
 * written back to the file it was read from.
 */
export class ClientJson {
  contents: SkmtcClientConfig | null
  path: string
  /**
   * The contents as last read from the file, serialized. A command that only
   * reads the config leaves the file as it is, with its old names.
   */
  #readContents: string | undefined

  private constructor({ path, contents }: ConstructorArgs) {
    this.path = path
    this.contents = contents
  }

  /** The config file of the project at `projectPath`: see `toConfigLocation`. */
  static toPath({ projectPath }: ToPathArgs): string {
    return toConfigLocation(projectPath).path
  }

  async refresh() {
    try {
      const contents = await Deno.readTextFile(this.path)

      const parsed = parseOrExplain(
        skmtcClientConfig,
        JSON.parse(contents),
        `${basename(this.path)} at ${this.path}`
      )

      this.contents = parsed
      this.#readContents = JSON.stringify(parsed)
    } catch (error) {
      // A file that is missing or mid-write keeps the previous contents; a
      // file that parsed but fails the schema is a real error to surface.
      if (error instanceof ConfigValidationError) {
        throw error
      }
    }
  }

  updateContents(contents: Partial<SkmtcClientConfig>) {
    this.contents = { settings: {}, ...this.contents, ...contents }
  }

  static async open({ path, manager }: OpenArgs): Promise<ClientJson> {
    const hasClientJson = await exists(path, { isFile: true })

    if (!hasClientJson) {
      return new ClientJson({ path, contents: null })
    }

    const contents = await Deno.readTextFile(path)
    const json: unknown = JSON.parse(contents)

    const parsed = parseOrExplain(skmtcClientConfig, json, `${basename(path)} at ${path}`)

    // `path` is `<project>/.settings/<file>`.
    const projectPath = dirname(dirname(path))
    reportConfigDeprecations({ projectPath, location: toConfigLocation(projectPath), config: json })

    const clientJson = new ClientJson({ path, contents: parsed })
    clientJson.#readContents = JSON.stringify(parsed)

    manager.cleanupActions.push(async () => await clientJson.writeIfChanged())

    return clientJson
  }

  /** Writes the config when the command changed it since it was read. */
  async writeIfChanged() {
    if (JSON.stringify(this.contents) !== this.#readContents) {
      await this.write()
    }
  }

  /** Writes the config to the file it was read from, with its settings keys as they are (see `toConfigFileText`). */
  async write() {
    await writeFileSafeDir(this.path, toConfigFileText(this.contents))
    this.#readContents = JSON.stringify(this.contents)
  }

  static create({ path, basePath }: CreateArgs) {
    return new ClientJson({
      path,
      contents: { settings: { basePath: validateBasePath(basePath) } }
    })
  }
}
