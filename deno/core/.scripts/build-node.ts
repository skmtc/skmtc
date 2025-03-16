import { build, emptyDir } from 'jsr:@deno/dnt@0.41.3'
import denoJson from '../deno.json' with { type: 'json' }

await emptyDir('../../packages/core')

await build({
  entryPoints: [
    './mod.ts',
    { name: './Brand', path: './types/Brand.ts' },
    { name: './GeneratorKeys', path: './types/GeneratorKeys.ts' },
    { name: './Manifest', path: './types/Manifest.ts' },
    { name: './Method', path: './types/Method.ts' },
    { name: './RefName', path: './types/RefName.ts' },
    { name: './Results', path: './types/Results.ts' },
    { name: './toResolvedArtifactPath', path: './helpers/toResolvedArtifactPath.ts' },
    { name: './strings', path: './helpers/strings.ts' },
    { name: './Settings', path: './types/Settings.ts' },
    { name: './refFns', path: './helpers/refFns.ts' },
    { name: './Preview', path: './types/Preview.ts' },
    { name: './EnrichmentRequest', path: './types/EnrichmentRequest.ts' },
    { name: './SchemaItem', path: './types/SchemaItem.ts' },
    { name: './ParseContext', path: './context/ParseContext.ts' },
    { name: './StackTrail', path: './context/StackTrail.ts' },
    { name: './OasDocument', path: './oas/document/Document.ts' },
    { name: './OasInfo', path: './oas/info/Info.ts' },
    { name: './OasServer', path: './oas/server/Server.ts' },
    { name: './OasOperation', path: './oas/operation/Operation.ts' },
    { name: './OasComponents', path: './oas/components/Components.ts' },
    { name: './OasTag', path: './oas/tag/Tag.ts' },
    { name: './OasSchema', path: './oas/schema/Schema.ts' },
    { name: './OasComponents', path: './oas/components/Components.ts' },
    { name: './OasRef', path: './oas/ref/Ref.ts' },
    { name: './OasNumber', path: './oas/number/Number.ts' },
    { name: './OasInteger', path: './oas/integer/Integer.ts' },
    { name: './OasString', path: './oas/string/String.ts' },
    { name: './OasBoolean', path: './oas/boolean/Boolean.ts' },
    { name: './OasObject', path: './oas/object/Object.ts' },
    { name: './OasArray', path: './oas/array/Array.ts' },
    { name: './SchemaOptions', path: './types/SchemaOptions.ts' }
  ],
  outDir: '../../packages/core',
  test: false,
  packageManager: 'yarn',
  compilerOptions: {
    lib: ['DOM', 'ESNext']
  },
  shims: {
    // see JS docs for overview and more options
    deno: true
  },
  package: {
    // package.json properties
    name: '@skmtc/core',
    version: denoJson.version,
    rootDir: './',
    scripts: {
      test: 'exit 0'
    },
    dependencies: {
      '@hono/zod-openapi': '^0.18.3',
      'zod-to-json-schema': '^3.24.3'
    },
    devDependencies: {
      '@types/lodash-es': '4.17.12',
      'openapi-types': '12.1.3'
    }
  }
})
