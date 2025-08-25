import { exists } from '@std/fs'
import { join } from '@std/path'
import { toProjectPath } from './to-project-path.ts'
import { type ManifestContent, manifestContent, toManifestErrors } from '@skmtc/core'
import * as v from 'valibot'
import { writeFileSafeDir } from './file.ts'

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
      const contents = await Deno.readTextFile(Manifest.toPath(this.projectName))
      const parsed = v.parse(manifestContent, JSON.parse(contents))

      this.contents = parsed
    }
  }

  toErrorCount() {
    return toManifestErrors(this.contents?.results ?? {}).length
  }

  static async open(projectName: string): Promise<Manifest> {
    const hasManifest = await Manifest.exists(projectName)

    if (hasManifest) {
      const contents = await Deno.readTextFile(Manifest.toPath(projectName))

      const parsed = v.parse(manifestContent, JSON.parse(contents))

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
