/**
 * `skmtc logout` — sign out of skmtc-hub and delete the stored credential.
 *
 * For a browser sign-in, the refresh token is revoked at identity first, so
 * the token stops working everywhere, not only on this machine. The file is
 * deleted either way; when the revoke fails, the output says so and points
 * to Settings > Connected apps. A stored PAT is only deleted: revoke it in
 * the hub's token settings.
 *
 * Idempotent: exits 0 (and emits `{ "type": "logged-out" }` under
 * `--json`) whether or not a token was stored. `--token` flags and
 * `$SKMTC_HUB_TOKEN` are the caller's to manage.
 */

import { deleteStoredAuth, readStoredAuth, withAuthLock } from '@/lib/hub-token.ts'
import { revokeRefreshToken } from '@/lib/device-login.ts'
import { HUB_HOSTS } from '@/lib/hub-env.ts'
import { resolveOutputFormat } from '@/lib/strict-mode.ts'

type RenderLogoutArgs = {
  jsonFlag?: boolean
}

type Revoked = 'revoked' | 'not-applicable' | 'failed'

/**
 * Revoke and delete under the auth lock, so a refresh in another command
 * cannot write a new auth.json after the delete.
 */
export const logout = (): Promise<{ removed: boolean; revoked: Revoked }> =>
  withAuthLock(async () => {
    const stored = readStoredAuth()

    const revoked: Revoked = await (async () => {
      if (!stored?.refreshToken) return 'not-applicable'
      try {
        await revokeRefreshToken({ env: stored.env, refreshToken: stored.refreshToken })
        return 'revoked'
      } catch {
        return 'failed'
      }
    })()

    return { removed: deleteStoredAuth(), revoked }
  })

export const renderLogout = async ({ jsonFlag }: RenderLogoutArgs): Promise<void> => {
  const stored = readStoredAuth()
  const { removed, revoked } = await logout()

  if (resolveOutputFormat({ jsonFlag }) === 'json') {
    console.log(JSON.stringify({ type: 'logged-out', removed, revoked }, null, 2))
  } else {
    console.log(removed ? 'Logged out — stored token deleted.' : 'Logged out — no stored token.')
    if (revoked === 'failed' && stored) {
      console.error(
        `Could not revoke the sign-in at ${HUB_HOSTS[stored.env].web}. ` +
          'Revoke the Skmtc CLI in Settings > Connected apps.'
      )
    }
  }

  Deno.exit(0)
}
