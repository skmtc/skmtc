import { join } from '@std/path/join'
import { RootDenoJson } from '@/lib/root-deno-json.ts'
import type { Manager } from '@/lib/manager.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'
import { toWorker } from '@/lib/to-worker.ts'
import { ensureWorkerDeps } from '@/lib/ensure-worker-deps.ts'

/** What a bundle build needs from a project. `Project` satisfies it. */
export type BundleProject = {
  name: string
  toPath(): string
  createWorker(): Promise<string>
}

type WriteWorkerArgs = {
  projectPath: string
  rootDenoJson: RootDenoJson
}

/**
 * Writes `worker.ts` from `deno.json#imports`, and pins `@skmtc/worker`
 * and `@skmtc/core` when the project doesn't. `worker.ts` is replaced by a
 * rename, so a build running at the same time never reads half a file.
 */
export const writeWorker = async ({
  projectPath,
  rootDenoJson
}: WriteWorkerArgs): Promise<string> => {
  const workerPath = join(projectPath, 'worker.ts')

  await writeFileAtomic({
    projectPath,
    path: workerPath,
    contents: toWorker(rootDenoJson.toGeneratorIds())
  })

  // worker.ts imports `@skmtc/worker` and `@skmtc/core` — neither is
  // added by the clone import-collector (worker.ts is CLI-generated,
  // not part of any cloned package). Ensure both are pinned, then
  // persist so the `deno bundle` subprocess reads the updated import map.
  if (ensureWorkerDeps(rootDenoJson)) {
    await rootDenoJson.write()
  }

  return workerPath
}

type WriteFileAtomicArgs = {
  projectPath: string
  path: string
  contents: string
}

/**
 * Writes to a temporary file under `.settings/` — which `skmtc dev`
 * doesn't watch — then renames it over `path`.
 */
const writeFileAtomic = async ({ projectPath, path, contents }: WriteFileAtomicArgs) => {
  const settingsPath = join(projectPath, '.settings')
  await Deno.mkdir(settingsPath, { recursive: true })
  const temporaryPath = join(settingsPath, `.write-${crypto.randomUUID()}`)
  await Deno.writeTextFile(temporaryPath, contents)
  await Deno.rename(temporaryPath, path)
}

/**
 * The project as a bundle build sees it: its name, path and pins. Unlike
 * `Project.open`, it reads no `client.json` and no schema.
 */
export const openBundleProject = async (
  projectName: string,
  manager: Manager
): Promise<BundleProject> => {
  const projectPath = toProjectPath(projectName)
  const rootDenoJson = await RootDenoJson.open(projectName, manager)

  return {
    name: projectName,
    toPath: () => projectPath,
    createWorker: () => writeWorker({ projectPath, rootDenoJson })
  }
}
