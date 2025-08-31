import { join } from '@std/path/join'

type AddSchemaArgs = {
  url: string
  name: string
}

type AddSchemaOptions = {
  logSuccess?: boolean
}

export const downloadAndCreateSchema = async (
  { url, name }: AddSchemaArgs,
  { logSuccess }: AddSchemaOptions = {}
) => {
  const fileName = new URL(url).pathname.split('/').pop()

  const fileType = fileName?.endsWith('.json')
    ? 'json'
    : fileName?.endsWith('.yaml') || fileName?.endsWith('.yml')
      ? 'yaml'
      : undefined

  if (!fileType) {
    throw new Error(`File type is not JSON or YAML: ${fileName}`)
  }

  const projectPath = join('.apifoundry', name)

  Deno.mkdirSync(projectPath, { recursive: true })

  const res = await fetch(url)

  const schema = await res.text()

  const destination = join(projectPath, `openapi.${fileType}`)

  Deno.writeTextFileSync(destination, schema)

  if (logSuccess) {
    console.log(`Schema created at ${destination}`)
  }
}
