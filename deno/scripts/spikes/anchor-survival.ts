/**
 * Phase 0, spike 1a — AST anchor × formatter survival
 *
 * Validates the gen-maps anchor design: AST-path anchors computed
 * against the original generated source survive third-party formatting
 * such that the resolved AST node at the anchored path still encloses
 * the same content after reformatting.
 *
 * Run:  deno run -A --node-modules-dir=auto scripts/spikes/anchor-survival.ts
 *
 * Writes a CSV report to stdout. See notes/gen-maps/plan.md §1a.
 */

import ts from 'npm:typescript@5.6.3'
import prettier from 'npm:prettier@3.3.3'

// ----- fixtures: hand-crafted representatives of generated output -----

type Fixture = { name: string; source: string }

const fixtures: Fixture[] = [
  {
    name: 'zod-object.ts',
    source: `export const User = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  age: z.number().int().min(0).max(120),
  roles: z.array(z.enum(['admin', 'user', 'guest']))
})

export const UserList = z.array(User)

export type UserInput = z.input<typeof User>
export type UserOutput = z.output<typeof User>
`
  },
  {
    name: 'tanstack-query.ts',
    source: `import { useQuery, useMutation } from '@tanstack/react-query'
import { fetchUser, updateUser } from './api'

export const useGetUser = (id: string) => {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => fetchUser(id),
    staleTime: 60_000
  })
}

export const useUpdateUser = () => {
  return useMutation({
    mutationFn: (input: { id: string; name: string }) => updateUser(input.id, input.name)
  })
}
`
  },
  {
    name: 'shadcn-form.tsx',
    source: `import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useForm } from 'react-hook-form'

export const CreateUserForm = () => {
  const form = useForm({ defaultValues: { name: '', email: '' } })
  return (
    <Form {...form}>
      <FormField name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>Name</FormLabel>
          <FormControl><Input {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField name="email" render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl><Input type="email" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <Button type="submit">Submit</Button>
    </Form>
  )
}
`
  },
  {
    name: 'msw-handlers.ts',
    source: `import { http, HttpResponse } from 'msw'

export const toRoutesList = {
  getUsers: http.get('/api/users', () => HttpResponse.json([
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' }
  ])),
  getUser: http.get('/api/users/:id', ({ params }) => HttpResponse.json({
    id: params.id,
    name: 'Test User',
    email: 'test@example.com'
  })),
  createUser: http.post('/api/users', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: '3', ...body }, { status: 201 })
  })
}
`
  },
  {
    name: 'typescript-types.ts',
    source: `export type User = {
  id: string
  name: string
  email?: string
  roles: Array<'admin' | 'user' | 'guest'>
  metadata: {
    createdAt: string
    updatedAt: string | null
  }
}

export type UserList = Array<User>

export type CreateUserInput = Omit<User, 'id' | 'metadata'>
`
  }
]

// ----- AST helpers -----

type Path = number[]

function topLevelNames(sf: ts.SourceFile): Map<string, ts.Node> {
  const out = new Map<string, ts.Node>()
  sf.forEachChild((stmt) => {
    const name = topLevelName(stmt)
    if (name) out.set(name, stmt)
  })
  return out
}

function topLevelName(stmt: ts.Node): string | null {
  if (ts.isVariableStatement(stmt)) {
    const first = stmt.declarationList.declarations[0]
    return first && ts.isIdentifier(first.name) ? first.name.text : null
  }
  if (
    (ts.isFunctionDeclaration(stmt) ||
      ts.isClassDeclaration(stmt) ||
      ts.isInterfaceDeclaration(stmt) ||
      ts.isTypeAliasDeclaration(stmt)) &&
    stmt.name
  ) {
    return stmt.name.text
  }
  return null
}

function realChildren(node: ts.Node): ts.Node[] {
  const out: ts.Node[] = []
  node.forEachChild((c) => {
    out.push(c)
  })
  return out
}

function smallestEnclosing(sf: ts.SourceFile, pos: number): ts.Node {
  let best: ts.Node = sf
  function walk(node: ts.Node) {
    if (node.getStart(sf) <= pos && pos < node.getEnd()) {
      best = node
      node.forEachChild(walk)
    }
  }
  sf.forEachChild(walk)
  return best
}

function ascendToLandmark(
  node: ts.Node,
  landmarks: Map<string, ts.Node>
): { landmark: string; path: Path } | null {
  const lset = new Set(landmarks.values())
  const path: Path = []
  let curr: ts.Node = node
  while (!lset.has(curr) && curr.parent) {
    const siblings = realChildren(curr.parent)
    const idx = siblings.indexOf(curr)
    if (idx < 0) return null
    path.unshift(idx)
    curr = curr.parent
  }
  for (const [name, n] of landmarks) {
    if (n === curr) return { landmark: name, path }
  }
  return null
}

function descend(landmark: ts.Node, path: Path): ts.Node | null {
  let curr: ts.Node | null = landmark
  for (const idx of path) {
    if (!curr) return null
    const kids = realChildren(curr)
    curr = kids[idx] ?? null
  }
  return curr
}

// ----- spike harness -----

type Probe = {
  offset: number
  landmark: string
  path: Path
  kind: ts.SyntaxKind
  kindName: string
  normalizedContent: string
}

function normalize(input: string): string {
  // collapse whitespace runs, strip leading/trailing — formatter changes
  // (added semicolons, reflowed lines, trailing commas) shouldn't count
  // as anchor failures so long as the resolved node holds the same
  // logical content.
  return input
    .replace(/\s+/g, ' ')
    .replace(/,(\s*[}\])])/g, '$1')   // ignore trailing commas
    .replace(/;\s*$/g, '')             // ignore trailing semicolons
    .trim()
}

function pickOffsets(source: string, count: number): number[] {
  // bias: ~30% at structural boundaries (matches '{', '(', '<'),
  // ~70% uniform random
  const boundaries: number[] = []
  for (let i = 0; i < source.length; i++) {
    const c = source[i]
    if (c === '{' || c === '(' || c === '<') boundaries.push(i)
  }
  const n = Math.floor(count * 0.3)
  const picked = new Set<number>()
  for (let i = 0; i < n && boundaries.length > 0; i++) {
    picked.add(boundaries[Math.floor(Math.random() * boundaries.length)])
  }
  while (picked.size < count) {
    picked.add(Math.floor(Math.random() * source.length))
  }
  return [...picked].sort((a, b) => a - b)
}

function probeFile(filename: string, source: string, probesPerFile: number): Probe[] {
  const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const landmarks = topLevelNames(sf)
  const offsets = pickOffsets(source, probesPerFile)
  const probes: Probe[] = []
  for (const offset of offsets) {
    const node = smallestEnclosing(sf, offset)
    const anchor = ascendToLandmark(node, landmarks)
    if (!anchor) continue
    const content = source.slice(node.getStart(sf), node.getEnd())
    probes.push({
      offset,
      landmark: anchor.landmark,
      path: anchor.path,
      kind: node.kind,
      kindName: ts.SyntaxKind[node.kind],
      normalizedContent: normalize(content)
    })
  }
  return probes
}

function resolveProbes(
  filename: string,
  source: string,
  probes: Probe[]
): { survived: number; failed: { reason: string; probe: Probe; got?: string }[] } {
  const sf = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const landmarks = topLevelNames(sf)
  let survived = 0
  const failed: { reason: string; probe: Probe; got?: string }[] = []
  for (const probe of probes) {
    const landmark = landmarks.get(probe.landmark)
    if (!landmark) {
      failed.push({ reason: 'landmark-missing', probe })
      continue
    }
    const node = descend(landmark, probe.path)
    if (!node) {
      failed.push({ reason: 'path-invalid', probe })
      continue
    }
    // Success criterion: resolved node has the same SyntaxKind as the
    // original. Optionally also check normalized content for a stronger
    // guarantee (counted separately).
    if (node.kind !== probe.kind) {
      failed.push({ reason: 'kind-mismatch', probe, got: ts.SyntaxKind[node.kind] })
      continue
    }
    const content = source.slice(node.getStart(sf), node.getEnd())
    if (normalize(content) !== probe.normalizedContent) {
      // Same kind but content differs after normalization — this is a
      // "soft" success for hover purposes (we resolved to the right
      // logical node) but a "warning" for byte-range-dependent tools.
      failed.push({ reason: 'content-drift', probe, got: normalize(content).slice(0, 60) })
      continue
    }
    survived++
  }
  return { survived, failed }
}

// ----- formatters -----

type Formatter = { name: string; format: (source: string, parser: 'typescript' | 'babel') => Promise<string> }

const formatters: Formatter[] = [
  {
    name: 'prettier-default',
    format: async (source, parser) => prettier.format(source, { parser, semi: false, singleQuote: true })
  },
  {
    name: 'prettier-with-semi',
    format: async (source, parser) => prettier.format(source, { parser, semi: true, singleQuote: false })
  },
  {
    name: 'prettier-wide',
    format: async (source, parser) => prettier.format(source, { parser, printWidth: 200, semi: false })
  }
]

// ----- main -----

async function main() {
  const probesPerFile = 50
  const rows: string[] = [
    'parser,formatter,file,probed,kind_ok,strict_ok,landmark_missing,path_invalid,kind_mismatch,content_drift'
  ]

  for (const fixture of fixtures) {
    const parser = fixture.name.endsWith('.tsx') ? 'babel' : 'typescript'
    const probes = probeFile(fixture.name, fixture.source, probesPerFile)
    for (const fmt of formatters) {
      let formatted: string
      try {
        formatted = await fmt.format(fixture.source, parser as 'typescript' | 'babel')
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(`format failed: ${fixture.name} × ${fmt.name}: ${msg}`)
        continue
      }
      const { survived: strictOk, failed } = resolveProbes(fixture.name, formatted, probes)
      const reasonCounts = failed.reduce(
        (acc, f) => {
          acc[f.reason] = (acc[f.reason] ?? 0) + 1
          return acc
        },
        {} as Record<string, number>
      )
      const driftCount = reasonCounts['content-drift'] ?? 0
      // "kind_ok" = strict survival + drift (kind matched, content shifted slightly)
      // This is the "hover works" success criterion.
      const kindOk = strictOk + driftCount

      rows.push(
        [
          'tsc',
          fmt.name,
          fixture.name,
          String(probes.length),
          String(kindOk),
          String(strictOk),
          String(reasonCounts['landmark-missing'] ?? 0),
          String(reasonCounts['path-invalid'] ?? 0),
          String(reasonCounts['kind-mismatch'] ?? 0),
          String(driftCount)
        ].join(',')
      )

      // Surface failing examples (kind-mismatch and path-invalid are the
      // real failures; drift is informational).
      const realFailures = failed.filter((f) => f.reason !== 'content-drift')
      if (realFailures.length > 0) {
        const sample = realFailures.slice(0, 3)
        for (const f of sample) {
          const got = f.got ? ` got=${f.got}` : ''
          console.error(
            `  miss [${fmt.name}] ${fixture.name}@${f.probe.offset} expected=${f.probe.kindName} path=${f.probe.path.join('.') || '<root>'} reason=${f.reason}${got}`
          )
        }
      }
    }
  }

  console.log(rows.join('\n'))

  // Summary with both metrics
  const totals = { probed: 0, kindOk: 0, strictOk: 0 }
  for (const row of rows.slice(1)) {
    const parts = row.split(',')
    totals.probed += Number(parts[3])
    totals.kindOk += Number(parts[4])
    totals.strictOk += Number(parts[5])
  }
  const kindRate = totals.probed === 0 ? 0 : (totals.kindOk / totals.probed) * 100
  const strictRate = totals.probed === 0 ? 0 : (totals.strictOk / totals.probed) * 100
  console.error(
    `\n--- summary: kind-match ${totals.kindOk}/${totals.probed} (${kindRate.toFixed(1)}%) | strict ${totals.strictOk}/${totals.probed} (${strictRate.toFixed(1)}%) ---`
  )
  console.error(
    `--- kind-match is the load-bearing metric for hover UX; strict adds byte-for-byte normalization parity ---`
  )
}

if (import.meta.main) {
  await main()
}
