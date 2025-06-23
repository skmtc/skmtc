import type { DenoFile } from '../deploy/types.ts'
import type { Manager } from './manager.ts'
import * as v from 'valibot'
import type { OpenApiSchema } from './openapi-schema.ts'
import type { ClientSettings } from '@skmtc/core/Settings'
import { PrettierConfigType } from '@skmtc/core/PrettierConfig'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'

const deploymentStatus = v.picklist(['pending', 'success', 'failed'])

const denoDeployment = v.object({
  id: v.string(),
  stackName: v.string(),
  projectId: v.string(),
  latestStatus: deploymentStatus,
  latestDeploymentId: v.string(),
  latestDenoDeploymentId: v.string(),
  accountName: v.string(),
  createdAt: v.string(),
  updatedAt: v.string()
})

const deploymentInfo = v.object({
  status: deploymentStatus
})

type DeployArgs = {
  assets: Record<string, DenoFile>
  accountName: string
  stackName: string
  generatorIds: string[]
}

export type CreateSchemaBody =
  | {
      type: 'url'
      sourceUrl: string
    }
  | {
      type: 'file'
      filePath: string
    }
  | {
      type: 'refs'
      openapiSchemaIds: string[]
    }

type GenerateArtifactsArgs = {
  workspaceId: string
}

type CreateSchemaArgs = {
  body: CreateSchemaBody
}

type UpdateSchemaArgs = {
  body: {
    id: string
    name?: string
    slug?: string
    schemaId?: string
    file: CreateSchemaBody
  }
}

type PatchWorkspaceByIdArgs = {
  workspaceId: string
  baseImage: Record<string, unknown>
}

export class ApiClient {
  manager: Manager

  constructor(manager: Manager) {
    this.manager = manager
  }

  async deploy({ assets, accountName, stackName, generatorIds }: DeployArgs) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `servers/${accountName}/${stackName}`,
      {
        method: 'POST',
        body: {
          assets,
          generatorIds
        }
      }
    )

    if (error) {
      throw new Error(`Failed to deploy stack`)
    }

    return v.parse(denoDeployment, data)
  }

  async getDeploymentInfo(deploymentId: string) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `/deployments/${deploymentId}/info`,
      {
        method: 'GET'
      }
    )

    if (error) {
      throw new Error(`Failed to deploy stack`)
    }

    return v.parse(deploymentInfo, data)
  }

  async uploadSchemaFile(openApiSchema: OpenApiSchema) {
    const session = await this.manager.auth.toSession()
    const path = `${session?.user.id}/${Date.now().toString()}`

    const fileName = openApiSchema.path.split('/').pop()

    const cacheControl = 3600
    const upsert = false

    const serverFilePath = `${path}/${fileName}`

    const { error } = await this.manager.auth.supabase.storage
      .from('api-schemas')
      .upload(serverFilePath, openApiSchema.contents, {
        cacheControl: cacheControl.toString(),
        upsert
      })

    if (error) {
      throw new Error(`Failed to upload schema file`, { cause: error })
    }

    return serverFilePath
  }

  async createSchema({ body }: CreateSchemaArgs) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(`schemas`, {
      method: 'POST',
      body
    })

    if (error) {
      throw await error.context.json()
    }

    return v.parse(v.array(schema), data)
  }

  async updateSchema({ body }: UpdateSchemaArgs) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `/schemas/${body.id}`,
      {
        method: 'PUT',
        body
      }
    )

    if (error) {
      console.log('ERROR', error.message)
      throw await error.context.json()
    }

    return v.parse(v.array(schema), data)
  }

  async getWorkspaces() {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(`workspaces`, {
      method: 'GET'
    })

    if (error) {
      throw new Error('Failed to get workspaces')
    }

    return data
  }

  async getWorkspaceById(workspaceId: string) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `workspaces/find?id=${workspaceId}`,
      {
        method: 'GET'
      }
    )

    if (error) {
      throw new Error('Failed to get workspace by id')
    }

    return data
  }

  async patchWorkspaceById({ workspaceId, baseImage }: PatchWorkspaceByIdArgs) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `workspaces/${workspaceId}`,
      {
        method: 'PATCH',
        body: { baseImage }
      }
    )

    if (error) {
      throw new Error('Failed to patch workspace by id')
    }

    return data
  }

  async generateArtifacts({ workspaceId }: GenerateArtifactsArgs) {
    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `/workspaces/${workspaceId}/artifacts`,
      {
        method: 'GET'
      }
    )

    if (error) {
      throw new Error('Failed to generate artifacts', { cause: error })
    }

    try {
      return v.parse(generateResponse, data)
    } catch (_error) {
      throw new Error('Failed to generate artifacts')
    }
  }
}

export const openApiVersion = v.picklist(['2.0', '3.0', '3.1'])
export type OpenApiVersion = v.InferOutput<typeof openApiVersion>

export const schemaFormat = v.picklist(['json', 'yaml'])
export type SchemaFormat = v.InferOutput<typeof schemaFormat>

export const schema = v.object({
  id: v.string(),
  schemaId: v.string(),
  name: v.string(),
  slug: v.string(),
  openapiVersion: openApiVersion,
  format: schemaFormat,
  iconKey: v.optional(v.nullable(v.string())),
  sourceUrl: v.optional(v.nullable(v.string())),
  filePath: v.optional(v.nullable(v.string())),
  createdAt: v.string()
})

export type Schema = {
  id: string
  schemaId: string
  name: string
  slug: string
  iconKey?: string | null | undefined
  openapiVersion: OpenApiVersion
  format: SchemaFormat
  sourceUrl?: string | null | undefined
  filePath?: string | null | undefined
  createdAt: string
}

export type GenerateResponse = {
  artifacts: Record<string, string>
  manifest: ManifestContent
}

export const generateResponse: v.GenericSchema<GenerateResponse> = v.object({
  artifacts: v.record(v.string(), v.string()),
  manifest: manifestContent
})
