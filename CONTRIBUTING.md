# Contributing to Skmtc

Thank you for your interest in contributing to Skmtc! We welcome contributions that improve code quality, developer experience, and documentation.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Pull Request Process](#pull-request-process)
- [Code Quality Standards](#code-quality-standards)
- [Architecture Changes](#architecture-changes)
- [Commit Messages](#commit-messages)
- [Issue Guidelines](#issue-guidelines)

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and constructive in all interactions.

## How Can I Contribute?

### 🐛 Reporting Bugs
- Check if the issue already exists
- Include reproduction steps
- Provide your environment details (OS, Node/Deno version)
- Include relevant error messages and logs

### 💡 Suggesting Features
- Check existing issues and discussions first
- Clearly describe the problem you're solving
- Provide examples of how the feature would work
- Consider the impact on existing users

### 📝 Improving Documentation
- Fix typos and clarify confusing sections
- Add examples and use cases
- Improve API documentation
- Translate documentation

### 🔧 Submitting Code
- Fix bugs
- Add tests
- Improve performance
- Enhance developer experience
- Add new generators

## Development Setup

### Prerequisites
- Deno 2.1+ 
- Node.js 20+ (for workspace packages)
- pnpm 10.12.1+
- Git

### Initial Setup

```bash
# Clone the repository
git clone https://github.com/skmtc/skmtc.git
cd skmtc

# Install dependencies
pnpm install

# Navigate to Deno workspace
cd deno

# Run tests to verify setup
deno test

# Type check
deno check mod.ts
```

### Repository Structure

```
skmtc/
├── deno/              # Main Deno workspace
│   ├── core/          # Core library (@skmtc/core)
│   ├── cli/           # CLI tool (@skmtc/cli)
│   ├── mcp/           # MCP server
│   └── server/        # Server components
├── apps/              # Example applications
└── packages/          # NPM packages
```

## Development Workflow

### 1. Create a Branch

```bash
# For features
git checkout -b feature/your-feature-name

# For fixes
git checkout -b fix/issue-description

# For docs
git checkout -b docs/what-you-are-documenting
```

### 2. Make Your Changes

Follow our code quality standards (see below).

### 3. Test Your Changes

```bash
# Run all tests
deno test

# Run specific test file
deno test path/to/test.ts

# Type checking
deno check mod.ts

# Linting
deno lint

# Format code
deno fmt
```

### 4. Test CLI Changes

```bash
# Test CLI locally
cd deno/cli
deno run mod.ts

# Test specific command
deno run mod.ts generate
```

### 5. Update Documentation

- Update relevant README files
- Add JSDoc comments for new functions
- Update CLAUDE.md if changing architecture

## Pull Request Process

### Before Submitting

1. **Test thoroughly** - All tests must pass
2. **Format code** - Run `deno fmt`
3. **Check types** - Run `deno check mod.ts`
4. **Lint** - Run `deno lint`
5. **Update docs** - Document new features/changes
6. **Write good commit messages** - See guidelines below

### PR Guidelines

#### Title Format
```
<type>: <short description>

Types: feat, fix, docs, style, refactor, perf, test, chore
```

#### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Tests pass locally
- [ ] Added new tests for changes
- [ ] Existing tests updated

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex code
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. Automated checks must pass
2. At least one maintainer review required
3. Address all feedback constructively
4. Keep PRs focused and reasonable in size

## Code Quality Standards

### TypeScript/Deno Guidelines

```typescript
// ✅ Good: Use explicit types for function parameters
function processSchema(schema: OpenAPISchema, options: GeneratorOptions): Result {
  // ...
}

// ❌ Bad: Avoid any types
function processSchema(schema: any, options: any) {
  // ...
}
```

### Import Rules

```typescript
// ✅ Good: Import from JSR for @std packages
import { assertEquals } from "@std/assert"

// ❌ Bad: Don't import @std from npm
import { assertEquals } from "npm:@std/assert"
```

### Error Handling

```typescript
// ✅ Good: Provide context in errors
throw new Error(`Failed to parse OpenAPI document at ${path}: ${error.message}`)

// ❌ Bad: Generic errors
throw new Error("Parse failed")
```

### Testing

- Write tests for new features
- Maintain or improve code coverage
- Use descriptive test names
- Test edge cases

```typescript
Deno.test("toArtifacts should handle missing required fields gracefully", async () => {
  // Test implementation
})
```

### Performance

- Avoid unnecessary iterations
- Use appropriate data structures
- Consider memory usage for large schemas
- Profile before optimizing

## Architecture Changes

**Important**: Changes that affect the overall architecture MUST be discussed before implementation.

### What Requires Discussion?

- Changes to the three-phase pipeline (Parse → Generate → Render)
- New generator base classes or DSL changes
- Breaking changes to public APIs
- Major dependency additions
- Changes to the plugin system
- Modifications to core data structures

### How to Propose Architecture Changes

1. **Open a Discussion** on GitHub Discussions
2. **Include:**
   - Problem description
   - Proposed solution
   - Alternative approaches considered
   - Impact on existing code
   - Migration strategy (if breaking)
3. **Wait for consensus** before starting implementation
4. **Reference the discussion** in your PR

### Example Proposal

```markdown
## Proposal: Add Streaming Support for Large OpenAPI Documents

### Problem
Large OpenAPI documents (>50MB) cause memory issues...

### Proposed Solution
Implement streaming parser using...

### Alternatives Considered
1. Chunking approach - Rejected because...
2. Worker threads - Rejected because...

### Impact
- Non-breaking for existing users
- New optional parameter in toArtifacts()
- Performance improvement for large schemas
```

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Examples

```bash
feat(cli): add watch mode for auto-regeneration

fix(core): handle circular references in OpenAPI schemas

docs(readme): add FAQ section about authentication

perf(parser): optimize allOf merging for deeply nested schemas

refactor(generators): extract common logic to base class

test(cli): add integration tests for init command

chore(deps): update Deno to 2.5.0
```

## Issue Guidelines

### Bug Reports Should Include

```markdown
**Environment:**
- OS: macOS 14.0
- Deno version: 2.5.0
- Node version: 22.12.0
- Package version: @skmtc/cli@0.1.0

**Description:**
Clear description of the bug

**Steps to Reproduce:**
1. Run command X
2. Provide input Y
3. See error Z

**Expected Behavior:**
What should happen

**Actual Behavior:**
What actually happens

**Error Messages:**
```
Paste full error here
```

**OpenAPI Schema (if relevant):**
```json
{
  "openapi": "3.0.0",
  ...
}
```
```

### Feature Requests Should Include

- **Problem**: What problem does this solve?
- **Solution**: How would you like it to work?
- **Alternatives**: What alternatives have you considered?
- **Use Case**: Real-world example of usage

## Getting Help

- 💬 [GitHub Discussions](https://github.com/skmtc/skmtc/discussions) - Ask questions
- 🐛 [Issue Tracker](https://github.com/skmtc/skmtc/issues) - Report bugs
- 📚 [Documentation](https://docs.skmtc.dev) - Read the docs
- 💻 [Discord](https://discord.com/invite/Mg88C8Xu5Y) - Chat with community

## Recognition

Contributors will be recognized in:
- Release notes
- Contributors list
- Project documentation

Thank you for helping make Skmtc better! 🎉