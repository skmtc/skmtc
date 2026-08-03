import invariant from 'npm:tiny-invariant@^1.3.3'
import { toOasOperationEntry } from 'jsr:@skmtc/core@0.28.3'
import { toEnrichmentSchema, type EnrichmentSchema } from './enrichments.ts'
import { ClientClass } from './ClientClass.ts'
import denoJson from '../deno.json' with { type: 'json' }

export const entry = toOasOperationEntry<EnrichmentSchema>({
  id: denoJson.name,
  toEnrichmentSchema,
  transform: ({ context, operation, variant }) => {
    const enrichments = {}
    const clientName = ClientClass.toIdentifierName({ operation, enrichments, variant })
    const clientPath = ClientClass.toExportPath({ operation, enrichments, variant })

    const clientDef =
      context.findDefinition({ name: clientName, exportPath: clientPath }) ??
      context.insertOperation({ projection: ClientClass, operation, variant }).definition

    invariant(clientDef?.value instanceof ClientClass, 'client must be an instance of ClientClass')
    clientDef.value.append(operation)
  }
})

export { entry as default }
