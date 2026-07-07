# @skmtc/vite

Turn a consumer app's own Vite dev server into the SKMTC preview surface: the
plugin serves project metadata, applies enrichment edits, regenerates code, and
renders generated components in an iframe — with the app's real React, aliases,
plugins, and CSS pipeline.

For apps generated or onboarded with [SKMTC](https://skm.tc). The plugin is
dev-only (`apply: 'serve'`) and adds nothing to production builds.

## Install

```sh
pnpm add -D @skmtc/vite
```

Requires Vite 8+, React 18+, and a React plugin (`@vitejs/plugin-react` or
`@vitejs/plugin-react-swc`) — the preview iframe uses the React refresh runtime.

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { skmtcPreview } from '@skmtc/vite'

export default defineConfig({
  plugins: [
    // Place skmtcPreview before plugins that route requests into a Worker
    // runtime (for example @cloudflare/vite-plugin), so the plugin's
    // /__skmtc/* routes are answered before the app's request handling.
    skmtcPreview({ project: 'my-app' }),
    react()
  ]
})
```

`project` names the SKMTC project under `<root>/.skmtc/<project>/`.

### Monorepo layout

When the `.skmtc/` directory lives at the repository root rather than next to
`vite.config.ts`, point `root` at it:

```ts
skmtcPreview({
  project: 'my-app',
  // the directory containing .skmtc/ — here two levels above the Vite app
  root: fileURLToPath(new URL('../../', import.meta.url))
})
```

`settings.basePath` in the project's `client.json` stays relative to that root,
so generated code can land inside the nested app (for example
`apps/my-app/src`).

## Preview providers and global CSS

Previews render inside their own iframe document, so they load none of the
app's HTML entry — no providers, no global stylesheet. To wrap every preview
with the app's context, export `PreviewProviders` from
`src/preview-providers.tsx` (also found: `.ts`, `.jsx`, `.js`):

```tsx
// src/preview-providers.tsx
import './index.css' // global styles (Tailwind, design-system CSS, …)
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const queryClient = new QueryClient()

export const PreviewProviders = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
)
```

The file is optional — without it, previews render bare. The dev server picks
up the file appearing or disappearing without a restart.

## Security

Every `/__skmtc/*` metadata and control route is gated by a per-session bearer
token, so a tunnelled dev server leaks nothing. The token is printed on server
start and written to `node_modules/.cache/skmtc-preview/<project>.token`; the
SKMTC desktop app obtains it automatically over a loopback-only handshake.

## License

Apache-2.0 © SKMTC
