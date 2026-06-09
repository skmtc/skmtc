import React, { useEffect, useState } from 'react'
import { Box, Text } from 'ink'
import { Spinner } from '@/components/Spinner.tsx'
import { TaskBox } from '@/components/TaskBox.tsx'
import type { Project } from '@/lib/project.ts'
import type { ViewStatePublish } from '@/components/SkmtcContext.tsx'
import { useSkmtc } from '@/components/SkmtcContext.tsx'
import {
  publishHeadless,
  type PublishHeadlessResult
} from '@/lib/publish-headless.ts'

type PublishViewProps = {
  project: Project
  view: ViewStatePublish
}

type Stage =
  | { kind: 'validating' }
  | { kind: 'running' }
  | { kind: 'done'; result: PublishHeadlessResult }
  | { kind: 'misconfigured'; missing: string[] }

/**
 * Interactive Ink path for `skmtc publish`. Strict / `--json` /
 * `--no-input` modes hit `publishHeadless` directly from
 * `commands/publish.tsx`; this view is the human-operator surface.
 *
 * The TUI shows three stages:
 *   1. Validating required args (stack, token).
 *   2. Running `publishHeadless` — version resolution + bundle +
 *      version publish (bundle + source in one multipart request).
 *   3. Done — show the published version + URL + bundle size/hash, or
 *      the failure stage + reason.
 */
export const PublishView = ({ project, view }: PublishViewProps) => {
  const { state, dispatch, dispatchMessage, exit } = useSkmtc()
  const [stage, setStage] = useState<Stage>({ kind: 'validating' })

  useEffect(() => {
    const token = view.token ?? Deno.env.get('SKMTC_HUB_TOKEN')
    const hubUrl = view.hubUrl ?? Deno.env.get('SKMTC_HUB_URL')

    const missing: string[] = []
    if (!token) missing.push('--token <pat> (or $SKMTC_HUB_TOKEN)')

    if (missing.length > 0) {
      setStage({ kind: 'misconfigured', missing })
      dispatchMessage({ error: 'Publish is missing required arguments' })
      if (!state.interactive) exit()
      return
    }

    setStage({ kind: 'running' })
    const run = async () => {
      const result = await publishHeadless({
        skmtcRoot: state.skmtcRoot,
        projectName: project.name,
        token: token as string,
        hubUrl,
        version: view.version
      })

      setStage({ kind: 'done', result })

      if (result.kind === 'published') {
        dispatchMessage({
          success: `Published ${result.stack.account}/${result.stack.slug}@${result.version}`
        })
      } else {
        dispatchMessage({ error: `Publish failed at ${result.stage}: ${result.reason}` })
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
          <Spinner label="Validating publish inputs..." />
        </TaskBox>
      )
    case 'misconfigured':
      return (
        <Box flexDirection="column">
          <Text color="red">Missing required publish arguments:</Text>
          {stage.missing.map(m => (
            <Text key={m}>  - {m}</Text>
          ))}
          <Text dimColor>
            Example: skmtc publish {project.name} --token $SKMTC_HUB_TOKEN
          </Text>
        </Box>
      )
    case 'running':
      return (
        <TaskBox active>
          <Spinner label={`Publishing ${project.name}...`} />
        </TaskBox>
      )
    case 'done': {
      const result = stage.result
      if (result.kind === 'published') {
        return (
          <Box flexDirection="column">
            <Text color="green">
              ✓ Published {result.projectName} → {result.stack.account}/{result.stack.slug}@{result.version}
            </Text>
            <Text>  bundle:  {result.bundlePath}</Text>
            <Text>  bytes:   {result.bundleBytes.toLocaleString()}</Text>
            <Text>  sha256:  {result.bundleSha256.slice(0, 16)}...</Text>
            <Text>  source:  {result.sourceFileCount} files, {result.sourceTotalBytes.toLocaleString()} bytes</Text>
            <Text>  version: {result.versionUrl}</Text>
          </Box>
        )
      }
      return (
        <Box flexDirection="column">
          <Text color="red">
            ✗ Publish failed for {result.projectName} at {result.stage}
          </Text>
          <Text>  {result.reason}</Text>
        </Box>
      )
    }
  }
}
