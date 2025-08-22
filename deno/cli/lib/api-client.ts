import type { DenoFile } from '../deploy/types.ts'
import type { Manager } from './manager.ts'
import * as v from 'valibot'
import type { OpenApiSchema } from './openapi-schema.ts'
import { type ManifestContent, manifestContent } from '@skmtc/core/Manifest'
import { FunctionsHttpError } from '@supabase/supabase-js'

const deploymentStatus = v.picklist(['pending', 'success', 'failed'])

const denoDeployment = v.object({
  id: v.string(),
  stackName: v.string(),
  serverId: v.string(),
  latestStatus: deploymentStatus,
  latestDeploymentId: v.string(),
  latestDenoDeploymentId: v.string(),
  createdAt: v.string(),
  updatedAt: v.string()
})

const denoProject = v.object({
  id: v.nullable(v.string()),
  stackName: v.string(),
  serverId: v.string(),
  latestStatus: v.nullable(deploymentStatus),
  latestDeploymentId: v.nullable(v.string()),
  latestDenoDeploymentId: v.nullable(v.string()),
  createdAt: v.string(),
  updatedAt: v.string()
})

const hasServerWriteAccess = v.object({
  hasWriteAccess: v.boolean()
})

const deploymentInfo = v.object({
  status: deploymentStatus
})

type DeployArgs = {
  assets: Record<string, DenoFile>
  stackName: string
  generatorIds: string[]
}

type CreateDenoProjectArgs = {
  projectName: string
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

type GetArtifactsArgs = {
  workspaceId: string
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
  baseFiles: Record<string, unknown>
}

type UploadBaseFilesArgs = {
  workspaceId: string
  baseFiles: Record<string, unknown>
}

type UploadSchemaFileArgs = {
  openApiSchema: OpenApiSchema
  schemaId: string
}

export class ApiClient {
  manager: Manager

  constructor(manager: Manager) {
    this.manager = manager
  }

  async deploy({ assets, stackName, generatorIds }: DeployArgs) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(`servers`, {
      method: 'POST',
      body: {
        stackName,
        assets,
        generatorIds
      }
    })

    if (error) {
      console.log('ERROR', error)
      throw new Error(`Failed to deploy stack`)
    }

    return v.parse(denoDeployment, data)
  }

  async createDenoProject({ projectName }: CreateDenoProjectArgs) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(`servers`, {
      method: 'POST',
      body: { stackName: projectName }
    })

    if (error) {
      if (error instanceof FunctionsHttpError) {
        const errorMessage = await error.context.json()
        Object.entries(errorMessage?.validationErrors).forEach(([key, value]) => {
          console.error(`${key}: ${value}`)
        })
      }

      throw new Error(`Failed to deploy stack`)
    }

    return v.parse(denoProject, data)
  }

  async hasServerWriteAccess(projectName: string): Promise<{ hasWriteAccess: boolean }> {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `servers/${projectName}`,
      {
        method: 'GET'
      }
    )

    return v.parse(hasServerWriteAccess, data)
  }

  async getDeploymentInfo(deploymentId: string) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `deployments/${deploymentId}/info`,
      {
        method: 'GET'
      }
    )

    if (error) {
      console.log('ERROR', error)

      throw new Error(`Failed to deploy stack`)
    }

    return v.parse(deploymentInfo, data)
  }

  async uploadSchemaFile({ openApiSchema, schemaId }: UploadSchemaFileArgs) {
    await this.manager.auth.ensureAuth()

    const session = await this.manager.auth.toSession()

    const path = `${session?.user.id}/${schemaId}`

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
    await this.manager.auth.ensureAuth()

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
    await this.manager.auth.ensureAuth()

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
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(`workspaces`, {
      method: 'GET'
    })

    if (error) {
      throw new Error('Failed to get workspaces')
    }

    return data
  }

  async getSchemas() {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(`schemas`, {
      method: 'GET'
    })

    if (error) {
      throw new Error('Failed to get schemas')
    }

    return data
  }

  async getBuildLogs(denoDeploymentId: string) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `deployments/${denoDeploymentId}/deployment-logs`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      }
    )

    if (error) {
      throw new Error('Failed to get build logs')
    }

    // @ts-expect-error - TODO: fix this
    return data.filter(item => item?.level === 'error')
  }

  async getWorkspaceByName(workspaceName: string) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `workspaces/${workspaceName}`,
      {
        method: 'GET'
      }
    )

    if (error) {
      return null
    }

    return data
  }

  async getWorkspaceById(workspaceId: string) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `workspaces/find?id=${workspaceId}`,
      {
        method: 'GET'
      }
    )

    if (error) {
      console.log('Failed to get workspace by id')

      return null
    }

    return data
  }

  async patchWorkspaceById({ workspaceId, baseFiles }: PatchWorkspaceByIdArgs) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `workspaces/${workspaceId}`,
      {
        method: 'PATCH',
        body: { baseFiles }
      }
    )

    if (error) {
      throw new Error('Failed to patch workspace by id', {
        cause: error
      })
    }

    return data
  }

  async uploadBaseFiles({ workspaceId, baseFiles }: UploadBaseFilesArgs) {
    await this.manager.auth.ensureAuth()

    const session = await this.manager.auth.toSession()
    const path = `${session?.user.id}/${workspaceId}.json`

    const { error } = await this.manager.auth.supabase.storage
      .from('base-files')
      .upload(path, JSON.stringify(baseFiles), {
        upsert: true
      })

    if (error) {
      throw new Error('Failed to upload base files', { cause: error })
    }
  }

  async getArtifacts({ workspaceId }: GetArtifactsArgs) {
    await this.manager.auth.ensureAuth()

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

  async generateArtifacts({ workspaceId }: GenerateArtifactsArgs) {
    await this.manager.auth.ensureAuth()

    const { data, error } = await this.manager.auth.supabase.functions.invoke(
      `/workspaces/${workspaceId}/artifacts`,
      {
        method: 'POST'
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
  originalFilePath: v.string(),
  v3JsonFilePath: v.string(),
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
  originalFilePath: string
  v3JsonFilePath: string
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
