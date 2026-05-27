import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@/components/Spinner.tsx'
import { TaskBox } from '@/components/TaskBox.tsx'
import type { Project } from '@/lib/project.ts'
import type { ViewStateDeploy } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import {
  deployHeadless,
  type DeployHeadlessResult
} from '@/lib/deploy-headless.ts'

type DeployViewProps = {
  project: Project
  view: ViewStateDeploy
}

type Stage =
  | { kind: 'validating' }
  | { kind: 'running' }
  | { kind: 'done'; result: DeployHeadlessResult }
  | { kind: 'misconfigured'; missing: string[] }

/**
 * Interactive Ink path for `skmtc deploy`. Strict / `--json` /
 * `--no-input` modes hit `deployHeadless` directly from
 * `commands/deploy.tsx`; this view is the human-operator surface.
 *
 * The TUI shows three stages:
 *   1. Validating required args (stack, version, token).
 *   2. Running `deployHeadless` — bundle + release create + bundle upload.
 *   3. Done — show the release URL + bundle size/hash, or the failure
 *      stage + reason.
 */
export const DeployView = ({ project, view }: DeployViewProps) => {
  const { state, dispatch, dispatchMessage, exit } = useSkmtc()
  const [stage, setStage] = useState<Stage>({ kind: 'validating' })

  useEffect(() => {
    const stack = view.stack ?? Deno.env.get('SKMTC_HUB_STACK')
    const version = view.version
    const token = view.token ?? Deno.env.get('SKMTC_HUB_TOKEN')
    const hubUrl = view.hubUrl ?? Deno.env.get('SKMTC_HUB_URL')

    const missing: string[] = []
    if (!stack) missing.push('--stack <account/slug> (or $SKMTC_HUB_STACK)')
    if (!version) missing.push('--version <semver>')
    if (!token) missing.push('--token <pat> (or $SKMTC_HUB_TOKEN)')

    if (missing.length > 0) {
      setStage({ kind: 'misconfigured', missing })
      dispatchMessage({ error: 'Deploy is missing required arguments' })
      if (!state.interactive) exit()
      return
    }

    setStage({ kind: 'running' })
    const run = async () => {
      const result = await deployHeadless({
        skmtcRoot: state.skmtcRoot,
        projectName: project.name,
        stack: stack as string,
        version: version as string,
        token: token as string,
        hubUrl,
        notes: view.notes
      })

      setStage({ kind: 'done', result })

      if (result.kind === 'deployed') {
        dispatchMessage({ success: `Deployed @${result.version} to ${result.stack.account}/${result.stack.slug}` })
      } else {
        dispatchMessage({ error: `Deploy failed at ${result.stage}: ${result.reason}` })
      }

      if (state.interactive) {
        dispatch({ type: 'set-view', payload: { page: 'project', projectName: project.name } })
      } else {
        exit()
      }
    }

    run()
  }, [])

  switch (stage.kind) {
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
            <Text key={m}>  - {m}</Text>
          ))}
          <Text dimColor>
            Example: skmtc deploy {project.name} --stack me/petstore --version 0.0.1 --token $SKMTC_HUB_TOKEN
          </Text>
        </Box>
      )
    case 'running':
      return (
        <TaskBox active>
          <Spinner label={`Deploying ${project.name} → ${view.stack}@${view.version}...`} />
        </TaskBox>
      )
    case 'done': {
      const result = stage.result
      if (result.kind === 'deployed') {
        return (
          <Box flexDirection="column">
            <Text color="green">
              ✓ Deployed {result.projectName} → {result.stack.account}/{result.stack.slug}@{result.version}
            </Text>
            <Text>  bundle:  {result.bundlePath}</Text>
            <Text>  bytes:   {result.bundleBytes.toLocaleString()}</Text>
            <Text>  sha256:  {result.bundleSha256.slice(0, 16)}...</Text>
            <Text>  release: {result.releaseUrl}</Text>
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          <Text color="red">
            ✗ Deploy failed for {result.projectName} at {result.stage}
          </Text>
          <Text>  {result.reason}</Text>
        </Box>
      )
    }
  }
}
