import { Box, Text } from 'ink'
import type { SkmtcRoot } from '../lib/skmtc-root.ts'
import type { ActionDispatch } from 'react'
import type { AppAction } from './types.ts'
import { toNameSuggest } from '../lib/to-name-suggest.ts'
import { TextInput } from '@inkjs/ui'
import { useState, useEffect } from 'react'
import { availableGenerators } from '../available-generators.ts'
import { MultiSelect } from '@inkjs/ui'
import { init } from '../lib/init.ts'

type CreateProjectViewProps = {
  skmtcRoot: SkmtcRoot
  dispatch: ActionDispatch<[action: AppAction]>
}

type ProjectParams = {
  name: string
  generators: string[]
  basePath: string
}

export const CreateProjectView = ({ skmtcRoot, dispatch }: CreateProjectViewProps) => {
  const [show, setShow] = useState<string[]>(['name'])
  const [projectParams, setProjectParams] = useState<ProjectParams>({
    name: '',
    generators: [],
    basePath: ''
  })

  useEffect(() => {
    if (show.includes('done')) {
      init(
        {
          skmtcRoot,
          projectName: projectParams.name,
          generators: projectParams.generators,
          basePath: projectParams.basePath
        },
        { logSuccess: true }
      ).then(() => {
        dispatch({ type: 'set-view', view: { type: 'home' } })
      })
    }
  }, [show])

  return (
    <Box flexDirection="column">
      <Text>Create Project</Text>
      <NamePrompt
        status={show.includes('generators') ? 'done' : 'active'}
        onDone={name => {
          setProjectParams({ ...projectParams, name })
          setShow([...show, 'generators'])
        }}
      />
      <GeneratorsPrompt
        show={show.includes('generators')}
        advance={() => setShow([...show, 'basePath'])}
      />
      <BasePathPrompt show={show.includes('basePath')} advance={() => setShow([...show, 'done'])} />
    </Box>
  )
}

type GeneratorsPromptProps = {
  show: boolean
  advance: () => void
}

const GeneratorsPrompt = ({ show, advance }: GeneratorsPromptProps) => {
  const [generators, setGenerators] = useState<string[]>([])
  const [done, setDone] = useState<boolean>(false)

  if (!show) {
    return null
  }

  if (done) {
    return <Text dimColor>Generators: {generators.join(', ')}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text>Choose generators to use:</Text>
      <MultiSelect
        options={availableGenerators.map(g => ({ label: g.name, value: g.name }))}
        onChange={value => {
          setGenerators(value)
        }}
        onSubmit={() => {
          setDone(true)
          advance()
        }}
        isDisabled={!show}
      />
    </Box>
  )
}

type NamePromptProps = {
  status: 'hidden' | 'active' | 'done'
  onDone: (name: string) => void
}

const NamePrompt = ({ status, onDone }: NamePromptProps) => {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [validate, setValidate] = useState<boolean>(false)
  const suggestedName = toNameSuggest()

  useEffect(() => {
    if (!validate) {
      return
    }

    const validateResult = validateName(name)

    setError(validateResult)
  }, [name, validate])

  if (status === 'hidden') {
    return null
  }

  if (status === 'done') {
    return <Text dimColor>Project name: {name}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text>Choose a project name:</Text>
      <TextInput
        defaultValue={name}
        suggestions={[suggestedName]}
        onSubmit={value => {
          const validateResult = validateName(value)

          if (validateResult) {
            setError(validateResult)
            setValidate(true)
          } else {
            onDone(value)
          }
        }}
        onChange={value => {
          setName(value)
        }}
      />
      {error && <Text color="red">{error}</Text>}
    </Box>
  )
}

type BasePathPromptProps = {
  show: boolean
  advance: () => void
}

const BasePathPrompt = ({ show, advance }: BasePathPromptProps) => {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<boolean>(false)
  const [validate, setValidate] = useState<boolean>(false)
  const suggestedName = toNameSuggest()

  useEffect(() => {
    if (!validate) {
      return
    }

    const validateResult = validateName(name)

    setError(validateResult)
  }, [name, validate])

  if (!show) {
    return null
  }

  if (done) {
    return <Text dimColor>Output base path: {name}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text>Choose output base path:</Text>
      <TextInput
        defaultValue={name}
        suggestions={[suggestedName]}
        onSubmit={value => {
          const validateResult = validateName(value)

          if (validateResult) {
            setError(validateResult)
            setValidate(true)
          } else {
            setDone(true)
            advance()
          }
        }}
        onChange={value => {
          setName(value)
        }}
      />
      {error && <Text color="red">{error}</Text>}
    </Box>
  )
}

const validateBasePath = (name: string) => {
  // TODO: Implement base path validation

  // if (name.length < 3) {
  //   return 'Project name must be at least 3 characters long'
  // }

  return null
}

const validateName = (name: string) => {
  if (name.length < 3) {
    return 'Project name must be at least 3 characters long'
  }

  return null
}
