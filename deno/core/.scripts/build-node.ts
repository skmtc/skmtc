import { build, emptyDir } from 'jsr:@deno/dnt@0.42.3'
import denoJson from '../deno.json' with { type: 'json' }

await emptyDir('../../packages/core')

await build({
  entryPoints: [
    './mod.ts',
    { name: './Brand', path: './types/Brand.ts' },
    { name: './CustomValue', path: './types/CustomValue.ts' },
    { name: './Enrichments', path: './types/Enrichments.ts' },
    { name: './EnrichmentRequest', path: './types/EnrichmentRequest.ts' },
    { name: './GeneratorKeys', path: './types/GeneratorKeys.ts' },
    { name: './generationStats', path: './helpers/generationStats.ts' },
    { name: './isEmpty', path: './helpers/isEmpty.ts' },
    { name: './Manifest', path: './types/Manifest.ts' },
    { name: './Method', path: './types/Method.ts' },
    { name: './ModuleExport', path: './types/ModuleExport.ts' },
    { name: './OasArray', path: './oas/array/Array.ts' },
    { name: './OasBoolean', path: './oas/boolean/Boolean.ts' },
    { name: './OasComponents', path: './oas/components/Components.ts' },
    { name: './OasComponents', path: './oas/components/Components.ts' },
    { name: './OasDiscriminator', path: './oas/discriminator/Discriminator.ts' },
    { name: './OasDocument', path: './oas/document/Document.ts' },
    { name: './OasInfo', path: './oas/info/Info.ts' },
    { name: './OasInteger', path: './oas/integer/Integer.ts' },
    { name: './OasNumber', path: './oas/number/Number.ts' },
    { name: './OasObject', path: './oas/object/Object.ts' },
    { name: './OasOperation', path: './oas/operation/Operation.ts' },
    { name: './OasParameter', path: './oas/parameter/Parameter.ts' },
    { name: './OasRef', path: './oas/ref/Ref.ts' },
    { name: './OasRequestBody', path: './oas/requestBody/RequestBody.ts' },
    { name: './OasResponse', path: './oas/response/Response.ts' },
    { name: './OasSchema', path: './oas/schema/Schema.ts' },
    { name: './OasServer', path: './oas/server/Server.ts' },
    { name: './OasString', path: './oas/string/String.ts' },
    { name: './OasTag', path: './oas/tag/Tag.ts' },
    { name: './OasUnknown', path: './oas/unknown/Unknown.ts' },
    { name: './OasVoid', path: './oas/void/Void.ts' },
    { name: './ParseContext', path: './context/ParseContext.ts' },
    { name: './PrettierConfig', path: './types/PrettierConfig.ts' },
    { name: './Preview', path: './types/Preview.ts' },
    { name: './TypeSystem', path: './types/TypeSystem.ts' },
    { name: './refFns', path: './helpers/refFns.ts' },
    { name: './RefName', path: './types/RefName.ts' },
    { name: './Results', path: './types/Results.ts' },
    { name: './Settings', path: './types/Settings.ts' },
    { name: './StackTrail', path: './context/StackTrail.ts' },
    { name: './Stringable', path: './dsl/Stringable.ts' },
    { name: './collateExamples', path: './helpers/collateExamples.ts' },
    { name: './strings', path: './helpers/strings.ts' },
    { name: './formatNumber', path: './helpers/formatNumber.ts' },
    { name: './toResolvedArtifactPath', path: './helpers/toResolvedArtifactPath.ts' },
    { name: './validate', path: './app/validate.ts' },
    { name: './DenoJson', path: './types/DenoJson.ts' }
  ],
  outDir: '../../packages/core',
  test: false,
  packageManager: 'pnpm',
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
    devDependencies: {
      '@types/lodash-es': '4.17.12',
      'openapi-types': '12.1.3',
      valibot: '1.1.0'
    }
  }
})
