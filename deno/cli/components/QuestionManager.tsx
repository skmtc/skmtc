import { match } from 'ts-pattern'
import type { Question } from './types.ts'
import { useState } from 'react'
import { BooleanPrompt } from './BooleanPrompt.tsx'
import { StringPrompt } from './StringPrompt.tsx'
import { NumberPrompt } from './NumberPrompt.tsx'

export type QuestionManagerProps = {
  questions: Question[]
}

export const QuestionManager = ({ questions }: QuestionManagerProps) => {
  const [currentQuestion, setCurrentQuestion] = useState<number>(0)

  return questions
    .filter(({ include }) => include)
    .map((question, index) => {
      if (index > currentQuestion) {
        return null
      }

      return match(question)
        .with({ type: 'boolean' }, ({ prompt, setValue }) => (
          <BooleanPrompt
            key={prompt}
            prompt={prompt}
            setValue={value => {
              setCurrentQuestion(q => q + 1)
              setValue(value)
            }}
          />
        ))
        .with({ type: 'string' }, ({ prompt, defaultValue, setValue }) => (
          <StringPrompt
            key={prompt}
            prompt={prompt}
            defaultValue={defaultValue}
            setValue={value => {
              setCurrentQuestion(q => q + 1)
              setValue(value)
            }}
          />
        ))
        .with({ type: 'number' }, ({ prompt, setValue }) => (
          <NumberPrompt
            key={prompt}
            prompt={prompt}
            setValue={value => {
              setCurrentQuestion(q => q + 1)
              setValue(value)
            }}
          />
        ))
        .exhaustive()
    })
}
