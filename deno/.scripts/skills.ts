#!/usr/bin/env -S deno run --allow-read --allow-write --allow-env --allow-run=git
/**
 * Skills: report and repoint the `~/.claude/skills/*` symlinks that resolve
 * into this repo's `deno/docs/skills/`.
 *
 * A skill is loaded from wherever its symlink points, and the symlinks are
 * pointed by hand — so it is easy (and has happened) for one arc's skills to
 * be repointed at a worktree while the rest keep pointing at the primary
 * checkout. Nothing surfaces that, and the consequences are quiet: an edit
 * lands in a tree the loaded skill isn't reading, and a gen-eval run records
 * ONE `skillSha` for skills that came from two different commits, so two runs
 * that look identically provenanced were not.
 *
 * This script makes the split visible and fixable in one step. Only symlinks
 * whose target contains `deno/docs/skills/` are touched — a skill symlinked
 * somewhere else entirely is left alone.
 *
 * Usage:
 *   deno task skills                    # status: where each skill resolves
 *   deno task skills point main         # repoint all of them at the primary checkout
 *   deno task skills point <worktree>   # ...or at a named worktree
 *   deno task skills point main --dry-run
 */

import { basename, dirname, fromFileUrl, isAbsolute, join, resolve } from '@std/path'

const SKILLS_SEGMENT = join('deno', 'docs', 'skills')

export type SkillLink = {
  /** Skill directory name under `~/.claude/skills`, e.g. `skmtc-generator`. */
  name: string
  /** The symlink path itself. */
  linkPath: string
  /** Where the symlink currently points. */
  target: string
  /** Repo root owning `target` — the path before `deno/docs/skills/`. */
  treeRoot: string
}

export type TreeState = {
  root: string
  /** Short label: `main` for the primary checkout, else the worktree dir name. */
  label: string
  head: string
  /** Count of modified files under `deno/docs/skills`. */
  dirtySkillFiles: number
}

const toSkillsHome = (): string => {
  const home = Deno.env.get('HOME')
  if (!home) throw new Error('HOME is not set')
  return join(home, '.claude', 'skills')
}

/** Every `~/.claude/skills` symlink that resolves into a `deno/docs/skills` tree. */
export const readSkillLinks = async (skillsHome: string): Promise<SkillLink[]> => {
  const links: SkillLink[] = []
  for await (const entry of Deno.readDir(skillsHome)) {
    if (!entry.isSymlink) continue
    const linkPath = join(skillsHome, entry.name)
    const rawTarget = await Deno.readLink(linkPath)
    // A relative target is relative to the symlink's own directory —
    // resolving it there keeps later `git -C treeRoot` calls correct
    // regardless of the script's cwd.
    const target = isAbsolute(rawTarget) ? rawTarget : resolve(dirname(linkPath), rawTarget)
    const at = target.indexOf(SKILLS_SEGMENT)
    if (at === -1) continue
    links.push({
      name: entry.name,
      linkPath,
      target,
      treeRoot: target.slice(0, at).replace(/\/$/, '')
    })
  }
  return links.sort((left, right) => left.name.localeCompare(right.name))
}

const git = async (root: string, args: string[]): Promise<string> => {
  const command = new Deno.Command('git', { args: ['-C', root, ...args], stdout: 'piped', stderr: 'null' })
  const { success, stdout } = await command.output()
  return success ? new TextDecoder().decode(stdout).trim() : ''
}

/** Worktree roots keyed by label — `main` plus every `git worktree` entry. */
export const readTrees = async (repoRoot: string): Promise<Map<string, string>> => {
  const listing = await git(repoRoot, ['worktree', 'list', '--porcelain'])
  const roots = listing
    .split('\n')
    .filter(line => line.startsWith('worktree '))
    .map(line => line.slice('worktree '.length))
  const trees = new Map<string, string>()
  roots.forEach((root, index) => {
    // Two worktrees can share a directory basename; a silent last-wins
    // would make `point <label>` target the wrong tree. Disambiguate
    // with the worktree-list index so every root keeps a unique label.
    const base = index === 0 ? 'main' : basename(root)
    trees.set(trees.has(base) ? `${base}@${index}` : base, root)
  })
  return trees
}

const toTreeState = async (root: string, trees: Map<string, string>): Promise<TreeState> => {
  const label = [...trees].find(([, treeRoot]) => treeRoot === root)?.[0] ?? basename(root)
  const status = await git(root, ['status', '--porcelain', '--', 'deno/docs/skills'])
  return {
    root,
    label,
    head: (await git(root, ['rev-parse', 'HEAD'])).slice(0, 12) || 'unknown',
    dirtySkillFiles: status ? status.split('\n').filter(Boolean).length : 0
  }
}

const reportStatus = async (links: SkillLink[], trees: Map<string, string>): Promise<boolean> => {
  const states = new Map<string, TreeState>()
  for (const root of new Set(links.map(link => link.treeRoot))) {
    states.set(root, await toTreeState(root, trees))
  }

  const width = Math.max(...links.map(link => link.name.length))
  for (const link of links) {
    const state = states.get(link.treeRoot)
    const dirty = state && state.dirtySkillFiles > 0 ? `  (${state.dirtySkillFiles} dirty)` : ''
    console.log(`  ${link.name.padEnd(width)}  ${state?.label ?? '?'} @ ${state?.head ?? '?'}${dirty}`)
  }

  const uniform = states.size <= 1
  console.log(
    uniform
      ? `\nAll ${links.length} skills resolve to one tree.`
      : `\nSPLIT: ${links.length} skills resolve to ${states.size} different trees ` +
        `(${[...states.values()].map(state => state.label).join(', ')}).\n` +
        `A run loading skills from more than one tree cannot be provenanced by a single SHA.\n` +
        `Repoint them together:  deno task skills point <tree>`
  )
  return uniform
}

const pointAt = async (
  links: SkillLink[],
  trees: Map<string, string>,
  label: string,
  dryRun: boolean
): Promise<void> => {
  const root = trees.get(label)
  if (!root) {
    console.error(`unknown tree '${label}'. Known: ${[...trees.keys()].join(', ')}`)
    Deno.exit(1)
  }

  for (const link of links) {
    const target = join(root, SKILLS_SEGMENT, link.name)
    if (link.target === target) {
      console.log(`  ${link.name}: already at ${label}`)
      continue
    }
    // A skill present in one tree but not another (a skill added on a branch)
    // is left where it is rather than pointed at a path that does not exist.
    const exists = await Deno.stat(target).then(() => true).catch(() => false)
    if (!exists) {
      console.log(`  ${link.name}: SKIPPED — not present in ${label}`)
      continue
    }
    console.log(`  ${link.name}: -> ${label}`)
    if (dryRun) continue
    await Deno.remove(link.linkPath)
    await Deno.symlink(target, link.linkPath)
  }
  if (dryRun) console.log('\n(dry run — nothing written)')
}

if (import.meta.main) {
  const repoRoot = dirname(dirname(fromFileUrl(import.meta.url)))
  const skillsHome = toSkillsHome()
  const links = await readSkillLinks(skillsHome)
  const trees = await readTrees(repoRoot)

  if (links.length === 0) {
    console.log(`no skills under ${skillsHome} resolve into ${SKILLS_SEGMENT}`)
    Deno.exit(0)
  }

  const [command, target] = Deno.args.filter(arg => !arg.startsWith('--'))
  const dryRun = Deno.args.includes('--dry-run')

  if (command === 'point') {
    if (!target) {
      console.error('usage: deno task skills point <main|worktree-name> [--dry-run]')
      Deno.exit(1)
    }
    await pointAt(links, trees, target, dryRun)
    console.log()
    await reportStatus(await readSkillLinks(skillsHome), trees)
    Deno.exit(0)
  }

  const uniform = await reportStatus(links, trees)
  Deno.exit(uniform ? 0 : 1)
}
