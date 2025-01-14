import * as React from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { OpenAPIV3 } from 'openapi-types'
import { OperationPreview } from '@skmtc/core/Preview'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { useState } from 'react'
import { ColumnConfigForm } from '@/components/config/column-config-form'
import { get } from 'lodash'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SchemaItem } from '@/components/config/types'

type ColumnConfigProps = {
  schemaItem: SchemaItem
  source: OperationPreview
} & React.ComponentProps<typeof Sidebar>

export function ColumnConfig({ schemaItem, source, ...props }: ColumnConfigProps) {
  const { state: artifactsState, dispatch } = useArtifacts()
  const [open, setOpen] = useState(false)

  const { generatorId, operationPath, operationMethod } = source
  const { enrichments } = artifactsState

  const columnConfigs =
    get(enrichments, [generatorId, operationPath, operationMethod, 'columns']) ?? []

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel className="uppercase">Columns</SidebarGroupLabel>
        <SidebarGroupAction title="Add column" disabled={open} onClick={() => setOpen(true)}>
          <Plus /> <span className="sr-only">Add column</span>
        </SidebarGroupAction>
        <SidebarGroupContent>
          {open ? (
            <ColumnConfigForm
              close={() => setOpen(false)}
              schemaItem={schemaItem}
              source={source}
            />
          ) : (
            <SidebarMenu>
              {columnConfigs.map(({ accessorPath, label, formatter }, index) => {
                return (
                  <SidebarMenuItem key={`${accessorPath.join('.')}-${formatter}-${label}`}>
                    <SidebarMenuButton asChild>
                      <span>{label}</span>
                    </SidebarMenuButton>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction>
                          <MoreHorizontal />
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start">
                        <DropdownMenuItem disabled={true}>
                          <span>Edit column</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            dispatch({
                              type: 'delete-column-config',
                              payload: { source, index }
                            })
                          }}
                        >
                          <span>Delete column</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
