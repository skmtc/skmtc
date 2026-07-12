/**
 * Headless `agent-context` — passive introspection of the CLI surface
 * and the current SKMTC root. Distinct from `doctor`:
 *
 *   - **doctor**  : "is anything wrong?"   — active diagnostics.
 *   - **agent-context** : "what do you have?" — passive snapshot.
 *
 * Agents call this to discover which commands exist (with their flags
 * and required args), where state lives on disk, and what's currently
 * in each project — without scraping `--help` or re-reading the skill
 * doc on every invocation.
 *
 * Shape is deliberately stable: agents should be able to pin to it
 * across CLI versions. Adding fields is fine; renaming/removing them
 * is a breaking change.
 */

import { join } from '@std/path/join'
import { homedir } from 'node:os'
import { existsSync } from '@std/fs/exists'
import { toRootPath } from '@/lib/to-root-path.ts'
import { toProjectPath } from '@/lib/to-project-path.ts'
import {
  COMMAND_DESCRIPTORS,
  type CommandDescriptor,
  type FlagDescriptor
} from '@/lib/cli-schema.ts'

// Re-export the schema types so existing consumers (tests, command
// printer) keep their imports stable.
export type { CommandDescriptor, FlagDescriptor }

export type ProjectSnapshot = {
  name: string
  basePath: string | null
  schemaSource: string | null
  generators: {
    /** Generators installed from JSR (`jsr:` import value). */
    remote: string[]
    /** Generators cloned/created locally (relative-path import value). */
    local: string[]
  }
}

export type AgentContext = {
  cliVersion: string
  /** Root that contains the `.skmtc/` directory. */
  skmtcRootPath: string
  /** Global state directory — auth tokens, shadow project caches. */
  globalStateDir: string
  /** JSR registry URL — `JSR_URL` env var if set. */
  jsrUrl: string
  projects: ProjectSnapshot[]
  commands: CommandDescriptor[]
}

type RunAgentContextArgs = {
  cliVersion: string
}

export const runAgentContext = ({ cliVersion }: RunAgentContextArgs): AgentContext => {
  const skmtcRootPath = toRootPath()
  const globalStateDir = join(homedir(), '.skmtc')
  const jsrUrl = Deno.env.get('JSR_URL') ?? 'https://jsr.io/'
  return {
    cliVersion,
    skmtcRootPath,
    globalStateDir,
    jsrUrl,
    projects: collectProjects(skmtcRootPath),
    commands: COMMAND_DESCRIPTORS
  }
}

const collectProjects = (skmtcRootPath: string): ProjectSnapshot[] => {
  if (!existsSync(skmtcRootPath)) return []
  const entries: ProjectSnapshot[] = []
  try {
    for (const entry of Deno.readDirSync(skmtcRootPath)) {
      if (!entry.isDirectory) continue
      entries.push(snapshotProject(entry.name))
    }
  } catch {
    // Permissions or transient FS issues — return what we have so
    // far rather than aborting. Doctor would surface this separately.
  }
  return entries.sort((a, b) => a.name.localeCompare(b.name))
}

const snapshotProject = (projectName: string): ProjectSnapshot => {
  const projectPath = toProjectPath(projectName)
  const denoJsonPath = join(projectPath, 'deno.json')
  const clientJsonPath = join(projectPath, '.settings', 'client.json')

  const generators = readGenerators(denoJsonPath)
  const { basePath, schemaSource } = readClientJson(clientJsonPath)

  return {
    name: projectName,
    basePath,
    schemaSource,
    generators
  }
}

const readGenerators = (denoJsonPath: string): ProjectSnapshot['generators'] => {
  if (!existsSync(denoJsonPath)) return { remote: [], local: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(Deno.readTextFileSync(denoJsonPath))
  } catch {
    return { remote: [], local: [] }
  }
  const importsRaw =
    parsed && typeof parsed === 'object' && 'imports' in parsed
      ? (parsed as { imports?: unknown }).imports
      : undefined
  if (!importsRaw || typeof importsRaw !== 'object') {
    return { remote: [], local: [] }
  }
  const remote: string[] = []
  const local: string[] = []
  for (const [id, value] of Object.entries(importsRaw as Record<string, unknown>)) {
    if (typeof value !== 'string') continue
    // `gen-*` package convention — non-generator imports (`@std/path`,
    // `valibot`, …) are filtered out so agents see only what's
    // structurally a generator. Mirrors the convention in
    // `RootDenoJson.toGeneratorIds`.
    const isGenerator = id.includes('/gen-') || id.startsWith('gen-') || id.includes('@skmtc/gen-')
    if (!isGenerator) continue
    if (value.startsWith('jsr:')) {
      remote.push(id)
    } else {
      local.push(id)
    }
  }
  return { remote: remote.sort(), local: local.sort() }
}

const readClientJson = (
  clientJsonPath: string
): { basePath: string | null; schemaSource: string | null } => {
  if (!existsSync(clientJsonPath)) {
    return { basePath: null, schemaSource: null }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(Deno.readTextFileSync(clientJsonPath))
  } catch {
    return { basePath: null, schemaSource: null }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { basePath: null, schemaSource: null }
  }
  const settings = 'settings' in parsed ? parsed.settings : undefined
  const source = 'source' in parsed ? parsed.source : undefined
  const basePathRaw =
    settings && typeof settings === 'object' && 'basePath' in settings
      ? (settings as { basePath?: unknown }).basePath
      : undefined
  return {
    basePath: typeof basePathRaw === 'string' ? basePathRaw : null,
    schemaSource: typeof source === 'string' ? source : null
  }
}

// Command list now lives in `lib/cli-schema.ts` and is imported above.
// Adding a new command means: (1) add an entry to COMMAND_DESCRIPTORS
// there, (2) wire the Cliffy action in `mod.ts` (uses the same
// schema for description/args/flags).
