/**
 * What `api link` sends as the repository and the workflow: the GitHub
 * repository of the `origin` remote, and the one workflow that publishes.
 *
 * Git runs through `sh`: the recommended install grants
 * `--allow-run=deno,sh` only.
 */

import { join } from '@std/path/join'

/** The hub's rule for `repository`: `owner/repo`, as GitHub names them. */
const REPOSITORY_PATTERN = /^[A-Za-z0-9-]{1,39}\/(?!\.{1,2}$)[A-Za-z0-9._-]{1,100}$/

/** The hub's rule for `workflowPath`. */
const WORKFLOW_PATH_PATTERN = /^\.github\/workflows\/[^/]+\.ya?ml$/

/** A workflow publishes when its text contains one of these. */
const PUBLISH_MARKERS = ['skmtc/publish-action', 'skmtc api publish']

const WORKFLOWS_FOLDER = '.github/workflows'

export const isRepository = (value: string): boolean => REPOSITORY_PATTERN.test(value)

export const isWorkflowPath = (value: string): boolean => WORKFLOW_PATH_PATTERN.test(value)

/**
 * `owner/repo` from a GitHub remote URL: `https://github.com/o/r`,
 * `git@github.com:o/r` or `ssh://git@github.com/o/r`, each with or without
 * `.git`. Any other host gives nothing.
 */
export const parseGithubRemote = (url: string): string | undefined => {
  const match =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([^/]+\/[^/]+?)(?:\.git)?\/?$/i.exec(
      url.trim()
    )
  return match?.[1]
}

/** The `origin` remote's URL in `cwd`, or nothing when there is no remote or no git. */
export const readOriginRemote = async (cwd: string): Promise<string | undefined> => {
  const output = await new Deno.Command('sh', {
    args: ['-c', 'git remote get-url origin'],
    cwd,
    stdin: 'null',
    stdout: 'piped',
    stderr: 'null'
  })
    .output()
    .catch(() => undefined)
  if (!output?.success) return undefined
  const url = new TextDecoder().decode(output.stdout).trim()
  return url === '' ? undefined : url
}

/** The repo-relative paths of the workflows in `cwd` that publish, sorted. */
export const findPublishWorkflows = async (cwd: string): Promise<string[]> => {
  const folder = join(cwd, WORKFLOWS_FOLDER)
  const names = await Array.fromAsync(Deno.readDir(folder)).catch(() => [])
  const candidates = names
    .filter(entry => entry.isFile && /\.ya?ml$/.test(entry.name))
    .map(entry => entry.name)
  const publishing = await Promise.all(
    candidates.map(async name => {
      const text = await Deno.readTextFile(join(folder, name)).catch(() => '')
      return PUBLISH_MARKERS.some(marker => text.includes(marker)) ? [name] : []
    })
  )
  return publishing
    .flat()
    .sort()
    .map(name => `${WORKFLOWS_FOLDER}/${name}`)
}

/** A value `api link` cannot send; the caller exits 2 with `message`. */
export type LinkTargetInvalid = { type: 'invalid'; message: string }

export const resolveRepository = async ({
  repoFlag,
  cwd
}: {
  repoFlag: string | undefined
  cwd: string
}): Promise<{ type: 'resolved'; repository: string } | LinkTargetInvalid> => {
  if (repoFlag !== undefined) {
    const repository = repoFlag.trim()
    return isRepository(repository)
      ? { type: 'resolved', repository }
      : { type: 'invalid', message: `invalid --repo "${repoFlag}" — expected <owner>/<repo>` }
  }
  const remote = await readOriginRemote(cwd)
  if (remote === undefined) {
    return {
      type: 'invalid',
      message:
        'no git remote: `git remote get-url origin` found none here. Pass --repo <owner>/<repo>.'
    }
  }
  const repository = parseGithubRemote(remote)
  if (repository === undefined || !isRepository(repository)) {
    return {
      type: 'invalid',
      message: `the origin remote "${remote}" is not a GitHub repository. Pass --repo <owner>/<repo>.`
    }
  }
  return { type: 'resolved', repository }
}

export const resolveWorkflow = async ({
  workflowFlag,
  cwd
}: {
  workflowFlag: string | undefined
  cwd: string
}): Promise<{ type: 'resolved'; workflow: string } | LinkTargetInvalid> => {
  if (workflowFlag !== undefined) {
    const workflow = workflowFlag.trim().replace(/^\.\//, '')
    return isWorkflowPath(workflow)
      ? { type: 'resolved', workflow }
      : {
          type: 'invalid',
          message: `invalid --workflow "${workflowFlag}" — expected a .yml or .yaml file in ${WORKFLOWS_FOLDER}/`
        }
  }
  const workflows = await findPublishWorkflows(cwd)
  if (workflows.length === 1) return { type: 'resolved', workflow: workflows[0] }
  if (workflows.length === 0) {
    return {
      type: 'invalid',
      message:
        `no workflow in ${WORKFLOWS_FOLDER}/ uses skmtc/publish-action or runs skmtc api publish. ` +
        'Pass --workflow <path>.'
    }
  }
  return {
    type: 'invalid',
    message: `${workflows.length} workflows publish (${workflows.join(', ')}). Pass --workflow <path> to pick one.`
  }
}
