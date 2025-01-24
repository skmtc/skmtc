import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Fragment, useEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { OpenAPIV3 } from 'openapi-types'
import invariant from 'tiny-invariant'
import { ScrollArea } from '@/components/ui/scroll-area'
import { isRef, schemaToType } from '@/lib/schemaFns'
import { SchemaItem, SelectedSchemaType } from '@/components/config/types'
import { inputClasses, inputWrapperEdgeClasses } from '@/lib/classes'
import { cn } from '@/lib/utils'

type PropertyOption = {
  name: string
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
  required: boolean
}

type PathInputProps = {
  path: string[]
  setPath: (path: string[]) => void
  schemaItem: SchemaItem
  setSelectedSchema: (schema: SelectedSchemaType | null) => void
  showRequired?: boolean
  disabledPaths?: string[][]
}

export const PathInput = ({
  path,
  setPath,
  schemaItem,
  setSelectedSchema,
  showRequired,
  disabledPaths
}: PathInputProps) => {
  if (!schemaItem?.schema?.type) {
    debugger
  }

  const disabledPathsJoined = disabledPaths?.map(path => path.join('.')) ?? []

  invariant(schemaItem.schema.type === 'object', 'Schema must be an object')

  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedItems, setSelectedItems] = useState<PropertyOption[]>(
    pathToOptions(path, schemaItem.schema)
  )
  const [options, setOptions] = useState<PropertyOption[]>(schemaToOptions(schemaItem.schema))
  const [highlightedItem, setHighlightedItem] = useState<number>(0)
  const [inputValue, setInputValue] = useState('')
  const highlightedItemRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const normalizedInputValue = inputValue.toLowerCase().replace('.', '')

  const filteredOptions = options.filter(option => {
    const lowerCaseName = option.name.toLowerCase()

    return lowerCaseName.includes(normalizedInputValue)
  })

  useEffect(() => {
    if (highlightedItem > filteredOptions.length - 1) {
      setHighlightedItem(filteredOptions.length - 1)
    }
  }, [filteredOptions])

  useEffect(() => {
    setPath(selectedItems.map(item => item.name))
  }, [selectedItems])

  useEffect(() => {
    const currentSelectedSchema = selectedItems.reduce<SelectedSchemaType | null>(
      (acc, item) => {
        if (
          acc?.schema &&
          'type' in acc.schema &&
          acc.schema.type === 'object' &&
          acc.schema.properties &&
          item.name in acc.schema.properties
        ) {
          const mySchema = acc.schema.properties?.[item.name as keyof typeof acc.schema.properties]

          invariant(!('$ref' in mySchema), 'Property must be an object and not a reference object')

          return {
            schema: mySchema,
            name: item.name
          }
        }

        return null
      },
      { schema: schemaItem.schema, name: schemaItem.name }
    )

    if (
      currentSelectedSchema &&
      'type' in currentSelectedSchema.schema &&
      currentSelectedSchema.schema.type === 'object'
    ) {
      setOptions(schemaToOptions(currentSelectedSchema.schema))
    } else {
      setOptions([])
    }

    setSelectedSchema(currentSelectedSchema)
  }, [selectedItems, schemaItem.schema])

  useEffect(() => {
    if (highlightedItemRef.current) {
      highlightedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightedItem])

  return (
    <div
      className={cn(
        `flex bg-white overflow-x-scroll no-scrollbar`,
        inputClasses,
        inputWrapperEdgeClasses
      )}
    >
      <Badge
        variant="secondary"
        className="text-sm bg-transparent p-0 border-none font-normal text-[--sidebar-foreground] hover:bg-transparent"
        onClick={() => inputRef.current?.focus()}
      >
        {schemaItem.name}
      </Badge>
      {selectedItems.map(item => (
        <Fragment key={item.name}>
          <span>.</span>
          <Badge
            variant="secondary"
            className="text-sm bg-transparent p-0 border-none font-normal text-[--sidebar-foreground] hover:bg-transparent"
            onClick={() => inputRef.current?.focus()}
          >
            {item.name}
          </Badge>
        </Fragment>
      ))}

      <Popover
        open={showAutocomplete}
        onOpenChange={open => {
          setShowAutocomplete(open)
        }}
      >
        <PopoverAnchor className="flex flex-1">
          <Input
            ref={inputRef}
            className="h-auto min-w-4 p-0 pl-[2px] bg-transparent shadow-none border-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => {
              setShowAutocomplete(false)
            }}
            value={inputValue}
            onChange={event => {
              if (options.length > 0) {
                setInputValue(event.target.value)
              }
            }}
            onKeyDown={event => {
              match(event)
                .with({ key: 'Enter' }, () => {
                  if (filteredOptions[highlightedItem]) {
                    event.preventDefault()

                    //@todo: check if the path is disabled
                    setSelectedItems(prev => [...prev, filteredOptions[highlightedItem]])
                    setInputValue('')
                    setHighlightedItem(0)
                  }
                })
                .with({ key: 'ArrowDown' }, () => {
                  //@todo: skip disabled paths
                  if (highlightedItem < filteredOptions.length - 1) {
                    setHighlightedItem(highlightedItem + 1)
                  } else {
                    setHighlightedItem(0)
                  }
                })
                .with({ key: 'ArrowUp' }, () => {
                  //@todo: skip disabled paths
                  if (highlightedItem > 0) {
                    setHighlightedItem(highlightedItem - 1)
                  } else {
                    setHighlightedItem(filteredOptions.length - 1)
                  }
                })
                .with({ key: 'Escape' }, () => {
                  setShowAutocomplete(false)
                })
                .with({ key: 'Backspace' }, () => {
                  setSelectedItems(prev => prev.slice(0, -1))
                })
                .otherwise(() => {})
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          align="end"
          onOpenAutoFocus={e => e.preventDefault()}
          className={`mt-[2px] p-0 border-none w-fit ${filteredOptions.length > 0 ? 'block' : 'hidden'}`}
        >
          <ScrollArea className="flex flex-col h-[200px] w-min rounded-sm border p-1">
            {filteredOptions.map((option, index) => {
              const isDisabled = disabledPathsJoined.includes(
                selectedItems
                  .map(item => item.name)
                  .concat(option.name)
                  .join('.')
              )

              return (
                <Button
                  key={option.name}
                  tabIndex={-1}
                  variant="ghost"
                  className={`w-full justify-start px-2 rounded-sm ${highlightedItem === index ? 'bg-accent' : ''}`}
                  onMouseMove={() => setHighlightedItem(index)}
                  onClick={() => {
                    setSelectedItems(prev => [...prev, option])
                    setInputValue('')
                    setHighlightedItem(0)
                  }}
                  disabled={isDisabled}
                  ref={ref => {
                    if (highlightedItem === index) {
                      highlightedItemRef.current = ref
                    }
                  }}
                >
                  {option.name}
                  <span className="text-xs text-muted-foreground">
                    {schemaToType(option.schema)}
                  </span>
                  {showRequired && option.required ? (
                    <span className="text-xs text-muted-foreground">*</span>
                  ) : null}
                </Button>
              )
            })}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const schemaToOptions = (objectSchema: OpenAPIV3.SchemaObject) => {
  return Object.entries(objectSchema.properties ?? {}).map(([name, schema]) => ({
    name,
    schema,
    required: objectSchema.required?.includes(name) ?? false
  }))
}

type PathOptionsAcc = {
  schema: OpenAPIV3.SchemaObject
  options: PropertyOption[]
}

const pathToOptions = (path: string[], schema: OpenAPIV3.SchemaObject) => {
  const { options } = path.reduce<PathOptionsAcc>(
    (acc, pathItem) => {
      const pathItemSchema = acc.schema.properties?.[pathItem as keyof typeof acc.schema.properties]

      if (!pathItemSchema) {
        console.error(`Path item ${pathItem} not found in schema`)
        return acc
      }

      if (isRef(pathItemSchema)) {
        throw new Error(`Unexpected reference object in path ${path.join('.')}: ${pathItem}`)
      }

      const option = {
        name: pathItem,
        schema: pathItemSchema,
        required: pathItemSchema.required?.includes(pathItem) ?? false
      }

      return {
        schema: pathItemSchema,
        options: [...acc.options, option]
      }
    },
    { schema, options: [] }
  )

  return options
}
