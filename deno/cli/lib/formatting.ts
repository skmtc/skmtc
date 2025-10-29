import '@biomejs/wasm-bundler'
import type { PrettierConfigType } from '@skmtc/core/PrettierConfig'
import type { BiomeInstance } from '../components/TaskContext.tsx'
import { Biome, Distribution } from '@biomejs/js-api'

type FormatFileArgs = {
  content: string
  biome: Biome
  projectKey: number
}

/**
 * Maps Prettier configuration to Biome configuration format.
 * Maintains backward compatibility with existing .prettierrc.json files.
 */
export const toBiomeConfig = (prettierConfig: PrettierConfigType) => {
  return {
    files: {
      ignore: []
    },
    formatter: {
      enabled: true,
      formatWithErrors: false,
      indentStyle: prettierConfig.useTabs ? 'tab' : 'space',
      indentWidth: prettierConfig.tabWidth ?? 2,
      lineWidth: prettierConfig.printWidth ?? 80,
      lineEnding: prettierConfig.endOfLine === 'crlf' ? 'crlf' : 'lf'
    },
    javascript: {
      formatter: {
        enabled: true,
        quoteStyle: prettierConfig.singleQuote ? 'single' : 'double',
        jsxQuoteStyle: prettierConfig.jsxSingleQuote ? 'single' : 'double',
        quoteProperties: 'asNeeded',
        trailingCommas:
          prettierConfig.trailingComma === 'all'
            ? 'all'
            : prettierConfig.trailingComma === 'es5'
              ? 'es5'
              : 'none',
        semicolons: prettierConfig.semi ? 'always' : 'asNeeded',
        arrowParentheses: prettierConfig.arrowParens === 'always' ? 'always' : 'asNeeded',
        bracketSpacing: prettierConfig.bracketSpacing ?? true,
        bracketSameLine: prettierConfig.bracketSameLine ?? false
      }
    }
  }
}

type CreateBiomeInstanceArgs = {
  prettierConfig: PrettierConfigType
  projectPath: string
}

export const createBiomeInstance = async ({
  prettierConfig,
  projectPath
}: CreateBiomeInstanceArgs): Promise<BiomeInstance> => {
  console.log(prettierConfig)

  // Initialize Biome with BUNDLER distribution
  const biome = await Biome.create({
    distribution: Distribution.BUNDLER
  })

  console.log(projectPath)

  console.log(typeof biome.openProject)

  const { projectKey } = biome.openProject(projectPath)

  const biomeConfig = toBiomeConfig(prettierConfig)
  biome.applyConfiguration(projectKey, biomeConfig)

  return { biome, projectKey }
}

export const formatFile = ({ content, biome, projectKey }: FormatFileArgs): string => {
  try {
    // Format content - using .ts extension for TypeScript parser
    const result = biome.formatContent(projectKey, content, {
      filePath: 'generated.ts'
    })

    return result.content
  } catch (e) {
    console.error('Biome formatting error:', e)

    // Fallback to unformatted content on error
    return content
  }
}
