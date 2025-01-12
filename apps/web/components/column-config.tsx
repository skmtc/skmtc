import * as React from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem
} from '@/components/ui/sidebar'
import { ChevronRightIcon } from '@radix-ui/react-icons'
import { PathInput } from '@/components/ui/path-input'
import { OpenAPIV3 } from 'openapi-types'
import { FormatterSelect } from '@/components/formatter-select'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/standard-input'
import { standardInput } from '@/lib/classes'
import { useEffect } from 'react'
import { Controller, useForm } from 'react-hook-form'

type ColumnConfigProps = {
  configSchema: OpenAPIV3.SchemaObject | null
  listItemName: string | null
  column: ColumnConfigItem
  setColumn: (value: ColumnConfigItem) => void
}

export type ColumnConfigItem = {
  accessorPath: string[]
  formatter: string
  label: string
}

export function ColumnConfig({ configSchema, listItemName, column, setColumn }: ColumnConfigProps) {
  const [selectedSchema, setSelectedSchema] = React.useState<OpenAPIV3.SchemaObject | null>(null)
  const [open, setOpen] = React.useState<boolean>(true)
  const [focus, setFocus] = React.useState<boolean>(false)

  const { control, ...form } = useForm<ColumnConfigItem>({
    defaultValues: {
      accessorPath: column.accessorPath,
      formatter: column.formatter,
      label: column.label
    }
  })

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!focus) {
        setColumn(form.getValues())
      }
    }, 50)

    return () => clearTimeout(timeout)
  }, [focus])

  if (!configSchema) {
    return null
  }

  return (
    <SidebarGroup
      className="py-0"
      onFocusCapture={() => setFocus(true)}
      onBlurCapture={() => setFocus(false)}
    >
      <Collapsible
        defaultOpen={true}
        open={open}
        onOpenChange={setOpen}
        className="group/collapsible"
      >
        <SidebarGroupLabel
          asChild
          className="group/label w-full text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <CollapsibleTrigger>
            {column.label || 'New column'}
            <ChevronRightIcon className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <Separator className="my-1 mb-2" />
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <div className="flex flex-col gap-2">
                  <Controller
                    name="label"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-col gap-[2px]">
                        <label htmlFor="path-input" className="text-xs font-normal text-foreground">
                          Label
                        </label>
                        <Input className={standardInput} {...field} />
                      </div>
                    )}
                  />
                  <Controller
                    name="accessorPath"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-col gap-[2px]">
                        <label htmlFor="path-input" className="text-xs font-normal text-foreground">
                          Content
                        </label>
                        <PathInput
                          path={field.value}
                          setPath={field.onChange}
                          parentName={listItemName}
                          schema={configSchema}
                          setSelectedSchema={setSelectedSchema}
                        />
                      </div>
                    )}
                  />
                  <Controller
                    name="formatter"
                    control={control}
                    render={({ field }) => (
                      <div className="flex flex-col gap-[2px]">
                        <label htmlFor="path-input" className="text-xs font-normal text-foreground">
                          Format
                        </label>
                        <FormatterSelect
                          selectedSchema={selectedSchema}
                          value={field.value}
                          setValue={field.onChange}
                        />
                      </div>
                    )}
                  />
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  )
}
