import { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@/components/Spinner.tsx'
import { TaskBox } from '@/components/TaskBox.tsx'
import type { Project } from '@/lib/project.ts'
import type { ViewStateDeploy } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import {
  deployHeadless,
  type DeployHeadlessResult,
  toDeployedLines,
  toDeployExitCode
} from '@/lib/deploy-headless.ts'
import { resolveHubAuth } from '@/lib/hub-token.ts'

type DeployViewProps = {
  project: Project
  view: ViewStateDeploy
  /** Runs the deploy; a seam for tests. */
  runDeploy?: typeof deployHeadless
}

type Stage =
  | { type: 'validating' }
  | { type: 'running' }
  | { type: 'done'; result: DeployHeadlessResult }
  | { type: 'misconfigured'; missing: string[] }
  | { type: 'error'; message: string }

/**
 * Interactive Ink path for `skmtc deploy`. Strict / `--json` /
 * `--no-input` modes hit `deployHeadless` directly from
 * `commands/deploy.tsx`; this view is the human-operator surface.
 *
 * The TUI shows three stages:
 *   1. Validating required args (token).
 *   2. Running `deployHeadless` — store the version, then deploy it.
 *   3. Done — the same lines as the text output: the version, then
 *      `deploy: <status>`, or the failure stage + reason.
 */
export const DeployView = ({ project, view, runDeploy = deployHeadless }: DeployViewProps) => {
  const { state, dispatch, dispatchMessage, exit } = useSkmtc()
  const [stage, setStage] = useState<Stage>({ type: 'validating' })

  useEffect(() => {
    const run = async () => {
      const { token, origin } = await resolveHubAuth({
        tokenFlag: view.token,
        envFlag: view.env
      })

      if (!token) {
        setStage({
          type: 'misconfigured',
          missing: ['--token <pat> (or $SKMTC_HUB_TOKEN, or `skmtc login`)']
        })
        dispatchMessage({ error: 'Deploy is missing required arguments' })
        if (!state.interactive) exit()
        return
      }

      setStage({ type: 'running' })
      const result = await runDeploy({
        skmtcRoot: state.skmtcRoot,
        projectName: project.name,
        token,
        origin,
        version: view.version,
        envFlag: view.env,
        existing: view.existing
      })

      setStage({ type: 'done', result })

      if (result.type === 'failed') {
        dispatchMessage({ error: `Deploy failed at ${result.stage}: ${result.reason}` })
      } else if (toDeployExitCode(result) === 0) {
        dispatchMessage({
          success: `Deployed ${result.stack.account}/${result.stack.slug}@${result.version}: ${result.deploy.status}`
        })
      } else {
        dispatchMessage({
          error: `Deploy of ${result.stack.account}/${result.stack.slug}@${result.version}: ${result.deploy.status}`
        })
      }

      if (state.interactive) {
        dispatch({
          type: 'set-view',
          payload: { page: 'project', projectName: project.name }
        })
      } else {
        exit()
      }
    }

    // Thrown inside an effect, an error would stop the Ink app rather than
    // reach the handler in `mod.ts`, so every failure is shown here.
    run().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      setStage({ type: 'error', message })
      dispatchMessage({ error: message })
      if (!state.interactive) exit()
    })
  }, [])

  switch (stage.type) {
    case 'validating':
      return (
        <TaskBox active>
          <Spinner label="Validating deploy inputs..." />
        </TaskBox>
      )
    case 'misconfigured':
      return (
        <Box flexDirection="column">
          <Text color="red">Missing required deploy arguments:</Text>
          {stage.missing.map(m => (
            <Text key={m}>- {m}</Text>
          ))}
          <Text dimColor>Example: skmtc deploy {project.name} --token $SKMTC_HUB_TOKEN</Text>
        </Box>
      )
    case 'error':
      return <Text color="red">{stage.message}</Text>
    case 'running':
      return (
        <TaskBox active>
          <Spinner label={`Deploying ${project.name}...`} />
        </TaskBox>
      )
    case 'done': {
      const result = stage.result
      if (result.type === 'deployed') {
        const ok = toDeployExitCode(result) === 0
        return (
          <Box flexDirection="column">
            {toDeployedLines(result).map((line, index) => (
              <Text key={index} color={index === 0 ? (ok ? 'green' : 'red') : undefined}>
                {line}
              </Text>
            ))}
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          <Text color="red">
            ✗ Deploy failed for {result.projectName} at {result.stage}
          </Text>
          <Text>{result.reason}</Text>
        </Box>
      )
    }
  }
}
