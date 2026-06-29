/**
 * `skmtc logout` — delete the stored hub credential.
 *
 * Idempotent: exits 0 (and emits `{ "type": "logged-out" }` under
 * `--json`) whether or not a token was stored. Touches only
 * `~/.skmtc/auth.json`; `--token` flags and `$SKMTC_HUB_TOKEN` are
 * the caller's to manage.
 */

import { deleteStoredAuth } from '@/lib/hub-token.ts'
import { resolveOutputFormat } from '@/lib/strict-mode.ts'

type RenderLogoutArgs = {
  jsonFlag?: boolean
}

export const renderLogout = ({ jsonFlag }: RenderLogoutArgs): void => {
  const removed = deleteStoredAuth()

  if (resolveOutputFormat({ jsonFlag }) === 'json') {
    console.log(JSON.stringify({ type: 'logged-out', removed }, null, 2))
  } else {
    console.log(removed ? 'Logged out — stored token deleted.' : 'Logged out — no stored token.')
  }

  Deno.exit(0)
}
