import { Command } from '@cliffy/command'
import { Select } from '@cliffy/prompt'
import { getWorkspaces } from './get-workspaces.ts'
import { Input } from '@cliffy/prompt'
import { resolve } from '@std/path'
import { exists } from '@std/fs'
import { KeyObject } from 'node:crypto'
import { getWorkspaceById } from '../base-image/get-workspace-by-id.ts'

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

export const toWorkspacesSetCommand = () => {
  return (
    new Command()
      .description('Get list of workspaces')
      .arguments('[path]')
      // .option('-s, --settings <settings>', 'The settings to use')
      // .option('-p, --prettier [prettier]', 'The prettier config to use')
      .action(async (_args, path = './') => {
        const kv = await Deno.openKv()

        await setWorkspaceId({ kv, path })
      })
  )
}

export const toWorkspacesGetPrompt = async () => {
  const kv = await Deno.openKv()

  const path = await Input.prompt({
    message: 'Enter path to .codesquared folder'
  })

  const workspaceId = await getWorkspaceId({ kv, path })

  if (!workspaceId || typeof workspaceId !== 'string') {
    console.log('No workspace ID found')
    return
  }

  const workspace = await getWorkspaceById({ kv, workspaceId })

  console.log(`${workspace.name} (${workspace.id})`)
}

export const toWorkspacesGetCommand = () => {
  return (
    new Command()
      .description('Get workspace')
      .arguments('[path]')
      // .option('-s, --settings <settings>', 'The settings to use')
      // .option('-p, --prettier [prettier]', 'The prettier config to use')
      .action(async (_args, path = './') => {
        const kv = await Deno.openKv()

        const workspaceId = await getWorkspaceId({ kv, path })

        if (!workspaceId || typeof workspaceId !== 'string') {
          console.log('No workspace ID found')
          return
        }

        const workspace = await getWorkspaceById({ kv, workspaceId })

        console.log(`${workspace.name} (${workspace.id})`)
      })
  )
}

export const toWorkspacesSetPrompt = async () => {
  const kv = await Deno.openKv()

  const path = await Input.prompt({
    message: 'Enter path to .codesquared folder'
  })

  await setWorkspaceId({ kv, path })
}

type SetWorkspaceId = {
  kv: Deno.Kv
  path: string
}

const setWorkspaceId = async ({ kv, path }: SetWorkspaceId) => {
  const homePath = resolve(path, '.codesquared')

  const homePathExists = await exists(homePath)

  if (!homePathExists) {
    console.log(`Project folder "${homePath}" not found.`)
    return
  }

  const workspaces: { label: string; id: string }[] = await getWorkspaces(kv)

  const workspaceId: string = await Select.prompt({
    message: 'Select a workspace',
    options: workspaces.map(({ label, id }) => ({ name: label, value: id }))
  })

  await kv.set([homePath, 'workspaceId'], workspaceId)

  return workspaceId
}

type GetWorkspaceId = {
  kv: Deno.Kv
  path: string
}

export const getWorkspaceId = async ({ kv, path }: GetWorkspaceId) => {
  const homePath = resolve(path, '.codesquared')

  const homePathExists = await exists(homePath)

  if (!homePathExists) {
    console.log(`Project folder "${homePath}" not found.`)

    return
  }

  const workspaceId = await kv.get([homePath, 'workspaceId'])

  return workspaceId.value
}
