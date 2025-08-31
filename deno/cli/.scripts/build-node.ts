import { build, emptyDir } from 'jsr:@deno/dnt@0.42.3'
import denoJson from '../deno.json' with { type: 'json' }

await emptyDir('../../packages/cli')

await build({
  entryPoints: ['./mod.ts'],
  outDir: '../../packages/cli',
  test: false,
  packageManager: 'pnpm',
  compilerOptions: {
    lib: ['DOM', 'ESNext']
  },
  shims: {
    // see JS docs for overview and more options
    deno: true,
    timers: true
  },
  scriptModule: false,
  package: {
    // package.json properties
    name: '@skmtc/cli',
    version: denoJson.version,
    type: 'module',
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
