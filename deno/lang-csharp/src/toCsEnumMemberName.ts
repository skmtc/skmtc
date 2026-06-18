/**
 * Derives a C# enum member name from a wire value: PascalCase with camel
 * boundaries preserved (`inProgress` → `InProgress`), non-name characters
 * treated as word breaks (`not_started` → `NotStarted`), a leading digit
 * prefixed with `_`, and the empty residue pinned to `Empty`. When the
 * result differs from the wire value the member gets a
 * `[JsonStringEnumMemberName]` annotation — that attachment is gen-side
 * policy (D11); this function only produces the name.
 */
export const toCsEnumMemberName = (value: string): string => {
  const pascalCase = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')

  if (!pascalCase) {
    return 'Empty'
  }

  return /^[0-9]/.test(pascalCase) ? `_${pascalCase}` : pascalCase
}

/** One produced enum member: the C# name and the wire value it carries. */
export type CsEnumMember = {
  name: string
  wireValue: string
}

export type ToCsEnumMemberNamesArgs = {
  /**
   * Names that are already taken before any member is produced —
   * pre-seed with the enclosing enum's type name to avoid CS0542 (a
   * member may not share its enclosing type's name: wire value
   * `"status"` inside `enum Status` becomes `Status2`).
   */
  reserved?: Iterable<string>
}

/**
 * Maps wire values to unique C# enum member names. Two wire values
 * collapsing to one member name (`a-b` and `a_b` → `AB`) would not
 * compile, so collisions take a numeric suffix — and the suffix check
 * runs against the FULL produced-name set, not a per-base counter, so a
 * suffixed name can never collide with a later wire-derived name (the
 * note-30 `A_B_2` lesson: with per-base counters, wire values `a-b`,
 * `a_b_2`, `a_b` produce `A_B_2` twice).
 */
export const toCsEnumMemberNames = (
  values: string[],
  args: ToCsEnumMemberNamesArgs = {}
): CsEnumMember[] => {
  const produced = new Set<string>(args.reserved)

  return values.map(wireValue => {
    const base = toCsEnumMemberName(wireValue)

    let name = base
    let suffix = 2

    while (produced.has(name)) {
      name = `${base}${suffix}`
      suffix += 1
    }

    produced.add(name)

    return { name, wireValue }
  })
}
