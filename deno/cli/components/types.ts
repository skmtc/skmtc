export type QuestionBoolean = {
  type: 'boolean'
  include: boolean
  prompt: string
  setValue: (value: boolean) => Promise<void> | void
}

export type QuestionString = {
  type: 'string'
  include: boolean
  prompt: string
  defaultValue?: string
  setValue: (value: string) => Promise<void> | void
}

export type QuestionNumber = {
  type: 'number'
  include: boolean
  prompt: string
  setValue: (value: number) => Promise<void> | void
}

export type QuestionFilePath = {
  type: 'filepath'
  include: boolean
  prompt: string
  defaultValue?: string
  extensions?: string[]
  basePath?: string
  setValue: (value: string) => Promise<void> | void
}

export type Option = {
  label: string
  value: string
}

export type QuestionSelect = {
  type: 'select'
  include: boolean
  prompt: string
  options: Option[]
  setValue: (value: string) => Promise<void> | void
}

export type Question =
  | QuestionBoolean
  | QuestionString
  | QuestionNumber
  | QuestionFilePath
  | QuestionSelect
