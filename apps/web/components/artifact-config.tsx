import * as React from 'react'
import { OpenAPIV3 } from 'openapi-types'
import { ColumnConfig } from '@/components/column-config'
import { Button } from '@/components/ui/button'
import { SidebarGroupContent } from '@/components/ui/sidebar'
import { OperationPreview } from '@skmtc/core/Preview'
import { useArtifacts } from '@/components/artifacts/artifacts-context'

type ArtifactConfigProps = {
  configSchema: OpenAPIV3.SchemaObject | null
  listItemName: string | null
  source: OperationPreview
}

export function ArtifactConfig({ configSchema, listItemName, source }: ArtifactConfigProps) {
  const { state, dispatch } = useArtifacts()

  const { generatorId, operationPath, operationMethod } = source

  const sourcedEnrichments =
    state.enrichments[generatorId]?.[operationPath]?.[operationMethod] ?? []

  return (
    <>
      {sourcedEnrichments.map((sourcedEnrichment, index) => (
        <ColumnConfig
          column={sourcedEnrichment.enrichmentItem}
          setColumn={enrichmentItem => {
            const newEnrichments = [...sourcedEnrichments]
            newEnrichments[index] = { source, enrichmentItem }

            dispatch({
              type: 'set-enrichment',
              payload: {
                source,
                enrichmentItem: newEnrichments
              }
            })
          }}
          key={index}
          configSchema={configSchema}
          listItemName={listItemName}
        />
      ))}
      <SidebarGroupContent>
        <Button
          variant="ghost"
          className="h-auto px-2 py-1 text-indigo-600 w-min"
          onClick={() => {
            dispatch({
              type: 'set-enrichment',
              payload: {
                source,
                enrichmentItem: [
                  ...sourcedEnrichments,
                  { source, enrichmentItem: { accessorPath: [], formatter: '', label: '' } }
                ]
              }
            })
          }}
        >
          Add column
        </Button>
      </SidebarGroupContent>
    </>
  )
}
