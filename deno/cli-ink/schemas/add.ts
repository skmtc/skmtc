import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import { Input, Select, Confirm } from '../components/index.ts'
import { ensureDir } from '@std/fs/ensure-dir'
import { resolve } from '@std/path/resolve'
import { match } from 'ts-pattern'
import { TspConfig } from './tsp-files/tsp-config.ts'
import { GitIgnore } from './tsp-files/gitignore.ts'
import { PackageJson } from './tsp-files/package-json.ts'
import { MainTsp } from './tsp-files/main-tsp.ts'

type SchemaSource = 'from-typespec' | 'from-remote-url' | 'from-local-openapi-file'

export const toSchemasCreatePrompt = async (skmtcRoot: SkmtcRoot) => {
  const source = await Select.prompt({
    message: 'Add an API schema',
    options: [
      { name: 'Create new TypeSpec schema', value: 'from-typespec' },
      { name: 'Create schema from remote url', value: 'from-remote-url' },
      { name: 'Create schema from local OpenAPI file', value: 'from-local-openapi-file' }
    ]
  })

  match(source).with('from-typespec', async () => {
    const tspVersion = toTspVersion()

    if (!tspVersion) {
      const confirmInstallTsp: boolean = await Confirm.prompt(
        'TypeSpec is not installed. Would you like to install it?'
      )

      if (!confirmInstallTsp) {
        throw new Error('TypeSpec is not installed')
      }

      installTsp()
    }

    const path = await Input.prompt({
      message: 'Where would you like to create the new TypeSpec schema?',
      suggestions: ['./']
    })

    const schemaName = await Input.prompt({
      message: 'What is the name of the new TypeSpec schema?'
    })

    await createTspConfig({ name: schemaName, path })
  })

  const projectName = await Input.prompt({
    message: 'Select project to upload schema to',
    list: true,
    suggestions: skmtcRoot.projects.map(({ name }) => name)
  })

  const path = await Input.prompt({
    message: 'Enter path to OpenAPI schema'
  })
}

const createTypeSpecSchema = async (path: string, schemaName: string) => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ['tsp', 'init', path, schemaName]
  })
}

const installTsp = () => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ['npm', 'install', '-g', '@typespec/compiler']
  })

  const { code, stderr } = command.outputSync()

  console.assert(code === 0)

  const error = new TextDecoder().decode(stderr)

  if (error) {
    throw new Error(error)
  }
}

type CreateTspConfigOptions = {
  name: string
  path: string
}

const createTspConfig = async ({ name, path }: CreateTspConfigOptions) => {
  const resolvedPath = resolve(Deno.cwd(), path)
  await ensureDir(resolvedPath)

  const tspConfig = new TspConfig()
  Deno.writeTextFile(resolve(resolvedPath, 'tspconfig.yaml'), tspConfig.toString())

  const gitIgnore = new GitIgnore()
  Deno.writeTextFile(resolve(resolvedPath, '.gitignore'), gitIgnore.toString())

  const packageJson = new PackageJson(name)
  Deno.writeTextFile(resolve(resolvedPath, 'package.json'), packageJson.toString())

  const mainTsp = new MainTsp(name)
  Deno.writeTextFile(resolve(resolvedPath, 'main.tsp'), mainTsp.toString())
}

const toTspVersion = (): string | null => {
  const command = new Deno.Command(Deno.execPath(), {
    args: ['tsp', '--version)']
  })

  const { code, stdout, stderr } = command.outputSync()

  console.assert(code === 0)

  const error = new TextDecoder().decode(stderr)

  if (error) {
    return null
  }

  const version = new TextDecoder().decode(stdout)

  return version
}
