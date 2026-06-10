/**
 * `skmtc login` — paste-a-PAT login (the npm-login pattern).
 *
 * The user mints a PAT in the hub UI, pastes it once, the CLI
 * validates it against `GET /v1/user` and stores it in
 * `~/.skmtc/auth.json` (mode 0600). No OAuth, no localhost server,
 * no browser automation — and no auto-opened browser: the
 * recommended install grants `--allow-run=deno,sh` only, so we print
 * the URL instead of spawning `open`.
 *
 * Forms:
 *   - `skmtc login`                interactive masked prompt; when a
 *                                  token is already stored, reports
 *                                  `Logged in as <handle> (token …last4)`
 *                                  instead of prompting (the `whoami`).
 *   - `skmtc login --with-token`   reads the PAT from stdin (the `gh`
 *                                  pattern) — works in strict mode.
 *   - `--json`                     `{ "kind": "logged-in", "handle": ... }`
 *                                  on success; recipe error (exit 2) on
 *                                  missing input.
 *
 * The token is stored only after a 200 from the hub — a failed
 * validation never writes the file. Output never echoes more than the
 * token's last 4 characters.
 */

import React from 'react'
import { Box, Text, render, useApp } from 'ink'
import { useEffect, useState } from 'react'
import { PasswordInput } from '@inkjs/ui'
import { Spinner } from '@/components/Spinner.tsx'
import { failWithRecipe, resolveInputMode, resolveOutputFormat } from '@/lib/strict-mode.ts'
import {
  HUB_TOKEN_SETTINGS_URL,
  maskToken,
  readStoredAuth,
  resolveHubUrl,
  validateHubToken,
  writeStoredAuth
} from '@/lib/hub-token.ts'

const USAGE = 'skmtc login [--with-token] [--hub-url <url>]'
const EXAMPLE = 'echo $SKMTC_HUB_TOKEN | skmtc login --with-token'
const SCOPE_HINT = `Mint a PAT at ${HUB_TOKEN_SETTINGS_URL} — the write:releases scope is enough for publishing.`

type RenderLoginArgs = {
  hubUrl: string | undefined
  withToken: boolean | undefined
  jsonFlag?: boolean
  noInputFlag?: boolean
}

type LoginResult = {
  kind: 'logged-in'
  handle: string
}

const printLoginResult = (
  result: LoginResult,
  { format, tokenLast4 }: { format: 'text' | 'json'; tokenLast4?: string }
): void => {
  if (format === 'json') {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const suffix = tokenLast4 ? ` (token ${tokenLast4})` : ''
  console.log(`Logged in as ${result.handle}${suffix}`)
}

const readStdinToEnd = async (): Promise<string> => {
  return await new Response(Deno.stdin.readable).text()
}

export const renderLogin = async ({
  hubUrl: hubUrlFlag,
  withToken,
  jsonFlag,
  noInputFlag
}: RenderLoginArgs): Promise<void> => {
  const mode = resolveInputMode({ noInputFlag, jsonFlag })
  const format = resolveOutputFormat({ jsonFlag })
  const hubUrl = resolveHubUrl(hubUrlFlag)

  if (withToken) {
    const token = (await readStdinToEnd()).trim()

    if (!token) {
      return failWithRecipe({
        command: 'login',
        arg: '--with-token (stdin was empty)',
        usage: USAGE,
        example: EXAMPLE,
        discover: SCOPE_HINT
      })
    }

    try {
      const handle = await validateHubToken({ hubUrl, token })
      writeStoredAuth({ host: hubUrl, token })
      printLoginResult({ kind: 'logged-in', handle }, { format })
      Deno.exit(0)
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      Deno.exit(1)
    }
  }

  // Already logged in → report status instead of prompting (in both
  // modes). Re-login is `skmtc logout` first, or `--with-token`.
  const stored = readStoredAuth()

  if (stored) {
    try {
      const handle = await validateHubToken({ hubUrl: stored.host, token: stored.token })
      printLoginResult(
        { kind: 'logged-in', handle },
        { format, tokenLast4: maskToken(stored.token) }
      )
      Deno.exit(0)
    } catch {
      console.error(
        'A token is stored in ~/.skmtc/auth.json but the hub rejected it. ' +
          'Run `skmtc logout`, then log in again with a fresh token.'
      )
      Deno.exit(1)
    }
  }

  if (mode === 'strict') {
    return failWithRecipe({
      command: 'login',
      arg: '--with-token',
      usage: USAGE,
      example: EXAMPLE,
      discover: SCOPE_HINT
    })
  }

  const outcome: { handle: string | null } = { handle: null }

  const instance = render(<LoginPrompt hubUrl={hubUrl} outcome={outcome} />)

  await instance.waitUntilExit()

  Deno.exit(outcome.handle ? 0 : 1)
}

type LoginPromptProps = {
  hubUrl: string
  outcome: { handle: string | null }
}

const LoginPrompt = ({ hubUrl, outcome }: LoginPromptProps) => {
  const { exit } = useApp()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [handle, setHandle] = useState<string | null>(null)

  useEffect(() => {
    if (handle) {
      exit()
    }
  }, [handle])

  const onSubmit = (value: string) => {
    const token = value.trim()

    if (!token) {
      setError('Token is empty — paste the PAT and press enter.')
      return
    }

    setSubmitting(true)
    setError(null)

    validateHubToken({ hubUrl, token })
      .then(validatedHandle => {
        writeStoredAuth({ host: hubUrl, token })
        outcome.handle = validatedHandle
        setHandle(validatedHandle)
      })
      .catch(validationError => {
        setError(
          validationError instanceof Error ? validationError.message : String(validationError)
        )
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  if (handle) {
    return <Text>Logged in as {handle}</Text>
  }

  return (
    <Box flexDirection="column">
      <Text>
        Mint a personal access token at <Text color="cyan">{HUB_TOKEN_SETTINGS_URL}</Text>
      </Text>
      <Text dimColor>The write:releases scope is enough for publishing.</Text>
      <Box marginTop={1}>
        {submitting ? (
          <Spinner label="Validating token..." />
        ) : (
          <PasswordInput placeholder="Paste token and press enter" onSubmit={onSubmit} />
        )}
      </Box>
      {error && <Text color="red">{error}</Text>}
    </Box>
  )
}
