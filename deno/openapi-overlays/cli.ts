#!/usr/bin/env -S deno run --allow-read
import { overlayFiles, type OverlayFormat } from './overlay.ts'

// Keep in sync with deno.json's `version`.
const VERSION = '0.2.0'

const HELP = `Usage: overlay --openapi FILEPATH --overlay FILEPATH [--format yaml|json]

Apply an OpenAPI Overlay (1.0.0) document to an OpenAPI description and print
the result to stdout.

Options:
  --openapi <path>      OpenAPI description to overlay (YAML or JSON)
  --overlay <path>      Overlay document to apply
  --format <yaml|json>  Output format (default: inferred from the --openapi
                        file extension, falling back to yaml)
  --json                Shorthand for --format json
  --strict              Exit non-zero if any overlay action fails to apply
  --version             Print the version
  --help                Show this help`

type Flags = {
  openapi?: string
  overlay?: string
  format?: string
  json: boolean
  strict: boolean
  version: boolean
  help: boolean
  unknown?: string
}

function parseFlags(args: string[]): Flags {
  const flags: Flags = { json: false, strict: false, version: false, help: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const eq = arg.indexOf('=')
    const name = eq === -1 ? arg : arg.slice(0, eq)
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1)
    const takeValue = () => inlineValue ?? args[++i]

    switch (name) {
      case '--openapi':
        flags.openapi = takeValue()
        break
      case '--overlay':
        flags.overlay = takeValue()
        break
      case '--format':
        flags.format = takeValue()
        break
      case '--json':
        flags.json = true
        break
      case '--strict':
        flags.strict = true
        break
      case '--version':
        flags.version = true
        break
      case '--help':
        flags.help = true
        break
      default:
        flags.unknown = arg
        break
    }
  }

  return flags
}

/** Resolve the output format from explicit flags, falling back to the input extension. */
function resolveFormat(flags: Flags): OverlayFormat | undefined {
  if (flags.json) return 'json'
  if (flags.format === undefined) {
    return flags.openapi?.toLowerCase().endsWith('.json') ? 'json' : 'yaml'
  }
  if (flags.format === 'yaml' || flags.format === 'json') return flags.format
  return undefined
}

/** Run the CLI. Returns the process exit code. */
export async function main(args: string[]): Promise<number> {
  const flags = parseFlags(args)

  if (flags.unknown) {
    console.warn(`Unknown option: ${flags.unknown}`)
    console.log(HELP)
    return 1
  }
  if (flags.version) {
    console.log(VERSION)
    return 0
  }
  if (flags.help || !flags.openapi || !flags.overlay) {
    console.log(HELP)
    return flags.help ? 0 : 1
  }

  const format = resolveFormat(flags)
  if (format === undefined) {
    console.warn(`Invalid --format value: ${flags.format} (expected yaml or json)`)
    console.log(HELP)
    return 1
  }

  try {
    console.log(await overlayFiles(flags.openapi, flags.overlay, { format, strict: flags.strict }))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    return 1
  }
  return 0
}

if (import.meta.main) {
  Deno.exit(await main(Deno.args))
}
