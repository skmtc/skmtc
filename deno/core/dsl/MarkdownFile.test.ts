import { assertEquals, assertInstanceOf } from '@std/assert'
import { MarkdownFile } from '@/dsl/MarkdownFile.ts'
import { toGenerateContext } from '@/test/toGenerateContext.ts'

Deno.test('MarkdownFile - renders string content verbatim', () => {
  const file = new MarkdownFile({ path: '@/docs/Pet.generated.md', content: '# Pet' })

  assertEquals(file.toString(), '# Pet')
  assertEquals(file.fileType, 'markdown')
})

Deno.test('MarkdownFile - renders a Stringable content through toString', () => {
  const content = { toString: () => '## Heading\n\nBody' }
  const file = new MarkdownFile({ path: '@/docs/Pet.generated.md', content })

  assertEquals(file.toString(), '## Heading\n\nBody')
})

Deno.test('registerMarkdown - creates a MarkdownFile at the destination', () => {
  const context = toGenerateContext()

  context.registerMarkdown({ destinationPath: '@/docs/Pet.generated.md', markdown: '# Pet' })

  const file = context.getFile('@/docs/Pet.generated.md')
  assertInstanceOf(file, MarkdownFile)
  assertEquals(file.toString(), '# Pet')
})

Deno.test('registerMarkdown - replaces existing content (last write wins)', () => {
  const context = toGenerateContext()

  context.registerMarkdown({ destinationPath: '@/docs/Pet.generated.md', markdown: '# First' })
  context.registerMarkdown({ destinationPath: '@/docs/Pet.generated.md', markdown: '# Second' })

  const file = context.getFile('@/docs/Pet.generated.md')
  assertInstanceOf(file, MarkdownFile)
  assertEquals(file.toString(), '# Second')
})
