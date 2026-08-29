<div align="left">
  <img alt="Skmtc logo" src="assets/skmtc.svg">
  <br />
  <br />
</div>

[![Coverage Status](https://coveralls.io/repos/github/skmtc/skmtc/badge.svg?branch=main)](https://coveralls.io/github/skmtc/skmtc?branch=main)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Deno](https://img.shields.io/badge/Deno-2.5+-green.svg)](https://deno.land/)
[![Discord](https://img.shields.io/badge/Discord-join%20chat-1dce73.svg)](https://discord.com/invite/Mg88C8Xu5Y)

## Skmtc is an OpenAPI code generation framework for TypeScript

- **Fast** - Github OpenAPI to Zod in 0.51 seconds - 9.5x faster than Orval
- **Composable and modular** - Encapsulate generation logic in modules and reuse
- **Code not config** - Full control over output, variable names and file structure
- **Customisable** - Supports custom edge case handling

## Getting started

### Install Skmtc

```bash
curl -fsSL https://skmtc.dev/install | sh
```

This installs the latest `skmtc` CLI, bootstrapping [Deno](https://deno.com)
(its runtime) automatically if it isn't already installed. To pin a specific
version, set `SKMTC_VERSION`:

```bash
SKMTC_VERSION=0.9.26 curl -fsSL https://skmtc.dev/install | sh
```

### Create project and generate artifacts using TUI

```bash
skmtc
```

![](assets/demo.gif)

### Install the agent skills

Five skills teach a coding agent to author Skmtc generators, and ship from the
same commit as the code they describe: `skmtc-generator` (engine rules),
`skmtc-lang-typescript` (the emitted TypeScript), `skmtc-model` and
`skmtc-operation` (the two generator shapes), and `skmtc-cli`.

```bash
# Claude Code
/plugin marketplace add skmtc/skmtc
/plugin install skmtc@skmtc

# any skills-capable agent
npx skills add skmtc/skmtc
npx skills add skmtc/skmtc --skill skmtc-generator
```

The sources live in
[`deno/docs/skills/`](deno/docs/skills/) and read fine on their own.

## Available generators

|                | Libraries          | Generator repo        | Status |
| -------------- | ------------------ | --------------------- | ------ |
| ![](assets/arktype.svg) | Arktype | [@skmtc/gen-arktype](https://github.com/skmtc/skmtc-generators/tree/main/gen-arktype) | 🚀 Now |
| ![](assets/typescript.svg) | TypeScript | [@skmtc/gen-typescript](https://github.com/skmtc/skmtc-generators/tree/main/gen-typescript) | 🚀 Now |
| ![](assets/valibot.svg) | Valibot | [@skmtc/gen-valibot](https://github.com/skmtc/skmtc-generators/tree/main/gen-valibot) | 🚀 Now |
| ![](assets/zod.svg) | Zod | [@skmtc/gen-zod](https://github.com/skmtc/skmtc-generators/tree/main/gen-zod) | 🚀 Now |
| ![](assets/msw.svg) | MSW | [@skmtc/gen-msw](https://github.com/skmtc/skmtc-generators/tree/main/gen-msw) | 🚀 Now |
| ![](assets/supabase.svg) ![](assets/hono.svg) | Supabase + Hono | [@skmtc/gen-supabase-hono](https://github.com/skmtc/skmtc-generators/tree/main/gen-supabase-hono) | 🚀 Now |
| | Express | [@skmtc/gen-express](https://github.com/skmtc/skmtc-generators/tree/main/gen-express) | 🚀 Now |
| ![](assets/reactquery.svg) ![](assets/zod.svg) | React Query (Fetch + Zod) | [@skmtc/gen-tanstack-query-fetch-zod](https://github.com/skmtc/skmtc-generators/tree/main/gen-tanstack-query-fetch-zod) | 🚀 Now |
| ![](assets/reactquery.svg) ![](assets/supabase.svg) ![](assets/zod.svg) | React Query (Supabase + Zod) | [@skmtc/gen-tanstack-query-supabase-zod](https://github.com/skmtc/skmtc-generators/tree/main/gen-tanstack-query-supabase-zod) | 🚀 Now |
| ![](assets/shadcnui.svg) | Shadcn Form | [@skmtc/gen-shadcn-form](https://github.com/skmtc/skmtc-generators/tree/main/gen-shadcn-form) | 🚀 Now |
| ![](assets/shadcnui.svg) | Shadcn Select | [@skmtc/gen-shadcn-select](https://github.com/skmtc/skmtc-generators/tree/main/gen-shadcn-select) | 🚀 Now |
| ![](assets/shadcnui.svg) | Shadcn Table | [@skmtc/gen-shadcn-table](https://github.com/skmtc/skmtc-generators/tree/main/gen-shadcn-table) | 🚀 Now |
| | DaisyUI Form | [@skmtc/gen-daisyui-form](https://github.com/skmtc/skmtc-generators/tree/main/gen-daisyui-form) | 🚀 Now |
| | GraphQL Operation | [@skmtc/gen-graphql-operation](https://github.com/skmtc/skmtc-generators/tree/main/gen-graphql-operation) | 🚀 Now |
| | GraphQL Typed Document Node | [@skmtc/gen-graphql-typed-document-node](https://github.com/skmtc/skmtc-generators/tree/main/gen-graphql-typed-document-node) | 🚀 Now |

## Performance vs other code generators

```
🚀 Time to convert Github OpenAPI to Zod schemas (lower is better)

skmtc-zod       0.51s   ██▎ 1.0x
orval-zod       4.85s   ████████████████████▎ 9.5x
kubb-zod        7.63s   ███████████████████████████████▉ 14.9x
openapi-ts-zod  11.95s  █████████████████████████████████████████████████▉ 23.3x
                        ◺ 0.00                                     12.00 ◿
```
See [openapi-codegen-benchmarks](https://github.com/skmtc/openapi-codegen-benchmarks) for full details

<!-- ## 
## How does it work?

Skmtc handles all OpenAPI parsing and output rendering, which means each generator only needs to specify how to represent its API schema input as a code string.

The process runs in 3 phases

1. **Parse** - Converts input OpenAPI schema into an **OasDocument** object
2. **Generate** - Creates **Projection** objects from operations and models in OasDocument and writes them to respective **File** objects
3. **Render** - Outputs generated **File** objects as code files

Let's take a look at an example, where we create a `fetch` based API client with Zod type checking

```typescript
import { ZodInsertable } from '@skmtc/gen-zod'

class ZodFetch extends BaseProjection {
  zodName: string;

  constructor({context, operation, settings}){
    super({context, operation, settings})

    // To add Zod type checks, we look up the response schema for each operation,
    const response = operation.toSuccessResponse()?.resolve().toSchema()

    // generate a Zod schema from it and insert it into current file
    const zodResponse = this.insert(ZodInsertable, response)

    // Assign schema name to object so it can be accessed from `toString()` below
    this.zodName = zodResponse.identifier.name
  }

  // Map object properties to output code
  toString(){
    return `() => {
      const res = await fetch('${this.operation.path}')
      const data = await res.json()

      return ${zodName}.parse(data)
    }`
  }
}
```
-->

## Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

<!-- ## 📚 Documentation

- [Full Documentation](https://docs.skmtc.dev)
- [API Reference](https://docs.skmtc.dev/api)
- [Custom Generators Guide](https://docs.skmtc.dev/generators)
- [Examples](https://github.com/skmtc/skmtc/tree/main/examples) -->

## Support

- [GitHub Issues](https://github.com/skmtc/skmtc/issues) - Bug reports and feature requests
- [Discord Community](https://discord.com/invite/Mg88C8Xu5Y) - Get help and share your experience

## License

Apache 2.0 © [Skmtc Contributors](LICENSE.md)
