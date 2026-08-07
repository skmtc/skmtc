import { existsSync } from '@std/fs/exists'
import type { ClientSettings } from '@skmtc/core/Settings'
import { toSchemaContents } from '@/lib/to-schema-contents.ts'
import { toBundleFsPath, toBundlePath } from '@/lib/to-bundle-path.ts'
import { GenerateArtifacts } from '@/lib/generate-artifacts.ts'

/**
 * Resolves the schema and renders this run's fresh artifact set — the
 * same schema-resolution + worker invocation `generate` uses — for
 * callers that want live canonical content on demand instead of a
 * persisted cache.
 *
 * Returns `null` on any failure (no configured source, unreachable
 * source, missing bundle, worker error) rather than throwing. This is
 * the choke point that keeps `status`/`clean` safe to run any time —
 * including before a project has ever been generated, or offline —
 * at the cost of degrading to lock-hash-only comparison in that case.
 */
export const resolveFreshArtifacts = async ({
  projectPath,
  schemaSourceString,
  clientSettings,
  stackUrl
}: {
  projectPath: string
  schemaSourceString: string | undefined
  clientSettings: ClientSettings | undefined
  stackUrl: string | undefined
}): Promise<Record<string, string> | null> => {
  if (!schemaSourceString) {
    return null
  }

  if (!stackUrl && !existsSync(toBundleFsPath(projectPath))) {
    return null
  }

  try {
    const schemaContents = await toSchemaContents(schemaSourceString)

    const { artifacts } = await GenerateArtifacts.generateWithWorker({
      bundlePath: toBundlePath(projectPath),
      schemaContents: schemaContents.contents,
      clientSettings,
      stackUrl
    })

    return artifacts
  } catch (_error) {
    return null
  }
}
