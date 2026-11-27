import { basename } from '@std/path/basename'
import { skmtcClientConfig } from '@skmtc/core/Settings'
import { parseOrExplain } from '@/lib/parse-or-explain.ts'
import { reportConfigDeprecations, toConfigLocation } from '@/lib/project-config.ts'

/** The config of the project at `projectPath`; `undefined` when it has none, or it does not parse. */
export const toClientJsonContents = (projectPath: string) => {
  try {
    const location = toConfigLocation(projectPath)
    const config: unknown = JSON.parse(Deno.readTextFileSync(location.path))

    reportConfigDeprecations({ projectPath, location, config })

    return parseOrExplain(skmtcClientConfig, config, `${basename(location.path)} at ${location.path}`)
  } catch (_error) {
    return undefined
  }
}
