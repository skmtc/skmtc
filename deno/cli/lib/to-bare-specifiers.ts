/** A `jsr:` or `npm:` specifier with its version written in. */
type VersionedSpecifier = {
  /** `<scheme>:<name>@<version>` — the shape of an imports-map value. */
  base: string
  name: string
  /** `/<subpath>`, or `''`. */
  subpath: string
}

const versionedSpecifierRegex = /^(jsr|npm):(@[^/@]+\/[^/@]+|[^/@]+)@([^/]+)(\/.*)?$/

export const toVersionedSpecifier = (specifier: string): VersionedSpecifier | undefined => {
  const match = specifier.match(versionedSpecifierRegex)

  if (!match) {
    return undefined
  }

  const [, scheme, name, version, subpath = ''] = match

  return { base: `${scheme}:${name}@${version}`, name, subpath }
}

type Position = { line: number; character: number }

type Occurrence = {
  start: Position
  end: Position
  raw: string
  specifier: VersionedSpecifier
}

export type SourceFile = { path: string; content: string }

/**
 * Finds versioned specifiers in a module's import positions with
 * deno_graph — the analyzer JSR uses to decide which specifiers to
 * rewrite on publish — so strings and comments are never touched.
 * deno_graph reports the first value import and the first type import
 * of each specifier only. A file that doesn't parse yields nothing and
 * is left as served.
 */
const toOccurrences = async ({ path, content }: SourceFile): Promise<Occurrence[]> => {
  const { parseModule } = await import('@deno/graph')

  const module = await parseModule(
    `file:///package${path}`,
    new TextEncoder().encode(content)
  ).catch(() => undefined)

  const resolved = (module?.dependencies ?? []).flatMap(dependency => {
    return [dependency.code, dependency.type].filter(item => item !== undefined)
  })

  return resolved.flatMap(({ specifier, span }) => {
    const versioned = specifier ? toVersionedSpecifier(specifier) : undefined

    return specifier && versioned && span
      ? [{ start: span.start, end: span.end, raw: specifier, specifier: versioned }]
      : []
  })
}

/** deno_graph counts columns in code points; strings index UTF-16 units. */
const toStringIndex = (line: string, character: number): number => {
  return Array.from(line).slice(0, character).join('').length
}

type Replacement = { occurrence: Occurrence; target: string }

/**
 * Applies the replacements whose span holds the quoted specifier, and
 * returns the new content with the replacements that were applied.
 * Anything else means the columns and the text disagree, so that import
 * is left as served.
 */
const applyReplacements = (content: string, replacements: Replacement[]) => {
  const lines = content.split('\n')

  const ordered = replacements.toSorted((a, b) => {
    return (
      b.occurrence.start.line - a.occurrence.start.line ||
      b.occurrence.start.character - a.occurrence.start.character
    )
  })

  const applied = ordered.filter(({ occurrence, target }) => {
    const { start, end, raw } = occurrence
    const line = lines[start.line]

    if (line === undefined || start.line !== end.line) {
      return false
    }

    const from = toStringIndex(line, start.character)
    const to = toStringIndex(line, end.character)
    const quoted = line.slice(from, to)
    const quote = quoted[0]

    if (!["'", '"', '`'].includes(quote) || quoted !== `${quote}${raw}${quote}`) {
      return false
    }

    lines[start.line] = `${line.slice(0, from)}${quote}${target}${quote}${line.slice(to)}`

    return true
  })

  return { content: lines.join('\n'), applied }
}

type ToTarget = (specifier: VersionedSpecifier) => string | undefined

/**
 * Rewrites a file until no versioned specifier with a target is left.
 * Each pass re-parses, so the next import of a specifier that appears
 * more than once becomes the one deno_graph reports.
 */
const rewriteFile = async (
  file: SourceFile,
  toTarget: ToTarget
): Promise<{ file: SourceFile; applied: VersionedSpecifier[] }> => {
  const occurrences = await toOccurrences(file)

  const replacements = occurrences.flatMap((occurrence): Replacement[] => {
    const target = toTarget(occurrence.specifier)

    return target === undefined ? [] : [{ occurrence, target }]
  })

  const { content, applied } = applyReplacements(file.content, replacements)

  if (applied.length === 0) {
    return { file, applied: [] }
  }

  const next = await rewriteFile({ path: file.path, content }, toTarget)

  return {
    file: next.file,
    applied: [...applied.map(({ occurrence }) => occurrence.specifier), ...next.applied]
  }
}

type ToBareSpecifiersArgs = {
  files: SourceFile[]
  /** The package's published `deno.json#imports`. */
  imports: Record<string, string>
}

type ToBareSpecifiersResult = {
  files: SourceFile[]
  /** Bare names introduced for specifiers `imports` has no entry for. */
  pins: Record<string, string>
}

/**
 * Rewrites versioned `jsr:` / `npm:` imports back to bare specifiers, so
 * versions come from `deno.json#imports` rather than from each import.
 *
 * JSR rewrites each bare import to its imports-map value on publish, so
 * a specifier whose `<scheme>:<name>@<version>` is a value of `imports`
 * becomes that entry's key plus any subpath. A package with no entry
 * for `<name>` is rewritten to `<name>` and pinned in `pins` — provided
 * every import of it across the package names the same version.
 * Imports of one package at different versions, or at a version
 * `imports` doesn't pin, were written that way on purpose and stay
 * versioned.
 */
export const toBareSpecifiers = async ({
  files,
  imports
}: ToBareSpecifiersArgs): Promise<ToBareSpecifiersResult> => {
  const specifiers = (await Promise.all(files.map(toOccurrences)))
    .flat()
    .map(({ specifier }) => specifier)

  const keyByValue = new Map(
    Object.entries(imports)
      .filter(([key]) => !key.endsWith('/'))
      .map(([key, value]): [string, string] => [value, key])
  )

  const unpinnedByName = Map.groupBy(
    specifiers.filter(({ base }) => !keyByValue.has(base)),
    ({ name }) => name
  )

  const candidatePins = new Map(
    [...unpinnedByName].flatMap(([name, unpinned]) => {
      const bases = new Set(unpinned.map(({ base }) => base))

      return bases.size === 1 && !(name in imports) ? [[name, [...bases][0]]] : []
    })
  )

  const toTarget: ToTarget = ({ base, name, subpath }) => {
    const key = keyByValue.get(base) ?? (candidatePins.get(name) === base ? name : undefined)

    return key === undefined ? undefined : `${key}${subpath}`
  }

  const rewritten = await Promise.all(files.map(file => rewriteFile(file, toTarget)))

  const pins = Object.fromEntries(
    rewritten
      .flatMap(({ applied }) => applied)
      .filter(({ base }) => !keyByValue.has(base))
      .map(({ name, base }) => [name, base])
  )

  return { files: rewritten.map(({ file }) => file), pins }
}
