import { describe, expect, it } from 'vitest'
import { moduleTypeFromDescribe } from './descriptors.ts'

const CONTRACT = `export type InputModule<F> = (props: { lens: F }) => unknown`

const describePayload = {
  descriptors: [
    {
      generator: '@reapit/gen-elemental-form',
      subjectType: 'operation',
      supportsVariant: false,
      fields: [
        {
          key: 'subject',
          label: 'Subject',
          type: 'object',
          fields: [
            { key: 'title', label: 'Title', type: 'text' },
            {
              key: 'fields',
              label: 'Fields',
              type: 'array',
              item: [
                {
                  key: '',
                  label: '',
                  type: 'object',
                  fields: [
                    {
                      key: 'moduleSelect',
                      label: 'Input',
                      type: 'moduleSelect',
                      moduleType: CONTRACT
                    },
                    { key: 'label', label: 'Label', type: 'text' }
                  ]
                }
              ]
            }
          ]
        }
      ]
    },
    {
      generator: '@reapit/gen-typescript',
      subjectType: 'model',
      supportsVariant: false,
      fields: []
    }
  ]
}

describe('moduleTypeFromDescribe', () => {
  it('finds the moduleType nested under object + array item fields', () => {
    expect(moduleTypeFromDescribe(describePayload, '@reapit/gen-elemental-form')).toBe(CONTRACT)
  })

  it('returns undefined for a generator with no moduleSelect field', () => {
    expect(moduleTypeFromDescribe(describePayload, '@reapit/gen-typescript')).toBeUndefined()
  })

  it('returns undefined for an unknown generator or malformed payload', () => {
    expect(moduleTypeFromDescribe(describePayload, '@x/gen-nope')).toBeUndefined()
    expect(moduleTypeFromDescribe(null, '@x/gen-nope')).toBeUndefined()
    expect(moduleTypeFromDescribe({ descriptors: 'nope' }, '@x/gen-nope')).toBeUndefined()
  })
})
