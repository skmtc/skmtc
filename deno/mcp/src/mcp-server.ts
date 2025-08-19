import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { parse } from 'jsr:@std/path'
import { ensureDir } from 'jsr:@std/fs'

const server = new McpServer({
  name: 'Skmtc MCP Server',
  version: '1.0.0'
})

server.tool(
  'create-supabase-api',
  'Tool to create a supabase api from an OpenAPI 3.0 schema',
  {
    url: z.string().describe('The url to an OpenAPI 3.0 schema file'),
    basePath: z.string().optional().describe('prefix path for generated artifacts')
  },
  async ({ url, basePath }) => {
    try {
      const schemaResponse = await fetch(url)

      if (!schemaResponse.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to fetch OpenAPI 3.0 schema`
            }
          ]
        }
      }

      const schema = await schemaResponse.text()

      const response = await fetch(`https://able-wolf-35-b7106jxb67k9.deno.dev/artifacts`, {
        method: 'POST',
        body: JSON.stringify({
          schema,
          clientSettings: {
            basePath
          }
        })
      })

      if (!response.ok) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to create supabase api: ${await response.text()}`
            }
          ]
        }
      }

      const data = await response.json()

      Object.entries(data.artifacts).forEach(async ([path, content]) => {
        const { dir } = parse(path)
        await ensureDir(dir)
        await Deno.writeTextFile(path, content as string, { create: true })
      })

      return {
        content: [
          {
            type: 'text',
            text: `Files generated: ${Object.keys(data.artifacts).join(', ')}`
          }
        ]
      }
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Error generating artifacts: ${error instanceof Error ? error.message : error}`
          }
        ]
      }
    }
  }
)

export default server
