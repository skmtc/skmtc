import * as React from 'react'
import { OpenAPIV3 } from 'openapi-types'
import { ColumnConfig, type ColumnConfigItem } from '@/components/column-config'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

type ArtifactConfigProps = {
  configSchema: OpenAPIV3.SchemaObject | null
  listItemName: string | null
}

export function ArtifactConfig({ configSchema, listItemName }: ArtifactConfigProps) {
  const [columns, setColumns] = useState<ColumnConfigItem[]>([])

  return (
    <>
      {columns.map((column, index) => (
        <ColumnConfig
          column={column}
          setColumn={value => {
            setColumns(prev => {
              if (value) {
                prev[index] = value
              } else {
                prev.splice(index, 1)
              }

              return prev
            })
          }}
          key={index}
          configSchema={configSchema}
          listItemName={listItemName}
        />
      ))}
      <Button
        variant="ghost"
        className="px-2 py-1 text-indigo-600 w-min"
        onClick={() => setColumns(prev => [...prev, { path: [], format: '', title: '' }])}
      >
        Add column
      </Button>
    </>
  )
}
