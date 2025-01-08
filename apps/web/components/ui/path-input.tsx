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
}

export const PathInput = ({ schema }: PathInputProps) => {
  invariant(schema.type === 'object', 'Schema must be an object')

  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [options, setOptions] = useState<string[]>(Object.keys(schema.properties ?? {}))
  const [highlightedItem, setHighlightedItem] = useState<number>(0)
  const [inputValue, setInputValue] = useState('')

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

    console.log('CURRENT SCHEMA', currentSchema)

    if (currentSchema && 'type' in currentSchema && currentSchema.type === 'object') {
      setOptions(Object.keys(currentSchema.properties ?? {}))
    } else {
      setOptions([])
    }
  }, [selectedItems])

  const filteredOptions = options.filter(option => option.includes(inputValue))

  return (
    <div className="flex bg-white rounded-sm shadow-sm ring-1 ring-inset ring-gray-300 p-2 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600">
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
          console.log('SET OPEN', open)
          setShowAutocomplete(open)
        }}
      >
        <PopoverAnchor className="flex flex-1">
          <Input
            className="h-auto px-0 bg-transparent shadow-none border-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
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
                  if (options[highlightedItem]) {
                    setSelectedItems(prev => [...prev, options[highlightedItem]])
                    setInputValue('')
                    setHighlightedItem(0)
                  }
                })
                .with({ key: 'ArrowDown' }, () => {
                  if (highlightedItem < options.length - 1) {
                    setHighlightedItem(highlightedItem + 1)
                  } else {
                    setHighlightedItem(0)
                  }
                })
                .with({ key: 'ArrowUp' }, () => {
                  if (highlightedItem > 0) {
                    setHighlightedItem(highlightedItem - 1)
                  } else {
                    setHighlightedItem(options.length - 1)
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
