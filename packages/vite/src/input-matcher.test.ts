import { describe, expect, it } from 'vitest'
import {
  classify,
  renderProbe,
  rootModelNameForSchemaPath,
  type MatcherSubject,
  type ProbeLayout
} from './input-matcher.ts'

const operation = (path: string, method: string): MatcherSubject => ({
  type: 'operation',
  path,
  method
})

describe('rootModelNameForSchemaPath', () => {
  it('resolves a Swagger 2.0 request-body $ref (in:body parameter)', () => {
    const doc = {
      paths: {
        '/applicants/': {
          post: {
            parameters: [{ in: 'body', schema: { $ref: '#/definitions/CreateApplicantModel' } }]
          }
        }
      }
    }
    expect(rootModelNameForSchemaPath(doc, operation('/applicants/', 'post'), 'RequestBody')).toBe(
      'CreateApplicantModel'
    )
  })

  it('resolves an OAS 3 request-body $ref (requestBody.content)', () => {
    const doc = {
      paths: {
        '/applicants': {
          post: {
            requestBody: {
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/CreateApplicantModel' }
                }
              }
            }
          }
        }
      }
    }
    expect(rootModelNameForSchemaPath(doc, operation('/applicants', 'post'), 'RequestBody')).toBe(
      'CreateApplicantModel'
    )
  })

  it('is method-case-insensitive', () => {
    const doc = {
      paths: {
        '/x': { post: { parameters: [{ in: 'body', schema: { $ref: '#/definitions/M' } }] } }
      }
    }
    expect(rootModelNameForSchemaPath(doc, operation('/x', 'POST'), 'RequestBody')).toBe('M')
  })

  it('returns the refName for a model subject (any token)', () => {
    expect(
      rootModelNameForSchemaPath({}, { type: 'model', refName: 'PropertyModel' }, 'Model')
    ).toBe('PropertyModel')
  })

  it('SuccessResponse: resolves a single-object response to its $ref name', () => {
    const doc = {
      definitions: { PropertyModel: { type: 'object', properties: {} } },
      paths: {
        '/properties/{id}': {
          get: { responses: { '200': { schema: { $ref: '#/definitions/PropertyModel' } } } }
        }
      }
    }
    expect(
      rootModelNameForSchemaPath(doc, operation('/properties/{id}', 'get'), 'SuccessResponse')
    ).toBe('PropertyModel')
  })

  it('SuccessResponse: resolves an object envelope to the WHOLE response $ref (not the row)', () => {
    // The schemaPath navigates into the array explicitly (`_embedded` → `items`),
    // so the root is the envelope model, consistent with RequestBody.
    const doc = {
      definitions: {
        PropertyModelPagedResult: {
          type: 'object',
          properties: {
            _embedded: { type: 'array', items: { $ref: '#/definitions/PropertyModel' } },
            pageNumber: { type: 'integer' }
          }
        },
        PropertyModel: { type: 'object', properties: {} }
      },
      paths: {
        '/properties': {
          get: {
            responses: {
              '200': { schema: { $ref: '#/definitions/PropertyModelPagedResult' } }
            }
          }
        }
      }
    }
    expect(
      rootModelNameForSchemaPath(doc, operation('/properties', 'get'), 'SuccessResponse')
    ).toBe('PropertyModelPagedResult')
  })

  it('SuccessResponse: an inline bare-array response has no named root model', () => {
    const doc = {
      definitions: { PropertyModel: { type: 'object', properties: {} } },
      paths: {
        '/properties': {
          get: {
            responses: {
              '200': {
                schema: { type: 'array', items: { $ref: '#/definitions/PropertyModel' } }
              }
            }
          }
        }
      }
    }
    expect(
      rootModelNameForSchemaPath(doc, operation('/properties', 'get'), 'SuccessResponse')
    ).toBeUndefined()
  })

  it('returns undefined for a missing operation', () => {
    expect(
      rootModelNameForSchemaPath({ paths: {} }, operation('/nope', 'post'), 'RequestBody')
    ).toBeUndefined()
  })

  it('returns undefined for an inline (un-$ref-ed) request body', () => {
    const doc = {
      paths: {
        '/x': { post: { parameters: [{ in: 'body', schema: { type: 'object', properties: {} } }] } }
      }
    }
    expect(rootModelNameForSchemaPath(doc, operation('/x', 'post'), 'RequestBody')).toBeUndefined()
  })
})

// A two-segment, two-candidate layout used across the probe/classify suites.
const layoutFixture = (): ProbeLayout =>
  renderProbe({
    modelName: 'CreateApplicantModel',
    modelImportPath: './src/types/createApplicantModel.generated',
    moduleTypeSource: `import type { Lens } from '@hookform/lenses'\nexport type InputModule<F> = (props: { lens: Lens<F> }) => unknown`,
    moduleTypeName: 'InputModule',
    segments: ['applicant', 'officeIds'],
    candidates: [
      { exportName: 'OfficeSelect', importPath: './src/inputs/OfficeSelect' },
      { exportName: 'TextInput', importPath: './src/inputs/TextInput' }
    ]
  })

describe('renderProbe', () => {
  it('gives every question its own line, in layout order', () => {
    const layout = layoutFixture()
    const lines = layout.text.split('\n')

    expect(lines[layout.modelLine]).toBe(
      `import type { CreateApplicantModel } from './src/types/createApplicantModel.generated'`
    )
    expect(lines[layout.moduleTypeStartLine]).toContain('@hookform/lenses')
    expect(lines[layout.moduleTypeEndLine]).toContain('export type InputModule<F>')
    expect(layout.segmentLines.map((line) => lines[line])).toEqual([
      `type __D0 = CreateApplicantModel['applicant']`,
      `type __D1 = NonNullable<__D0>['officeIds']`
    ])
    expect(layout.importLines.map((line) => lines[line])).toEqual([
      `import { OfficeSelect as __C0 } from './src/inputs/OfficeSelect'`,
      `import { TextInput as __C1 } from './src/inputs/TextInput'`
    ])
    expect(layout.cellLines.map((line) => lines[line])).toEqual([
      `const __m0: true = (null as unknown as (typeof __C0 extends InputModule<__F> ? true : false));`,
      `const __m1: true = (null as unknown as (typeof __C1 extends InputModule<__F> ? true : false));`
    ])
  })

  it('points fieldTypeOffset at the __F alias name', () => {
    const layout = layoutFixture()
    expect(layout.text.slice(layout.fieldTypeOffset, layout.fieldTypeOffset + 3)).toBe('__F')
  })

  it('aliases the whole model when the path has no segments', () => {
    const layout = renderProbe({
      modelName: 'M',
      modelImportPath: './src/types/m.generated',
      moduleTypeSource: 'export type S<F> = F',
      moduleTypeName: 'S',
      segments: [],
      candidates: []
    })
    expect(layout.segmentLines).toEqual([])
    expect(layout.text).toContain('type __F = M')
  })

  it('drills an `items` segment as array-element access', () => {
    // `["SuccessResponse","_embedded","items","name"]` → the envelope model, its
    // `_embedded` array, the array's element, then `name`.
    const layout = renderProbe({
      modelName: 'ApplicantModelPagedResult',
      modelImportPath: './src/types/applicantModelPagedResult.generated',
      moduleTypeSource: 'export type S<F> = F',
      moduleTypeName: 'S',
      segments: ['_embedded', 'items', 'name'],
      candidates: []
    })
    const lines = layout.text.split('\n')
    expect(lines).toContain(`type __D0 = ApplicantModelPagedResult['_embedded']`)
    expect(lines).toContain(
      `type __D1 = NonNullable<__D0> extends ReadonlyArray<infer __El1> ? __El1 : NonNullable<__D0>['items']`
    )
    expect(lines).toContain(`type __D2 = NonNullable<__D1>['name']`)
    expect(layout.text).toContain('type __F = __D2')
  })

  it('escapes quotes and backslashes in property segments', () => {
    const layout = renderProbe({
      modelName: 'M',
      modelImportPath: './src/types/m.generated',
      moduleTypeSource: 'export type S<F> = F',
      moduleTypeName: 'S',
      segments: [`it's`, 'a\\b'],
      candidates: []
    })
    expect(layout.text).toContain(`type __D0 = M['it\\'s']`)
    expect(layout.text).toContain(`type __D1 = NonNullable<__D0>['a\\\\b']`)
  })
})

describe('classify', () => {
  it('classifies a clean probe as all-fit verdicts', () => {
    expect(classify(new Set(), layoutFixture())).toEqual({
      type: 'verdicts',
      verdicts: ['fit', 'fit']
    })
  })

  it('model import error wins over everything downstream', () => {
    const layout = layoutFixture()
    const errors = new Set([layout.modelLine, layout.segmentLines[0], layout.cellLines[1]])
    expect(classify(errors, layout)).toEqual({ type: 'model-import-error' })
  })

  it('module-type error wins over path + candidate errors', () => {
    const layout = layoutFixture()
    const errors = new Set([layout.moduleTypeEndLine, layout.segmentLines[1], layout.cellLines[0]])
    expect(classify(errors, layout)).toEqual({ type: 'module-type-error' })
  })

  it('reports the FIRST broken segment and voids candidate lines', () => {
    const layout = layoutFixture()
    const errors = new Set([layout.segmentLines[1], layout.cellLines[0], layout.cellLines[1]])
    expect(classify(errors, layout)).toEqual({ type: 'path-broken', segmentIndex: 1 })
  })

  it('attributes import vs cell errors per candidate', () => {
    const layout = layoutFixture()
    const errors = new Set([layout.importLines[0], layout.cellLines[1]])
    expect(classify(errors, layout)).toEqual({
      type: 'verdicts',
      verdicts: ['unresolved', 'misfit']
    })
  })

  it('an unresolved import is not misclassified by its own poisoned cell', () => {
    const layout = layoutFixture()
    // A failed import usually errors its cell too — the import verdict wins.
    const errors = new Set([layout.importLines[1], layout.cellLines[1]])
    expect(classify(errors, layout)).toEqual({
      type: 'verdicts',
      verdicts: ['fit', 'unresolved']
    })
  })
})
