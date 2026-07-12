/**
 * Parse a JSR-style scoped name `@account/slug` into its parts. Returns `null`
 * for anything that isn't exactly `@<account>/<slug>` — the leading `@` marks a
 * scoped name, distinct from a local path or URL. Shared by `push` (the hub
 * destination, from `client.json#project`) and `publish` (the stack identity,
 * from the project `deno.json#name`).
 */
export const parseScopedName = (spec: string): { account: string; slug: string } | null => {
  const match = /^@([^/\s]+)\/([^/\s]+)$/.exec(spec.trim())
  if (!match) return null
  return { account: match[1], slug: match[2] }
}
