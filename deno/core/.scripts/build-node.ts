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
    { name: './Preview', path: './types/Preview.ts' },
    { name: './EnrichmentRequest', path: './types/EnrichmentRequest.ts' }
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
    scripts: {
      test: 'exit 0'
    },
    dependencies: {
      '@hono/zod-openapi': '^0.18.3'
    },
    devDependencies: {
      '@types/lodash-es': '4.17.12'
    }
  }
})
