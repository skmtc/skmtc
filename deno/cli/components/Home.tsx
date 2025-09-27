import SelectInput from 'ink-select-input'
import { Box, Newline, Text, useApp } from 'ink'
import { match, P } from 'ts-pattern'
import { useSkmtc } from './SkmtcContext.tsx'

type HomeActionType = `select-project:${string}` | 'create-project' | 'login' | 'logout' | 'exit'

type HomeActionItem = {
  value: HomeActionType
  space?: boolean
  label: string
}

export const Home = () => {
  const { state, dispatch } = useSkmtc()
  const { exit } = useApp()

  const { skmtcRoot, session } = state
  const { projects } = skmtcRoot

  const projectOptions: HomeActionItem[] = projects.map(({ name }, index, array) => ({
    value: `select-project:${name}`,
    label: name,
    space: index === array.length - 1
  }))

  const items: HomeActionItem[] = [
    ...projectOptions,
    { value: 'create-project', label: 'Create new project', space: true },
    session ? { value: 'logout', label: 'Log out' } : { value: 'login', label: 'Log in to Skmtc' },
    { value: 'exit', label: 'Exit' }
  ]

  return (
    <Box flexDirection="column">
      <Box marginLeft={2}>
        <Text>Select a project</Text>
      </Box>
      <SelectInput
        items={items}
        itemComponent={({ label, isSelected, ...props }) => {
          const space = 'space' in props ? Boolean(props.space) : false
          const isProject =
            'value' in props &&
            typeof props.value === 'string' &&
            props.value.startsWith('select-project:')

          return (
            <Text color={isSelected ? 'white' : undefined} dimColor={!isSelected && isProject}>
              {label}
              {space && <Newline />}
            </Text>
          )
        }}
        onSelect={async item =>
          await match(item)
            .with({ value: P.string.startsWith('select-project:') }, ({ label }) =>
              dispatch({ type: 'set-view', payload: { page: 'project', projectName: label } })
            )
            .with({ value: 'create-project' }, () => {
              dispatch({ type: 'set-view', payload: { page: 'create-project' } })
            })
            .with({ value: 'login' }, () => {
              dispatch({ type: 'set-view', payload: { page: 'login' } })
            })
            .with({ value: 'logout' }, async () => {
              await skmtcRoot.logout({ silent: true })
              dispatch({ type: 'set-session', payload: { session: null } })
            })
            .with({ value: 'exit' }, () => exit())
            .exhaustive()
        }
      />
    </Box>
  )
}
