import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import server from './src/mcp-server.ts'

const transport = new StdioServerTransport()
server.connect(transport)
