<div align="left">
  <img alt="Skmtc logo" src="assets/skmtc.svg">
  <br />
  <br />
</div>

[![Coverage Status](https://coveralls.io/repos/github/skmtc/skmtc/badge.svg?branch=main)](https://coveralls.io/github/skmtc/skmtc?branch=main)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Deno](https://img.shields.io/badge/Deno-2.5+-green.svg)](https://deno.land/)
[![Discord](https://img.shields.io/badge/Discord-join%20chat-1dce73.svg)](https://discord.com/invite/Mg88C8Xu5Y)

# Skmtc is the fastest OpenAPI code generation framework for TypeScript

- **Strings not ASTs** - because nobody wants to edit ASTs by hand
- **Code not config** - full control over output
- **Modular and extensible** - think React, but for code generation

```
🚀 Time to convert Github OpenAPI to Zod schemas (lower is better)

skmtc-zod       0.51s   ██▎ 1.0x
orval-zod       4.85s   ████████████████████▎ 9.5x
kubb-zod        7.63s   ███████████████████████████████▉ 14.9x
openapi-ts-zod  11.95s  █████████████████████████████████████████████████▉ 23.3x
                        ◺ 0.00                                     12.00 ◿
```
See [openapi-codegen-benchmarks](https://github.com/skmtc/openapi-codegen-benchmarks) for full details

### Install Deno if needed

```bash
# On MacOS/Linus
curl -fsSL https://deno.land/install.sh | sh

# On Windows
irm https://deno.land/install.ps1 | iex
```

### Install Skmtc

```bash
deno install -g -A --unstable-worker-options jsr:@skmtc/cli@0.0.388 -n skmtc -f
```

### Create project and generate artifacts using TUI

```bash
# Create project then Generate artifacts 
skmtc
```

https://github.com/user-attachments/assets/375aedde-aed8-42a3-bd13-3004f736dee7

https://github.com/user-attachments/assets/c830e57a-4767-46e3-b27e-e518c9f6b0d7

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



## 📦 Available Generators

Choose from our growing collection of generators, combone them or create your own:

- **Tanstack Query** - React Query hooks with Zod validation
- **MSW** - Mock Service Worker handlers from OpenAPI examples
- **Zod Schemas** - Runtime validation schemas
- **TypeScript Types** - Pure type definitions
- **Supabase/Hono Functions** - Edge function handlers
- See full list at https://github.com/skmtc/skmtc-generators

## ❓ FAQ

### **What OpenAPI versions are supported?**
Skmtc supports OpenAPI v3.0. Swagger 2.0 and OpenAPI v3.1 are automatically converted to OpenAPI v3.0.

### **Can I customize the generated code?**
Yes! Each Transformer specifies its output using plain string templates, which means you can
edit them as would you edit any other code.

### **Can I use this with my existing React app?**
Yes! Skmtc generates standalone code that integrates with any React application. The generated components work with your existing setup.

### **How does this compare to OpenAPI Generator?**
Skmtc is the only code generation framework that provides full control over the generated code. You are not limited by library-specific settings and you do not need to write complex AST code.

### **Does it work with Next.js/Remix/Vite?**
Yes! The generated code is framework-agnostic TypeScript that works with any build tool or library.

## 🤝 Contributing

We welcome contributions! Check out our [Contributing Guide](CONTRIBUTING.md) to get started.

<!-- ## 📚 Documentation

- [Full Documentation](https://docs.skmtc.dev)
- [API Reference](https://docs.skmtc.dev/api)
- [Custom Generators Guide](https://docs.skmtc.dev/generators)
- [Examples](https://github.com/skmtc/skmtc/tree/main/examples) -->

## 🛟 Support

- [GitHub Issues](https://github.com/skmtc/skmtc/issues) - Bug reports and feature requests
- [Discord Community](https://discord.com/invite/Mg88C8Xu5Y) - Get help and share your experience

## 📄 License

Apache 2.0 © [Skmtc Contributors](LICENSE.md)

