import * as v from 'valibot'

export type OasParameterLocation = 'query' | 'header' | 'path' | 'cookie'

export const oasParameterLocation: v.GenericSchema<OasParameterLocation> = v.enum({
  query: 'query',
  header: 'header',
  path: 'path',
  cookie: 'cookie'
})

export type OasParameterStyle =
  | 'matrix'
  | 'label'
  | 'form'
  | 'simple'
  | 'spaceDelimited'
  | 'pipeDelimited'
  | 'deepObject'

export const oasParameterStyle: v.GenericSchema<OasParameterStyle> = v.enum({
  matrix: 'matrix',
  label: 'label',
  form: 'form',
  simple: 'simple',
  spaceDelimited: 'spaceDelimited',
  pipeDelimited: 'pipeDelimited',
  deepObject: 'deepObject'
})
