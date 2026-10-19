import * as v from 'valibot'

/**
 * Parameter locations across OpenAPI 3.0 to 3.2. `querystring` is new in
 * 3.2; each parser tree accepts its own subset.
 */
export type OasParameterLocation = 'query' | 'querystring' | 'header' | 'path' | 'cookie'

export const oasParameterLocation: v.GenericSchema<OasParameterLocation> = v.enum({
  query: 'query',
  querystring: 'querystring',
  header: 'header',
  path: 'path',
  cookie: 'cookie'
})

/**
 * Parameter styles across OpenAPI 3.0 to 3.2. `cookie` is new in 3.2; each
 * parser tree accepts its own subset.
 */
export type OasParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject'
  | 'cookie'

export const oasParameterStyle: v.GenericSchema<OasParameterStyle> = v.enum({
  matrix: 'matrix',
  label: 'label',
  form: 'form',
  simple: 'simple',
  spaceDelimited: 'spaceDelimited',
  pipeDelimited: 'pipeDelimited',
  deepObject: 'deepObject',
  cookie: 'cookie'
})
