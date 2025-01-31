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
import { OperationPreview } from '@skmtc/core/Preview'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useArtifacts } from '@/components/artifacts-context'
import { useState } from 'react'
import { InputConfigForm } from '@/components/config/input-config-form'
import { get } from 'lodash'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { SchemaItem } from '@/components/config/types'

type InputConfigProps = {
  schemaItem: SchemaItem
  source: OperationPreview
} & React.ComponentProps<typeof Sidebar>

export function InputConfig({ schemaItem, source, ...props }: InputConfigProps) {
  const { state: artifactsState, dispatch } = useArtifacts()
  const [open, setOpen] = useState(true)

  const { generatorId, operationPath, operationMethod } = source
  const { enrichments } = artifactsState

  const optionLabel = get(enrichments, [generatorId, operationPath, operationMethod, 'optionLabel'])

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel className="uppercase">Option label</SidebarGroupLabel>
        {/* <SidebarGroupAction title="Add column" disabled={open} onClick={() => setOpen(true)}>
          <Plus /> <span className="sr-only">Add column</span>
        </SidebarGroupAction> */}
        <SidebarGroupContent>
          {open ? (
            <InputConfigForm close={() => setOpen(false)} schemaItem={schemaItem} source={source} />
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild>
                  <span>Label</span>
                </SidebarMenuButton>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <SidebarMenuAction>
                      <MoreHorizontal />
                    </SidebarMenuAction>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start">
                    <DropdownMenuItem disabled={true}>
                      <span>Edit input option</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}
