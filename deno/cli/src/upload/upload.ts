import { resolve } from '@std/path'
import { Command } from '@cliffy/command'
import { createSupabaseClient } from '../auth/supabase-client.ts'
import { uploadSchema, type CreateSchemaBody } from './upload-schema.ts'

export const toUploadCommand = () => {
  return new Command()
    .description('Upload a file to Codesquared')
    .arguments('[path]')
    .option('--oas <oas>', 'The OpenAPI schema to upload')

    .action(async ({ oas }, path = './') => {
      if (!oas) {
        console.error('OpenAPI schema file name is required')
        return
      }

      const pathToSchema = resolve(path, oas)

      const schema = await Deno.readTextFile(pathToSchema)

      await upload({ filePath: oas, schema })
    })
}

export const toUploadPrompt = async () => {
  console.log('Upload prompt')

  // const path = await Input.prompt({
  //   message: 'Enter path to .codesquared folder'
  // })

  // await upload(path)
}

type UploadArgs = {
  filePath: string
  schema: string
}

export const upload = async ({ filePath, schema }: UploadArgs) => {
  const kv = await Deno.openKv()
  const supabase = createSupabaseClient({ kv })

  const sessionRes = await supabase.auth.getSession()

  if (!sessionRes.data.session) {
    console.error('You are not logged in')
    return
  }

  const path = `${sessionRes.data.session.user.id}/${Date.now().toString()}`
  const fileName = filePath.split('/').pop()

  const cacheControl = 3600
  const upsert = false

  const serverFilePath = `${path}/${fileName}`

  const { error } = await supabase.storage.from('api-schemas').upload(serverFilePath, schema, {
    cacheControl: cacheControl.toString(),
    upsert
  })

  if (error) {
    console.error(error)
    return
  }

  const body: CreateSchemaBody = {
    type: 'file',
    filePath: serverFilePath
  }

  const res = await uploadSchema({ body })

  console.log(res)
}
