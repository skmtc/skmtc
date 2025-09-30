import React from 'react'
import { match } from 'ts-pattern'
import type { Question } from '@/components/types.ts'
import { useState } from 'react'
import { BooleanPrompt } from '@/components/BooleanPrompt.tsx'
import { StringPrompt } from '@/components/StringPrompt.tsx'
import { NumberPrompt } from '@/components/NumberPrompt.tsx'
import { FilePathPrompt } from '@/components/FilePathPrompt.tsx'
import { SelectPrompt } from '@/components/SelectPrompt.tsx'

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
            setValue={async value => {
              await setValue(value)
              setCurrentQuestion(q => q + 1)
            }}
          />
        ))
        .with({ type: 'string' }, ({ prompt, defaultValue, setValue }) => (
          <StringPrompt
            key={prompt}
            prompt={prompt}
            defaultValue={defaultValue}
            setValue={async value => {
              await setValue(value)
              setCurrentQuestion(q => q + 1)
            }}
          />
        ))
        .with({ type: 'number' }, ({ prompt, setValue }) => (
          <NumberPrompt
            key={prompt}
            prompt={prompt}
            setValue={async value => {
              await setValue(value)
              setCurrentQuestion(q => q + 1)
            }}
          />
        ))
        .with({ type: 'filepath' }, ({ prompt, defaultValue, extensions, basePath, setValue }) => (
          <FilePathPrompt
            key={prompt}
            prompt={prompt}
            defaultValue={defaultValue}
            extensions={extensions}
            basePath={basePath}
            setValue={async value => {
              await setValue(value)
              setCurrentQuestion(q => q + 1)
            }}
          />
        ))
        .with({ type: 'select' }, ({ prompt, options, setValue }) => (
          <SelectPrompt
            key={prompt}
            prompt={prompt}
            options={options}
            setValue={async value => {
              await setValue(value)
              setCurrentQuestion(q => q + 1)
            }}
          />
        ))
        .exhaustive()
    })
}
