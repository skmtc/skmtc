import { assert, assertEquals } from '@std/assert'
import * as log from 'jsr:@std/log@^0.224.0'
import { parse as parseYaml } from '@std/yaml'
import type { OpenAPIV3 } from 'openapi-types'
import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import { toDocumentObject } from '@/test/toDocumentObject.ts'

// OpenAPI 3.2 adds no schema-layer changes, so a 3.1 document relabelled
// `3.2.0` must parse through the v3-2 tree exactly as it parses through v3-1.
// Each fixture is parsed twice, once per version label, and the parsed
// documents and the error-level issues must be equal. Warning-level issues
// may differ. The later 3.2 tickets run this test as their regression check.

const readFixture = async (fileName: string): Promise<OpenAPIV3.Document> => {
  const text = await Deno.readTextFile(new URL(`../../_schemas/${fileName}`, import.meta.url))
  return toDocumentObject(fileName.endsWith('.json') ? JSON.parse(text) : parseYaml(text), fileName)
}

const parseAs = (documentObject: OpenAPIV3.Document, openapi: string) => {
  const context = new ParseContext({
    input: { type: 'oas', value: { ...structuredClone(documentObject), openapi } },
    logger: new log.Logger('test', 'ERROR'),
    silent: true
  })
  const result = context.parse(new StackTrail(['TEST']))
  assert(result.type === 'oas')

  // `openapi` is the input label and is expected to differ; every other
  // field must match.
  const { openapi: parsedVersion, ...document } = JSON.parse(JSON.stringify(result.value.toJSON()))
  const errors = context.issues
    .filter(issue => issue.level === 'error')
    .map(({ type, location, message }) => ({ type, location, message }))

  return { parsedVersion, document, errors, operationCount: result.value.operations.length }
}

const fixtures = [
  // `openapi: '3.1.0'` as published.
  'openrouter.yaml',
  // Labelled `openapi: 3.0.0` but uses 3.1 features (webhooks, `const`),
  // so the 3.1.0 label is its baseline.
  'remote-com.json'
]

for (const fileName of fixtures) {
  Deno.test(`version equivalence - ${fileName} parses the same as 3.1.0 and 3.2.0`, async () => {
    const documentObject = await readFixture(fileName)

    const asV31 = parseAs(documentObject, '3.1.0')
    const asV32 = parseAs(documentObject, '3.2.0')

    assertEquals(asV31.parsedVersion, '3.1.0')
    assertEquals(asV32.parsedVersion, '3.2.0')
    assert(asV31.operationCount > 0, `${fileName} parsed to no operations`)
    assertEquals(asV32.document, asV31.document)
    assertEquals(asV32.errors, asV31.errors)
  })
}
