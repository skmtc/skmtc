export type QuestionBoolean = {
  type: 'boolean'
  include: boolean
  prompt: string
  setValue: (value: boolean) => void
}

export type QuestionString = {
  type: 'string'
  include: boolean
  prompt: string
  defaultValue?: string
  setValue: (value: string) => void
}

export type QuestionNumber = {
  type: 'number'
  include: boolean
  prompt: string
  setValue: (value: number) => void
}

export type Question = QuestionBoolean | QuestionString | QuestionNumber
