[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-green.svg)](https://opensource.org/licenses/Apache-2.0)
[![Deno](https://img.shields.io/badge/Deno-2.5+-green.svg)](https://deno.land/)
[![Discord](https://img.shields.io/badge/Discord-join%20chat-1dce73.svg)](https://discord.gg/https://discord.com/invite/Mg88C8Xu5Y)

<p align="center">
  <img src="./skmtc.svg" />
</p>

**Generate production-ready, type-safe code from OpenAPI specifications in seconds.** Skmtc transforms your OpenAPI v3 documents into fully-typed TypeScript code, React components, API clients, and more.

## ✨ Why Skmtc?

- 🏎️ **Fast** - Generates 350k+ tokens per second
- 🧵 **Easy to edit code generators** - Outputs specified using string templates, not ASTs
- 🥞 **Stackable generators** - Combine multiple generators to generate deep functionality
- 🗄️ **Use your own code conventions** - Full control over naming and file structure
- 🎨 **Formatted output** - Prettier integration for consistent styling
- 🍱 **Choose from 11 ready-to-use generators** - Generators include Tanstack Query, Zod, TypeScript, and more - https://github.com/skmtc/skmtc-generators

## 🚀 Quick Start

```bash
# Run directly with npx
npx skmtc

# Try it out

# Generates Supabase Edge Functions with Hono server and Zod validation for the Petstore API
npx skmtc generate @skmtc/supabase-backend https://petstore3.swagger.io/api/v3/openapi.json

# Generates React Query hooks with Supabase client and Zod validation for entire Cloudflare API
npx skmtc generate @skmtc/supabase-react-client https://raw.githubusercontent.com/cloudflare/api-schemas/refs/heads/main/openapi.json


```

That's it! Skmtc will guide you through selecting generators and configuring your output.

## 📦 Available Generators

Choose from our growing collection of generators, combone them or create your own:

- **Tanstack Query** - React Query hooks with Zod validation
- **MSW** - Mock Service Worker handlers from OpenAPI examples
- **Zod Schemas** - Runtime validation schemas
- **TypeScript Types** - Pure type definitions
- **Supabase/Hono Functions** - Edge function handlers

### Developer Experience First
- 🎯 **Interactive CLI** - Guided setup and configuration
- 🔥 **Hot Reload** - Watch mode for automatic regeneration
- 🎨 **Prettier Integration** - Auto-formatted output
- 🔍 **Type Safety** - Full TypeScript support throughout

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

---

Built with ❤️ by developers, for developers. Transform your API development workflow today.