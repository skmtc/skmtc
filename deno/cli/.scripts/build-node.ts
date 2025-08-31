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
  mappings: {
    // Map @std/fs move functionality to our Node.js implementation
    "https://jsr.io/@std/fs/1.0.19/move.ts": "./.scripts/fs-shim.ts"
  },
  scriptModule: false,
  package: {
    // package.json properties
    name: '@skmtc/cli',
    version: denoJson.version,
    type: 'module',
    rootDir: './',
    bin: {
      skmtc: './bin/skmtc.js'
    },
    scripts: {
      test: 'exit 0'
    },
    devDependencies: {
      '@types/lodash-es': '4.17.12',
      'openapi-types': '12.1.3',
      valibot: '1.1.0'
    },
    dependencies: {
      '@deno/shim-deno': '^0.19.2'
    }
  },
  postBuild() {
    // Copy bin script to the output directory
    const binDir = '../../packages/cli/bin'
    const binScript = '../../packages/cli/bin/skmtc.js'
    
    // Create bin directory
    Deno.mkdirSync(binDir, { recursive: true })
    
    // Copy and customize the bin script
    const binTemplate = Deno.readTextFileSync('./.scripts/bin-template.js')
    Deno.writeTextFileSync(binScript, binTemplate)
    
    // Make the bin script executable
    Deno.chmodSync(binScript, 0o755)
  }
})
