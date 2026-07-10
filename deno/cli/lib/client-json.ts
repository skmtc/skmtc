import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { type SkmtcClientConfig, skmtcClientConfig } from '@skmtc/core/Settings'
import {
  encodeCompact,
  expandClientJson,
  isCompactClientJson
} from '@skmtc/core/ClientJsonCompact'
import type { Manager } from '@/lib/manager.ts'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import { writeFileSafeDir } from '@/lib/file.ts'
import type { ProjectKey } from '@/lib/project.ts'
import { validateBasePath } from '@/lib/validate-base-path.ts'

type CreateArgs = {
  path: string
  basePath: string
}

type ConstructorArgs = {
  path: string
  contents: SkmtcClientConfig | null
  compact: boolean
}

type OpenArgs = {
  path: string
  manager: Manager
}

type ToPathArgs = {
  projectPath: string | ProjectKey
}

/**
 * Read + parse `client.json`, transparently expanding the compact form.
 *
 * A compact file carries a top-level `compact: true` discriminator and an
 * interned string pool; it is decoded back to the plain settings shape
 * before validation. Returns both the validated config and whether the
 * file was compact, so a subsequent `write` can round-trip the same form.
 */
const readClientJson = (
  text: string,
  path: string
): { contents: SkmtcClientConfig; compact: boolean } => {
  const parsedJson = JSON.parse(text)
  const compact = isCompactClientJson(parsedJson)

  const contents = parseOrExplain(
    skmtcClientConfig,
    expandClientJson(parsedJson),
    `client.json at ${path}`
  )

  return { contents, compact }
}

export class ClientJson {
  contents: SkmtcClientConfig | null
  path: string
  /**
   * On-disk format the file was read (or created) in. `write` mirrors it:
   * a file read compact is rewritten compact, an expanded file stays
   * expanded. New files default to expanded (human-readable). The
   * `skmtc compact` / `skmtc compact --expand` command flips this.
   */
  compact: boolean

  private constructor({ path, contents, compact }: ConstructorArgs) {
    this.path = path
    this.contents = contents
    this.compact = compact
  }

  static toPath({ projectPath }: ToPathArgs): string {
    return join(projectPath, '.settings', 'client.json')
  }

  async refresh() {
    try {
      const text = await Deno.readTextFile(this.path)

      const { contents, compact } = readClientJson(text, this.path)

      this.contents = contents
      this.compact = compact
    } catch (_error) {
      // Do nothing
    }
  }

  updateContents(contents: Partial<SkmtcClientConfig>) {
    this.contents = { settings: {}, ...this.contents, ...contents }
  }

  static async open({ path, manager }: OpenArgs): Promise<ClientJson> {
    const hasClientJson = await exists(path, { isFile: true })

    if (!hasClientJson) {
      return new ClientJson({ path, contents: null, compact: false })
    }

    const text = await Deno.readTextFile(path)

    const { contents, compact } = readClientJson(text, path)

    const clientJson = new ClientJson({ path, contents, compact })

    manager.cleanupActions.push(async () => await clientJson.write())

    return clientJson
  }

  async write() {
    const content =
      this.compact && this.contents !== null
        ? JSON.stringify(encodeCompact(this.contents))
        : JSON.stringify(this.contents, null, 2)

    await writeFileSafeDir(this.path, content)
  }

  static create({ path, basePath }: CreateArgs) {
    return new ClientJson({
      path,
      contents: { settings: { basePath: validateBasePath(basePath) } },
      compact: false
    })
  }
}
