import { describe, expect, it } from 'vitest'
import * as v from 'valibot'
import { parseRequest } from './parse-request.ts'
import { inputMatchesSchema } from './client-json.ts'

describe('parseRequest', () => {
  it('returns the parsed output on success', () => {
    const body = {
      subject: { type: 'model', refName: 'Pet' },
      schemaPath: ['Model', 'name']
    }
    expect(parseRequest(inputMatchesSchema, body)).toEqual(body)
  })

  it('names the failing field with its dot path', () => {
    const bad = {
      subject: { type: 'model', refName: 'Pet' },
      schemaPath: ['Model'],
      generator: 42
    }
    expect(() => parseRequest(inputMatchesSchema, bad)).toThrow(/generator: /)
  })

  it('reports a nested path and collects every issue', () => {
    const schema = v.object({
      outer: v.object({ inner: v.string() }),
      count: v.number()
    })
    let message = ''
    try {
      parseRequest(schema, { outer: { inner: 7 }, count: 'nope' })
    } catch (error) {
      message = error instanceof Error ? error.message : ''
    }
    expect(message).toContain('outer.inner: ')
    expect(message).toContain('count: ')
  })

  it('falls back to the bare message when an issue has no path', () => {
    expect(() => parseRequest(v.string(), 42)).toThrow(/Invalid type/)
  })
})
