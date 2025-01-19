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
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem
} from '@/components/ui/sidebar'
import { OperationPreview } from '@skmtc/core/Preview'
import { MoreHorizontal, Plus } from 'lucide-react'
import { useArtifacts } from '@/components/preview/artifacts-context'
import { useState } from 'react'
import { FormSectionForm } from '@/components/config/form-section-form'
import { get } from 'lodash'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { match } from 'ts-pattern'
import { FormFieldForm } from '@/components/config/form-field-form'
import { SchemaItem } from '@/components/config/types'

type FormConfigProps = {
  schemaItem: SchemaItem
  source: OperationPreview
} & React.ComponentProps<typeof Sidebar>

export function FormConfig({ schemaItem, source }: FormConfigProps) {
  const { state: artifactsState, dispatch } = useArtifacts()
  const [view, setView] = useState<'list' | 'form-section' | 'form-field'>('list')
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number>(0)

  const { generatorId, operationPath, operationMethod } = source
  const { enrichments } = artifactsState

  const formSections =
    get(enrichments, [generatorId, operationPath, operationMethod, 'formSections']) ?? []

  return (
    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel className="uppercase">Form sections</SidebarGroupLabel>
        <SidebarGroupAction
          title="Add form section"
          disabled={view === 'form-section' || view === 'form-field'}
          onClick={() => setView('form-section')}
        >
          <Plus /> <span className="sr-only">Add form section</span>
        </SidebarGroupAction>
        <SidebarGroupContent>
          {match(view)
            .with('form-field', () => (
              <FormFieldForm
                close={() => setView('list')}
                source={source}
                schemaItem={schemaItem}
                sectionIndex={selectedSectionIndex}
              />
            ))
            .with('form-section', () => (
              <FormSectionForm
                close={() => setView('list')}
                schemaItem={schemaItem}
                source={source}
              />
            ))
            .with('list', () => (
              <SidebarMenu>
                {formSections.map(({ title, fields }, sectionIndex) => {
                  return (
                    <SidebarMenuItem key={title}>
                      <SidebarMenuButton asChild>
                        {title ? (
                          <span>{title}</span>
                        ) : (
                          <span className="text-sidebar-foreground/70">[Untitled]</span>
                        )}
                      </SidebarMenuButton>
                      <FormSectionMenu
                        source={source}
                        sectionIndex={sectionIndex}
                        setSelectedSectionIndex={setSelectedSectionIndex}
                        setView={setView}
                        dispatch={dispatch}
                      />
                      <SidebarMenuSub>
                        {fields?.map((field, fieldIndex) => {
                          console.log('FIELD', field.label, field.accessorPath.join('.'))

                          return (
                            <SidebarMenuSubItem
                              key={`${field.label}-${field.accessorPath.join('.')}`}
                              className="relative"
                            >
                              <SidebarMenuSubButton>
                                <span>{field.label}</span>
                              </SidebarMenuSubButton>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <SidebarMenuAction>
                                    <MoreHorizontal />
                                  </SidebarMenuAction>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="start">
                                  <DropdownMenuItem disabled={true}>
                                    <span>Edit form field</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => {
                                      dispatch({
                                        type: 'delete-form-field',
                                        payload: {
                                          source,
                                          sectionIndex: sectionIndex,
                                          fieldIndex: fieldIndex
                                        }
                                      })
                                    }}
                                  >
                                    <span>Delete form field</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            ))
            .exhaustive()}
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  )
}

type FormSectionMenuProps = {
  source: OperationPreview
  sectionIndex: number
  setSelectedSectionIndex: (index: number) => void
  setView: (view: 'form-field' | 'form-section') => void
  dispatch: (action: any) => void
}

const FormSectionMenu = ({
  source,
  sectionIndex,
  setSelectedSectionIndex,
  setView,
  dispatch
}: FormSectionMenuProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction>
          <MoreHorizontal />
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="right" align="start">
        <DropdownMenuItem
          onClick={() => {
            setSelectedSectionIndex(sectionIndex)
            setView('form-field')
          }}
        >
          <span>Add form field</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled={true}>
          <span>Edit form section</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            dispatch({
              type: 'delete-form-section',
              payload: { source, sectionIndex }
            })
          }}
        >
          <span>Delete form section</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
