import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Fragment, useEffect, useState } from 'react'
import { match } from 'ts-pattern'
import { OpenAPIV3 } from 'openapi-types'
import invariant from 'tiny-invariant'

type PathInputProps = {
  schema: OpenAPIV3.SchemaObject
  setSelectedSchema: (schema: OpenAPIV3.SchemaObject) => void
}

export const PathInput = ({ schema, setSelectedSchema }: PathInputProps) => {
  invariant(schema.type === 'object', 'Schema must be an object')

  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [options, setOptions] = useState<string[]>(Object.keys(schema.properties ?? {}))
  const [highlightedItem, setHighlightedItem] = useState<number>(0)
  const [inputValue, setInputValue] = useState('')

  const filteredOptions = options.filter(option => option.includes(inputValue))

  useEffect(() => {
    if (highlightedItem > filteredOptions.length - 1) {
      setHighlightedItem(filteredOptions.length - 1)
    }
  }, [filteredOptions])

  useEffect(() => {
    const currentSchema = selectedItems.reduce<
      OpenAPIV3.SchemaObject | OpenAPIV3.ReferenceObject | undefined
    >((acc, item) => {
      if (
        acc &&
        'type' in acc &&
        acc.type === 'object' &&
        acc.properties &&
        item in acc.properties
      ) {
        return acc.properties?.[item as keyof typeof acc.properties]
      }

      return undefined
    }, schema)

    if (currentSchema && 'type' in currentSchema && currentSchema.type === 'object') {
      setOptions(Object.keys(currentSchema.properties ?? {}))
    } else {
      setOptions([])
    }

    // TODO: This is a hack to get the schema to update when the selected items change
    setSelectedSchema(currentSchema as OpenAPIV3.SchemaObject)
  }, [selectedItems])

  return (
    <div className="flex bg-white rounded-sm shadow-sm ring-1 ring-inset ring-gray-300 p-1 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600">
      {selectedItems.map((item, index) => (
        <Fragment key={item}>
          <Badge variant="secondary" className="text-sm bg-transparent p-0">
            {item}
          </Badge>
          {index < selectedItems.length - 1 && <span>.</span>}
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
            className="h-auto p-0 bg-transparent shadow-none border-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setShowAutocomplete(false)}
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
          align="start"
          onOpenAutoFocus={e => e.preventDefault()}
          className={`p-1 w-fit ${filteredOptions.length > 0 ? 'block' : 'hidden'}`}
        >
          <div className="flex flex-col">
            {filteredOptions.map((option, index) => (
              <Button
                key={option}
                tabIndex={-1}
                variant="menu"
                className={`w-full justify-start ${highlightedItem === index ? 'bg-accent' : ''}`}
                onMouseMove={() => setHighlightedItem(index)}
                onClick={() => {
                  setSelectedItems(prev => [...prev, option])
                  setInputValue('')
                  setHighlightedItem(0)
                }}
              >
                {option}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
