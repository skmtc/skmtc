import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Fragment, useEffect, useState } from 'react'
import { match } from 'ts-pattern'

const schema = {
  type: 'object',
  properties: {
    name: {
      type: 'string'
    },
    age: {
      type: 'number'
    },
    skills: {
      type: 'object',
      properties: {
        juggling: {
          type: 'boolean'
        },
        programming: {
          type: 'boolean'
        },
        cooking: {
          type: 'boolean'
        },
        reading: {
          type: 'boolean'
        }
      }
    },
    address: {
      type: 'object',
      properties: {
        street: {
          type: 'string'
        },
        city: {
          type: 'string'
        }
      }
    }
  }
}

export const PathInput = () => {
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [options, setOptions] = useState<string[]>(Object.keys(schema.properties))
  const [highlightedItem, setHighlightedItem] = useState<number>(0)
  const [inputValue, setInputValue] = useState('')

  useEffect(() => {
    const currentSchema = selectedItems.reduce((acc, item) => {
      if (acc?.properties && item in acc.properties) {
        return acc.properties[item]
      }

      return undefined
    }, schema)

    console.log('CURRENT SCHEMA', currentSchema)

    if (currentSchema?.type === 'object') {
      setOptions(Object.keys(currentSchema.properties))
    } else {
      setOptions([])
    }
  }, [selectedItems])

  const filteredOptions = options.filter(option => option.includes(inputValue))

  return (
    <div className="flex bg-white rounded-sm shadow-sm ring-1 ring-inset ring-gray-300 p-2 focus-within:ring-2 focus-within:ring-inset focus-within:ring-indigo-600">
      {selectedItems.map((item, index) => (
        <Fragment key={item}>
          <Badge variant="secondary" className="mr-2 text-sm">
            {item}
          </Badge>
          <span>.</span>
        </Fragment>
      ))}

      <Popover
        open={showAutocomplete && filteredOptions.length > 0}
        onOpenChange={open => {
          console.log('SET OPEN', open)
          setShowAutocomplete(open)
        }}
      >
        <PopoverAnchor className="flex flex-1">
          <Input
            className=" bg-transparent border-none outline-none focus:outline-none focus-visible:outline-none focus:ring-0 focus-visible:ring-0"
            onFocus={() => setShowAutocomplete(true)}
            onBlur={() => setShowAutocomplete(false)}
            placeholder="Enter a topic"
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
          className="p-1 w-fit"
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
