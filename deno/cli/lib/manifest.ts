import { exists } from '@std/fs/exists'
import { join } from '@std/path/join'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import { toManifestErrors } from '@/lib/generationStats.ts'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import { writeFileSafeDir } from '@/lib/file.ts'

type ConstructorArgs = {
  projectName: string
  contents: ManifestContent | null
}

export class Manifest {
  contents: ManifestContent | null
  projectName: string

  private constructor({ projectName, contents }: ConstructorArgs) {
    this.projectName = projectName
    this.contents = contents
  }

  static toPath(projectName: string) {
    const projectPath = toProjectPath(projectName)

    return join(projectPath, '.settings', 'manifest.json')
  }

  static async exists(projectName: string): Promise<boolean> {
    const path = Manifest.toPath(projectName)

    return await exists(path, { isFile: true })
  }

  async refresh() {
    const hasManifest = await Manifest.exists(this.projectName)

    if (hasManifest) {
      const path = Manifest.toPath(this.projectName)
      const contents = await Deno.readTextFile(path)
      const parsed = parseOrExplain(
        manifestContent,
        JSON.parse(contents),
        `manifest at ${path}`
      )

      this.contents = parsed
    }
  }

  toErrorCount() {
    return toManifestErrors(this.contents?.results ?? {}).length
  }

  static async open(projectName: string): Promise<Manifest> {
    const hasManifest = await Manifest.exists(projectName)

    if (hasManifest) {
      const path = Manifest.toPath(projectName)
      const contents = await Deno.readTextFile(path)

      const parsed = parseOrExplain(
        manifestContent,
        JSON.parse(contents),
        `manifest at ${path}`
      )

      return new Manifest({ projectName, contents: parsed })
    } else {
      return new Manifest({ projectName, contents: null })
    }
  }

  async write() {
    const path = Manifest.toPath(this.projectName)
    const content = JSON.stringify(this.contents, null, 2)

    await writeFileSafeDir(path, content)
  }
}
