import { Command } from '@cliffy/command'
import { resolve } from '@std/path'

export type FormFieldItem = {
  id: string
  accessorPath: string[]
  input: string
  label: string
  placeholder?: string
}

export type FormItem = {
  title: string
  fields: FormFieldItem[]
}

export type TableColumnItem = {
  id: string
  accessorPath: string[]
  formatter: string
  label: string
}

export type InputOptionConfigItem = {
  id: string
  accessorPath: string[]
  formatter: string
}

type OperationEnrichments = {
  columns: TableColumnItem[]
  form: FormItem
  optionLabel: InputOptionConfigItem
}

type MethodEnrichments = Record<string, OperationEnrichments>
type PathEnrichments = Record<string, MethodEnrichments>
export type GeneratorEnrichments = Record<string, PathEnrichments>

export const toGenerateCommand = () => {
  return (
    new Command()
      .description('Generate artifacts from OpenAPI schema')
      .arguments('[path]')
      .option('--oas <oas>', 'The OpenAPI schema to generate from')
      // .option('-s, --settings <settings>', 'The settings to use')
      // .option('-p, --prettier [prettier]', 'The prettier config to use')
      .action(async ({ oas }, path = './') => {
        if (!oas) {
          console.error('OAS is required')
          return
        }

        const pathToSchema = resolve(path, oas)

        const schema = await Deno.readTextFile(pathToSchema)

        await generate({ serverOrigin: 'https://doc-types-qkcgy8zw0kat.deno.dev', schema })
      })
  )
}

export const toGeneratePrompt = async () => {
  console.log('generate prompt')
}

type GenerateArgs = {
  serverOrigin: string
  // clientSettings: ClientSettings | undefined
  // prettier?: any
  schema: string
}

export const generate = async ({
  serverOrigin,
  // clientSettings,
  // prettier,
  schema
}: GenerateArgs) => {
  const response = await fetch(`${serverOrigin}/artifacts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ schema })
  })

  const data = await response.json()

  try {
    return data
  } catch (_error) {
    console.log('Failed to generate artifacts')
  }
}
