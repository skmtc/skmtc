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
    name: 'skmtc',
    version: denoJson.version,
    type: 'module',
    rootDir: './',
    bin: {
      skmtc: './bin/skmtc.js'
    },
    scripts: {
      test: 'exit 0'
    },
    repository: {
      type: 'git',
      url: 'https://github.com/skmtc/skmtc.git'
    },
    devDependencies: {
      '@types/lodash-es': '4.17.12',
      'openapi-types': '12.1.3',
      valibot: '1.1.0'
    },
    dependencies: {
      '@deno/shim-deno': '^0.19.2',
      '@deno/shim-timers': '^0.1.0'
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

    // Copy license and readme to output package
    const outputDir = '../../packages/cli'

    try {
      const licenseContent = Deno.readTextFileSync('LICENSE')
      Deno.writeTextFileSync(`${outputDir}/LICENSE`, licenseContent)
    } catch {
      console.warn('LICENSE file not found, skipping copy')
    }

    try {
      const readmeContent = Deno.readTextFileSync('README.md')
      Deno.writeTextFileSync(`${outputDir}/README.md`, readmeContent)
    } catch {
      console.warn('README.md file not found, skipping copy')
    }
  }
})
