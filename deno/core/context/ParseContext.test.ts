import { ParseContext } from '@/context/ParseContext.ts'
import { StackTrail } from '@/context/StackTrail.ts'
import type { Logger } from '@std/log'
import type { OpenAPIV3 } from 'openapi-types'
import { assertEquals } from '@std/assert/equals'
import { assertSpyCalls, spy } from '@std/testing/mock'
import { OasDocument } from '@/oas/document/Document.ts'

const oasInput = (
  documentObject: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: { title: 'Test', version: '1.0.0' },
    paths: {}
  }
) => ({ type: 'oas', value: documentObject }) as const

Deno.test('ParseContext - constructor (oas) initializes shared and protocol state', () => {
  const documentObject: OpenAPIV3.Document = {
    openapi: '3.0.3',
    info: { title: 'Test API', version: '1.0.0' },
    paths: {}
  }
  const logger = console as unknown as Logger

  const parseContext = new ParseContext({
    input: { type: 'oas', value: documentObject },
    logger,
    silent: true
  })

  assertEquals(parseContext.documentObject, documentObject)
  assertEquals(parseContext.logger, logger)
  assertEquals(parseContext.silent, true)
  assertEquals(parseContext.issues, [])
  assertEquals(parseContext.oasDocument instanceof OasDocument, true)
})

Deno.test('ParseContext - constructor (oas) defaults silent to true', () => {
  const parseContext = new ParseContext({
    input: oasInput(),
    logger: console as unknown as Logger
  })

  assertEquals(parseContext.silent, true)
})

Deno.test('ParseContext - logIssueNoKey records errors with cause and oas protocol', () => {
  const parseContext = new ParseContext({
    input: oasInput(),
    logger: console as unknown as Logger,
    silent: true
  })

  const stackTrail = new StackTrail(['paths', '/test', 'get'])
  const error = new Error('Test error')

  parseContext.logIssueNoKey({
    level: 'error',
    message: error.message,
    cause: error,
    stackTrail,
    parent: { test: 'data' },
    type: 'INVALID_SCHEMA'
  })

  assertEquals(parseContext.issues.length, 1)
  const issue = parseContext.issues[0]
  if (issue.protocol !== 'oas' || issue.level !== 'error') {
    throw new Error('Expected an OAS error issue')
  }
  assertEquals(issue.location, 'paths:/test:get')
  assertEquals(issue.message, 'Test error')
  assertEquals(issue.cause, error)
  assertEquals(issue.type, 'INVALID_SCHEMA')
})

Deno.test('ParseContext - logIssueNoKey records warnings with message and oas protocol', () => {
  const parseContext = new ParseContext({
    input: oasInput(),
    logger: console as unknown as Logger,
    silent: true
  })

  const stackTrail = new StackTrail(['components', 'schemas', 'User'])

  parseContext.logIssueNoKey({
    level: 'warning',
    message: 'Unexpected format: unknown',
    stackTrail,
    parent: { type: 'string', format: 'unknown' },
    type: 'UNEXPECTED_FORMAT'
  })

  assertEquals(parseContext.issues.length, 1)
  const issue = parseContext.issues[0]
  if (issue.protocol !== 'oas' || issue.level !== 'warning') {
    throw new Error('Expected an OAS warning issue')
  }
  assertEquals(issue.message, 'Unexpected format: unknown')
  assertEquals(issue.location, 'components:schemas:User')
  assertEquals(issue.type, 'UNEXPECTED_FORMAT')
})

Deno.test('ParseContext - logIssueNoKey calls logger.warn when not silent', () => {
  const mockLogger = { warn: () => {} } as unknown as Logger
  const warnSpy = spy(mockLogger, 'warn')

  const parseContext = new ParseContext({
    input: oasInput(),
    logger: mockLogger,
    silent: false
  })

  parseContext.logIssueNoKey({
    level: 'warning',
    message: 'Test warning',
    stackTrail: new StackTrail(['test']),
    parent: {},
    type: 'UNEXPECTED_PROPERTY'
  })

  assertSpyCalls(warnSpy, 1)
  warnSpy.restore()
})

Deno.test('ParseContext - logIssueNoKey does not call logger when silent', () => {
  const mockLogger = { warn: () => {} } as unknown as Logger
  const warnSpy = spy(mockLogger, 'warn')

  const parseContext = new ParseContext({
    input: oasInput(),
    logger: mockLogger,
    silent: true
  })

  parseContext.logIssueNoKey({
    level: 'warning',
    message: 'Test warning',
    stackTrail: new StackTrail(['test']),
    parent: {},
    type: 'UNEXPECTED_PROPERTY'
  })

  assertSpyCalls(warnSpy, 0)
  warnSpy.restore()
})

Deno.test('ParseContext - logSkippedFields (oas form) logs a warning per skipped field', () => {
  const parseContext = new ParseContext({
    input: oasInput(),
    logger: console as unknown as Logger,
    silent: true
  })

  parseContext.logSkippedFields({
    skipped: {
      unknownField1: 'value1',
      unknownField2: 'value2',
      unknownField3: 'value3'
    },
    stackTrail: new StackTrail(['components', 'schemas', 'User']),
    parent: { type: 'object' },
    parentType: 'SchemaObject'
  })

  assertEquals(parseContext.issues.length, 3)
  const [a, b, c] = parseContext.issues
  if (a.protocol !== 'oas' || a.level !== 'warning') throw new Error('expected oas warning')
  if (b.protocol !== 'oas' || b.level !== 'warning') throw new Error('expected oas warning')
  if (c.protocol !== 'oas' || c.level !== 'warning') throw new Error('expected oas warning')
  assertEquals(a.message, "Unexpected property 'unknownField1' in 'SchemaObject'")
  assertEquals(b.message, "Unexpected property 'unknownField2' in 'SchemaObject'")
  assertEquals(c.message, "Unexpected property 'unknownField3' in 'SchemaObject'")
  assertEquals(a.type, 'UNEXPECTED_PROPERTY')
})

Deno.test('ParseContext - logIssue routes through stackTrail.trace with the given key', () => {
  const parseContext = new ParseContext({
    input: oasInput(),
    logger: console as unknown as Logger,
    silent: true
  })

  const stackTrail = new StackTrail(['test'])
  const traceSpy = spy(stackTrail, 'trace')

  parseContext.logIssue({
    key: 'responses',
    level: 'warning',
    message: 'Test message',
    stackTrail,
    parent: {},
    type: 'INVALID_RESPONSE'
  })

  assertSpyCalls(traceSpy, 1)
  traceSpy.restore()
})
