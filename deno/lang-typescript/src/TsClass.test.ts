import { assertEquals, assertStringIncludes } from '@std/assert'
import { GenerateContext, OasDocument } from '@skmtc/core'
import type { GenerateContextType } from '@skmtc/core'
import * as log from 'jsr:@std/log@0.224/logger'
import { TsClass, TsConstructor, TsMethod, TsProperty } from './TsClass.ts'
import { TsHeritage, type TsHeritageSymbol } from './TsHeritage.ts'
import { TsDefinition } from './TsDefinition.ts'
import { createClass } from './createIdentifier.ts'

// Minimal mock context — TsClass is a pure renderer; only TsDefinition (used in
// the byte-exact case below) takes a context, and it never touches it here.
const mockContext = {} as GenerateContextType

// A real registering context — mirrors core/test/toGenerateContext.ts. The
// heritage entity ({@link TsHeritage}) is a TsSnippet, so constructing it needs a
// context (and lets us inspect its registered imports in a genuine TsFile).
const toContext = () =>
  new GenerateContext({
    document: { type: 'oas', value: new OasDocument() },
    settings: undefined,
    logger: new log.Logger('test', 'ERROR'),
    captureCurrentResult: () => {},
    toGeneratorConfigMap: () => ({})
  })

// ─── Member renderers (pure Stringables) ─────────────────────────────────────

Deno.test('TsProperty renders the modifier matrix', async testContext => {
  const cases = [
    {
      name: 'typed + initializer (sub-resource property)',
      property: new TsProperty({
        name: 'transcriptions',
        type: 'TranscriptionsAPI.Transcriptions',
        value: 'new TranscriptionsAPI.Transcriptions(this._client)'
      }),
      expected:
        'transcriptions: TranscriptionsAPI.Transcriptions = new TranscriptionsAPI.Transcriptions(this._client);'
    },
    {
      name: 'typed, no initializer',
      property: new TsProperty({ name: 'apiKey', type: 'string | null' }),
      expected: 'apiKey: string | null;'
    },
    {
      name: 'private',
      property: new TsProperty({ name: 'fetch', type: 'Fetch', accessibility: 'private' }),
      expected: 'private fetch: Fetch;'
    },
    {
      name: 'protected + optional',
      property: new TsProperty({
        name: 'idempotencyHeader',
        type: 'string',
        optional: true,
        accessibility: 'protected'
      }),
      expected: 'protected idempotencyHeader?: string;'
    },
    {
      name: 'static + readonly + value',
      property: new TsProperty({
        name: 'DEFAULT_TIMEOUT',
        value: '600000',
        static: true,
        readonly: true
      }),
      expected: 'static readonly DEFAULT_TIMEOUT = 600000;'
    },
    {
      name: 'with JSDoc',
      property: new TsProperty({ name: 'id', type: 'string', description: 'The identifier.' }),
      expected: '/**\n * The identifier.\n */\nid: string;'
    }
  ]

  for (const testCase of cases) {
    await testContext.step(testCase.name, () => {
      assertEquals(testCase.property.toString(), testCase.expected)
    })
  }
})

Deno.test('TsMethod renders signature + body', async testContext => {
  await testContext.step('body + return type', () => {
    const method = new TsMethod({
      name: 'retrieve',
      parameters: ['model: string', 'options?: RequestOptions'],
      returnType: 'APIPromise<Model>',
      body: 'return this._client.get(model, options);'
    })

    assertEquals(
      method.toString(),
      'retrieve(model: string, options?: RequestOptions): APIPromise<Model> {return this._client.get(model, options);}'
    )
  })

  await testContext.step('empty body collapses to {}', () => {
    const method = new TsMethod({ name: 'noop' })
    assertEquals(method.toString(), 'noop() {}')
  })

  await testContext.step('async + accessibility', () => {
    const method = new TsMethod({
      name: 'load',
      async: true,
      accessibility: 'protected',
      returnType: 'Promise<void>',
      body: 'await this.ready;'
    })

    assertEquals(method.toString(), 'protected async load(): Promise<void> {await this.ready;}')
  })

  await testContext.step('with JSDoc', () => {
    const method = new TsMethod({
      name: 'list',
      returnType: 'Page<Item>',
      body: 'return this._client.getAPIList();',
      description: 'Lists everything.'
    })

    assertEquals(
      method.toString(),
      '/**\n * Lists everything.\n */\nlist(): Page<Item> {return this._client.getAPIList();}'
    )
  })
})

Deno.test('TsConstructor renders constructor(params) { body }', () => {
  const classConstructor = new TsConstructor({
    parameters: ['client: Client'],
    body: 'super(client);'
  })

  assertEquals(classConstructor.toString(), 'constructor(client: Client) {super(client);}')
})

// ─── Dedup (first-write-wins, mirroring TsFile) ──────────────────────────────

Deno.test('TsClass dedups properties + methods by name; the constructor comes from args', () => {
  const tsClass = new TsClass({
    heritage: new TsHeritage({
      context: toContext(),
      destinationPath: '@/x.generated.ts',
      extends: { name: 'APIResource', exportPath: '../core/resource' }
    }),
    classConstructor: new TsConstructor({ body: 'super();' })
  })

  tsClass.addMethod(new TsMethod({ name: 'list', body: 'return 1;' }))
  tsClass.addMethod(new TsMethod({ name: 'list', body: 'return 2;' })) // same name → dropped
  tsClass.addProperty(new TsProperty({ name: 'speech', type: 'Speech' }))
  tsClass.addProperty(new TsProperty({ name: 'speech', type: 'Other' })) // same name → dropped

  assertEquals(tsClass.methods.size, 1)
  assertEquals(tsClass.properties.size, 1)
  assertEquals(tsClass.methods.get('list')?.toString(), 'list() {return 1;}')
  assertEquals(tsClass.properties.get('speech')?.toString(), 'speech: Speech;')
  assertEquals(tsClass.classConstructor?.toString(), 'constructor() {super();}')
})

Deno.test('TsClass arranges members properties → constructor → methods, newline-joined', () => {
  const context = toContext()
  const tsClass = new TsClass({
    heritage: new TsHeritage({
      context,
      destinationPath: '@/x.generated.ts',
      extends: { name: 'Base', exportPath: '@/base.ts' },
      implements: [{ name: 'Closeable', exportPath: '@/closeable.ts' }]
    }),
    classConstructor: new TsConstructor({ body: 'super();' })
  })
  tsClass.addMethod(new TsMethod({ name: 'go', body: 'run();' }))
  tsClass.addProperty(new TsProperty({ name: 'ready', type: 'boolean', value: 'false' }))

  // Members placed in declaration order, no indentation. Properties flush; the
  // constructor and each method are blank-line separated (note 42 Finding 1).
  assertEquals(
    tsClass.toString(),
    'extends Base implements Closeable {\n' +
      'ready: boolean = false;\n' +
      '\n' +
      'constructor() {super();}\n' +
      '\n' +
      'go() {run();}\n' +
      '}'
  )
})

Deno.test('TsClass with no members renders empty braces (the formatter collapses the gap)', () => {
  const context = toContext()
  assertEquals(
    new TsClass({
      heritage: new TsHeritage({
        context,
        destinationPath: '@/x.generated.ts',
        extends: { name: 'APIResource', exportPath: '../core/resource' }
      })
    }).toString(),
    'extends APIResource {\n\n}'
  )
  assertEquals(new TsClass().toString(), '{\n\n}')
})

// ─── TsHeritage: renders both clauses + registers their imports ───────────────

Deno.test('TsHeritage renders the extends + implements clauses', () => {
  const context = toContext()
  const destinationPath = '@/x.generated.ts'
  // Same-file symbols (exportPath === destinationPath) so the render check has
  // no import side effects.
  const here = (name: string) => ({ name, exportPath: destinationPath })
  const render = (clauses: { extends?: TsHeritageSymbol; implements?: TsHeritageSymbol[] }) =>
    new TsHeritage({ context, destinationPath, ...clauses }).toString()

  assertEquals(
    render({ extends: here('Base'), implements: [here('A'), here('B')] }),
    'extends Base implements A, B '
  )
  // Either clause alone, or none.
  assertEquals(render({ extends: here('Base') }), 'extends Base ')
  assertEquals(render({ implements: [here('A')] }), 'implements A ')
  assertEquals(render({}), '')
})

Deno.test('TsHeritage imports symbols from other files, skips same-file ones', () => {
  const context = toContext()
  const destinationPath = '@/resources/models.generated.ts'

  new TsHeritage({
    context,
    destinationPath,
    extends: { name: 'APIResource', exportPath: '../core/resource' }, // other file → value import
    implements: [
      { name: 'Closeable', exportPath: '@/lifecycle' }, // other file → type-only import
      { name: 'LocalMixin', exportPath: destinationPath } // same file → in scope, no import
    ]
  })

  const file = context.getFile(destinationPath)?.toString() ?? ''
  assertStringIncludes(file, "import {APIResource} from '../core/resource'")
  assertStringIncludes(file, "import type {Closeable} from '@/lifecycle'")
  assertEquals(file.includes('LocalMixin'), false) // same-file symbol was not imported
})

// ─── SDK corpus: OpenAI (openai-node) byte-exact ─────────────────────────────
// Pinned against the real Stainless output in
// `skmtc-root/openai-node/src/resources/...`. The descriptions arrive
// pre-wrapped at 80 columns (the generator's `toJsDoc` job); the bodies are
// passed verbatim. The class's imports are the generator's concern (registered
// into the TsFile separately) — TsClass renders the declaration.

Deno.test('OpenAI: the Models resource class is byte-exact (resources/models.ts)', () => {
  const tsClass = new TsClass({
    heritage: new TsHeritage({
      context: toContext(),
      destinationPath: '@/resources/models.generated.ts',
      extends: { name: 'APIResource', exportPath: '../core/resource' }
    })
  })

  tsClass.addMethod(
    new TsMethod({
      name: 'retrieve',
      parameters: ['model: string', 'options?: RequestOptions'],
      returnType: 'APIPromise<Model>',
      body: 'return this._client.get(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });',
      description:
        'Retrieves a model instance, providing basic information about the model such as\n' +
        'the owner and permissioning.'
    })
  )
  tsClass.addMethod(
    new TsMethod({
      name: 'list',
      parameters: ['options?: RequestOptions'],
      returnType: 'PagePromise<ModelsPage, Model>',
      body: "return this._client.getAPIList('/models', Page<Model>, { ...options, __security: { bearerAuth: true } });",
      description:
        'Lists the currently available models, and provides basic information about each\n' +
        'one such as the owner and availability.'
    })
  )
  tsClass.addMethod(
    new TsMethod({
      name: 'delete',
      parameters: ['model: string', 'options?: RequestOptions'],
      returnType: 'APIPromise<ModelDeleted>',
      body: 'return this._client.delete(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });',
      description:
        'Delete a fine-tuned model. You must have the Owner role in your organization to\n' +
        'delete a model.'
    })
  )

  const definition = new TsDefinition({
    context: mockContext,
    identifier: createClass('Models'),
    value: tsClass,
    description: 'List and describe the various models available in the API.'
  })

  // Unformatted: no indentation (members or bodies). Methods ARE blank-line
  // separated (Prettier won't insert those, so we must — note 42 Finding 1).
  // The consumer's formatter normalises the rest to match openai-node; JSDoc
  // gutters are comment syntax, not nesting.
  const expected = [
    '/**',
    ' * List and describe the various models available in the API.',
    ' */',
    'export class Models extends APIResource {',
    '/**',
    ' * Retrieves a model instance, providing basic information about the model such as',
    ' * the owner and permissioning.',
    ' */',
    'retrieve(model: string, options?: RequestOptions): APIPromise<Model> {return this._client.get(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });}',
    '',
    '/**',
    ' * Lists the currently available models, and provides basic information about each',
    ' * one such as the owner and availability.',
    ' */',
    "list(options?: RequestOptions): PagePromise<ModelsPage, Model> {return this._client.getAPIList('/models', Page<Model>, { ...options, __security: { bearerAuth: true } });}",
    '',
    '/**',
    ' * Delete a fine-tuned model. You must have the Owner role in your organization to',
    ' * delete a model.',
    ' */',
    'delete(model: string, options?: RequestOptions): APIPromise<ModelDeleted> {return this._client.delete(path`/models/${model}`, { ...options, __security: { bearerAuth: true } });}',
    '}',
    '' // TsDefinition's trailing newline
  ].join('\n')

  assertEquals(definition.toString(), expected)
})

Deno.test('OpenAI: the Audio sub-resource-properties class is byte-exact (resources/audio/audio.ts)', () => {
  const tsClass = new TsClass({
    heritage: new TsHeritage({
      context: toContext(),
      destinationPath: '@/resources/audio.generated.ts',
      extends: { name: 'APIResource', exportPath: '../core/resource' }
    })
  })

  tsClass.addProperty(
    new TsProperty({
      name: 'transcriptions',
      type: 'TranscriptionsAPI.Transcriptions',
      value: 'new TranscriptionsAPI.Transcriptions(this._client)'
    })
  )
  tsClass.addProperty(
    new TsProperty({
      name: 'translations',
      type: 'TranslationsAPI.Translations',
      value: 'new TranslationsAPI.Translations(this._client)'
    })
  )
  tsClass.addProperty(
    new TsProperty({
      name: 'speech',
      type: 'SpeechAPI.Speech',
      value: 'new SpeechAPI.Speech(this._client)'
    })
  )

  const expected = [
    'extends APIResource {',
    'transcriptions: TranscriptionsAPI.Transcriptions = new TranscriptionsAPI.Transcriptions(this._client);',
    'translations: TranslationsAPI.Translations = new TranslationsAPI.Translations(this._client);',
    'speech: SpeechAPI.Speech = new SpeechAPI.Speech(this._client);',
    '}'
  ].join('\n')

  assertEquals(tsClass.toString(), expected)
})
