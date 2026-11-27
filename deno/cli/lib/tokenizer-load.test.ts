import { assertEquals } from '@std/assert/equals'
import { fromFileUrl } from '@std/path/from-file-url'

type GraphDependency = {
  specifier: string
  code?: { specifier: string }
  isDynamic?: boolean
}

type GraphModule = {
  specifier: string
  dependencies?: GraphDependency[]
}

type ModuleGraph = {
  modules: GraphModule[]
  redirects: Record<string, string>
}

const isModuleGraph = (value: unknown): value is ModuleGraph =>
  typeof value === 'object' &&
  value !== null &&
  'modules' in value &&
  Array.isArray(value.modules) &&
  'redirects' in value &&
  typeof value.redirects === 'object'

/** The module graph `deno info` reads from `root`, static and dynamic imports both. */
const toModuleGraph = async (root: string): Promise<ModuleGraph> => {
  const { success, stdout, stderr } = await new Deno.Command(Deno.execPath(), {
    args: [
      'info',
      '--json',
      '--config',
      fromFileUrl(import.meta.resolve('@/deno.json')),
      fromFileUrl(import.meta.resolve(root))
    ],
    stdout: 'piped',
    stderr: 'piped'
  }).output()

  if (!success) throw new Error(new TextDecoder().decode(stderr))

  const graph: unknown = JSON.parse(new TextDecoder().decode(stdout))
  if (!isModuleGraph(graph)) throw new Error('deno info returned no module graph')

  return graph
}

/**
 * Specifiers of the code `root` loads. With `followDynamic: false`, only the
 * static imports: what loading the module loads before any of it runs.
 */
const toLoadedSpecifiers = (
  graph: ModuleGraph,
  root: string,
  followDynamic: boolean
): Set<string> => {
  const modules = new Map(graph.modules.map(module => [module.specifier, module]))
  const resolve = (specifier: string) => graph.redirects[specifier] ?? specifier
  const rootSpecifier = import.meta.resolve(root)
  const loaded = new Set<string>([rootSpecifier])
  const pending = [rootSpecifier]

  while (pending.length > 0) {
    const specifier = pending.pop()
    if (specifier === undefined) break

    for (const dependency of modules.get(specifier)?.dependencies ?? []) {
      if (dependency.code === undefined) continue
      if (dependency.isDynamic && !followDynamic) continue

      const target = resolve(dependency.code.specifier)
      if (loaded.has(target)) continue

      loaded.add(target)
      pending.push(target)
    }
  }

  return loaded
}

const loadsTokenizer = (specifiers: Set<string>): boolean =>
  [...specifiers].some(specifier => specifier.includes('gpt-tokenizer'))

// The commands that print generation stats, and the modules that make them.
const roots = [
  '@/commands/generate-switch.ts',
  '@/commands/dev.ts',
  '@/lib/generate-local.ts',
  '@/lib/generate.ts',
  '@/lib/generationStats.ts'
]

for (const root of roots) {
  Deno.test(`${root} - loads gpt-tokenizer only through a dynamic import`, async () => {
    const graph = await toModuleGraph(root)

    assertEquals(loadsTokenizer(toLoadedSpecifiers(graph, root, false)), false)
  })
}

Deno.test('generationStats.ts - reaches gpt-tokenizer when dynamic imports are followed', async () => {
  // Shows the check above can see the tokenizer: the module still uses it.
  const root = '@/lib/generationStats.ts'
  const graph = await toModuleGraph(root)

  assertEquals(loadsTokenizer(toLoadedSpecifiers(graph, root, true)), true)
})
