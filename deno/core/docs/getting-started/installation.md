# Installation

**Learning Outcome:** Get @skmtc/core running in your project.

## Prerequisites

You need Deno installed on your system.

```bash
# Install Deno if you haven't already
curl -fsSL https://deno.land/install.sh | sh
```

## Import from JSR

Add @skmtc/core to your Deno project:

```typescript
import { toArtifacts } from "jsr:@skmtc/core"
```

## Verify Installation

Create a test file to verify everything works:

```typescript
// test-installation.ts
import { toArtifacts } from "jsr:@skmtc/core"

console.log("@skmtc/core installed successfully!")
```

Run the test:

```bash
deno run test-installation.ts
```

You should see: `@skmtc/core installed successfully!`

## What's Next

- **[First Generator →](first-generator.md)** - Generate your first TypeScript types
- **[Core Concepts →](core-concepts.md)** - Understand the 3-phase pipeline