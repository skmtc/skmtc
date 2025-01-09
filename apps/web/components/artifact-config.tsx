import * as React from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarSeparator
} from '@/components/ui/sidebar'
import { ChevronRightIcon } from '@radix-ui/react-icons'
import { PathInput } from '@/components/ui/path-input'
import { OpenAPIV3 } from 'openapi-types'
import { FormatterSelect } from '@/components/formatter-select'

type ArtifactConfigProps = {
  configSchema: OpenAPIV3.SchemaObject | null
}

export function ArtifactConfig({ configSchema }: ArtifactConfigProps) {
  const [selectedSchema, setSelectedSchema] = React.useState<OpenAPIV3.SchemaObject | null>(null)

  if (!configSchema) {
    return null
  }

  return (
    <React.Fragment>
      <SidebarGroup className="py-0">
        <Collapsible defaultOpen={true} className="group/collapsible">
          <SidebarGroupLabel
            asChild
            className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <CollapsibleTrigger>
              Columns
              <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <div className="flex flex-col gap-2">
                    <PathInput schema={configSchema} setSelectedSchema={setSelectedSchema} />
                    <FormatterSelect selectedSchema={selectedSchema} />
                  </div>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup>
      <SidebarSeparator className="mx-0" />
    </React.Fragment>
  )
}
