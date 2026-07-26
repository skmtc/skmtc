import { assertEquals } from '@std/assert'
import { isGeneratorSource } from './target.ts'

Deno.test('target: generator source under a project .skmtc tree is in scope', () => {
  assertEquals(isGeneratorSource('/root/.skmtc/lab/gen-thing/src/Value.ts'), true)
  assertEquals(isGeneratorSource('/root/.skmtc/lab/gen-thing/mod.ts'), true)
  assertEquals(isGeneratorSource('/root/skmtc-generators/gen-zod/src/ZodObject.tsx'), true)
})

Deno.test('target: tests and the trees that legitimately break the rules are out of scope', () => {
  assertEquals(isGeneratorSource('/gen-thing/src/Value.test.ts'), false)
  assertEquals(isGeneratorSource('/gen-thing/src/Value.spec.tsx'), false)
  assertEquals(isGeneratorSource('/gen-thing/src/Value.bench.ts'), false)
  assertEquals(isGeneratorSource('/gen-thing/demo/run.ts'), false)
  assertEquals(isGeneratorSource('/gen-thing/scripts/seed.ts'), false)
  assertEquals(isGeneratorSource('/gen-thing/examples/basic.ts'), false)
  assertEquals(isGeneratorSource('/gen-thing/node_modules/x/index.ts'), false)
})

Deno.test('target: a generator own dot-directories are out of scope, .skmtc is not', () => {
  assertEquals(isGeneratorSource('/root/gen-thing/.scripts/generate.ts'), false)
  assertEquals(isGeneratorSource('/root/gen-thing/.github/build.ts'), false)
  assertEquals(isGeneratorSource('file:///root/.skmtc/lab/gen-thing/src/Value.ts'), true)
})

Deno.test('target: a directory whose name merely contains an excluded word stays in scope', () => {
  assertEquals(isGeneratorSource('/root/kotlin-demos/gen-thing/src/Value.ts'), true)
  assertEquals(isGeneratorSource('/root/gen-thing/src/testing.ts'), true)
})
