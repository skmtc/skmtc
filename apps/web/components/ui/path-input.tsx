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
import { wrappedInput } from '@/lib/classes'

type PropertyOption = {
  name: string
  schema: OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject
}

type PathInputProps = {
  path: string[]
  setPath: (path: string[]) => void
  parentName: string | null
  schema: OpenAPIV3.SchemaObject
  setSelectedSchema: (schema: OpenAPIV3.SchemaObject) => void
}

export const PathInput = ({
  path,
  setPath,
  parentName,
  schema,
  setSelectedSchema
}: PathInputProps) => {
  invariant(schema.type === 'object', 'Schema must be an object')

  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedItems, setSelectedItems] = useState<PropertyOption[]>(pathToOptions(path, schema))
  const [options, setOptions] = useState<PropertyOption[]>(schemaToOptions(schema))
  const [highlightedItem, setHighlightedItem] = useState<number>(0)
  const [inputValue, setInputValue] = useState('')
  const highlightedItemRef = useRef<HTMLButtonElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const filteredOptions = options.filter(option =>
    option.name.includes(inputValue.replace('.', ''))
  )

  useEffect(() => {
    if (highlightedItem > filteredOptions.length - 1) {
      setHighlightedItem(filteredOptions.length - 1)
    }
  }, [filteredOptions])

  useEffect(() => {
    setPath(selectedItems.map(item => item.name))
  }, [selectedItems])

  useEffect(() => {
    const currentSchema = selectedItems.reduce<
      OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
    >((acc, item) => {
      if (
        acc &&
        'type' in acc &&
        acc.type === 'object' &&
        acc.properties &&
        item.name in acc.properties
      ) {
        return acc.properties?.[item.name as keyof typeof acc.properties]
      }

      return undefined
    }, schema)

    if (currentSchema && 'type' in currentSchema && currentSchema.type === 'object') {
      setOptions(schemaToOptions(currentSchema))
    } else {
      setOptions([])
    }

    // TODO: This is a hack to get the schema to update when the selected items change
    setSelectedSchema(currentSchema as OpenAPIV3.SchemaObject)
  }, [selectedItems])

  useEffect(() => {
    if (highlightedItemRef.current) {
      highlightedItemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [highlightedItem])

  return (
    <div className={`flex bg-white overflow-x-scroll no-scrollbar ${wrappedInput}`}>
      <Badge
        variant="secondary"
        className="text-sm bg-transparent p-0 border-none font-normal text-[--sidebar-foreground] hover:bg-transparent"
        onClick={() => inputRef.current?.focus()}
      >
        {parentName}
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

      {options.length > 0 && selectedItems.length > 0 && <span>.</span>}

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

                    setSelectedItems(prev => [...prev, filteredOptions[highlightedItem]])
                    setInputValue('')
                    setHighlightedItem(0)
                  }
                })
                .with({ key: 'ArrowDown' }, () => {
                  if (highlightedItem < filteredOptions.length - 1) {
                    setHighlightedItem(highlightedItem + 1)
                  } else {
                    setHighlightedItem(0)
                  }
                })
                .with({ key: 'ArrowUp' }, () => {
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
            {filteredOptions.map((option, index) => (
              <Button
                key={option.name}
                tabIndex={-1}
                variant="menu"
                className={`w-full justify-start px-2 rounded-sm ${highlightedItem === index ? 'bg-accent' : ''}`}
                onMouseMove={() => setHighlightedItem(index)}
                onClick={() => {
                  setSelectedItems(prev => [...prev, option])
                  setInputValue('')
                  setHighlightedItem(0)
                }}
                ref={ref => {
                  if (highlightedItem === index) {
                    highlightedItemRef.current = ref
                  }
                }}
              >
                {option.name}
                <span className="text-xs text-muted-foreground">{schemaToType(option.schema)}</span>
              </Button>
            ))}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  )
}

const schemaToOptions = (schema: OpenAPIV3.SchemaObject) => {
  return Object.entries(schema.properties ?? {}).map(([name, schema]) => ({ name, schema }))
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
        schema: pathItemSchema
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
