import docsJson from './src/docs.json' with { type: 'json' }
import { docsJsonSchema } from './src/docs-schemas.ts'
import type { DocNode, TsType, JsDoc } from './src/docs-types.ts'
import { ensureDir } from '@std/fs'
import { join } from '@std/path'

// Helper to convert a name to a filename
const toFilename = (name: string): string => {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase() || 'unnamed'
}

// Helper to convert JSDoc links to Markdown links
const convertJsDocLinks = (text: string): string => {
  // Convert {@link ClassName} to [ClassName](./classname.mdx)
  return text.replace(/\{@link\s+([^}]+)\}/g, (match, linkText) => {
    const cleanName = linkText.trim()
    const filename = toFilename(cleanName)
    return `[${cleanName}](./${filename}.mdx)`
  })
}

// Helper to format JSDoc as markdown
const formatJsDoc = (jsDoc?: JsDoc): string => {
  if (!jsDoc) return ''
  
  let content = ''
  
  if (jsDoc.doc) {
    content += convertJsDocLinks(jsDoc.doc) + '\n\n'
  }
  
  if (jsDoc.tags && jsDoc.tags.length > 0) {
    for (const tag of jsDoc.tags) {
      switch (tag.kind) {
        case 'param':
          content += `**@param** ${tag.name || ''} ${convertJsDocLinks(tag.doc || '')}\n\n`
          break
        case 'return':
        case 'returns':
          content += `**@returns** ${convertJsDocLinks(tag.doc || '')}\n\n`
          break
        case 'throws':
          content += `**@throws** ${convertJsDocLinks(tag.doc || '')}\n\n`
          break
        case 'example':
          content += `## Example\n\n${convertJsDocLinks(tag.doc || '')}\n\n`
          break
        case 'deprecated':
          content += `> **Deprecated**: ${convertJsDocLinks(tag.doc || '')}\n\n`
          break
        default:
          if (tag.doc) {
            content += `**@${tag.kind}** ${convertJsDocLinks(tag.doc)}\n\n`
          }
          break
      }
    }
  }
  
  return content
}

// Helper to format type representation
const formatType = (type?: TsType | null): string => {
  if (!type) return 'unknown'
  return type.repr || 'unknown'
}

// Generate MDX content for a DocNode
const generateMdx = (node: DocNode): string => {
  const title = node.name || 'Untitled'
  const rawFilename = node.location.filename.replace('file://', '')
  // Strip path information above skmtc/deno/core
  const filename = rawFilename.includes('skmtc/deno/core') 
    ? rawFilename.substring(rawFilename.indexOf('skmtc/deno/core'))
    : rawFilename
  
  let description = ''
  
  // Extract description from JSDoc
  if (node.jsDoc?.doc) {
    const lines = node.jsDoc.doc.split('\n')
    description = convertJsDocLinks(lines[0] || title)
  } else {
    description = `${node.kind} ${title}`
  }
  
  // Generate frontmatter
  let frontmatter = `---
title: "${title}"
description: "${description.replace(/"/g, '\\"')}"
kind: "${node.kind}"
filename: "${filename}"
line: ${node.location.line}
---

`
  
  // Add main heading
  frontmatter += `# ${title}\n\n`
  
  // Add JSDoc content
  const jsDocContent = formatJsDoc(node.jsDoc)
  if (jsDocContent) {
    frontmatter += jsDocContent
  }
  
  // Add kind-specific content
  switch (node.kind) {
    case 'function':
      if ('functionDef' in node && node.functionDef) {
        frontmatter += `## Signature\n\n`
        frontmatter += '```typescript\n'
        
        const params = node.functionDef.params?.map(p => {
          if (p.kind === 'identifier' && 'name' in p && p.name) {
            const optional = p.optional ? '?' : ''
            const type = formatType(p.tsType)
            return `${p.name}${optional}: ${type}`
          }
          return '...'
        }).join(', ') || ''
        
        const returnType = formatType(node.functionDef.returnType)
        const asyncPrefix = node.functionDef.isAsync ? 'async ' : ''
        
        frontmatter += `${asyncPrefix}function ${title}(${params}): ${returnType}\n`
        frontmatter += '```\n\n'
      }
      break
      
    case 'class':
      if ('classDef' in node && node.classDef) {
        frontmatter += `## Class Definition\n\n`
        
        if (node.classDef.constructors.length > 0) {
          frontmatter += `### Constructors\n\n`
          for (const constructor of node.classDef.constructors) {
            const params = constructor.params?.map(p => {
              if (p.kind === 'identifier' && 'name' in p && p.name) {
                const optional = p.optional ? '?' : ''
                const type = formatType(p.tsType)
                return `${p.name}${optional}: ${type}`
              }
              return '...'
            }).join(', ') || ''
            
            frontmatter += `- \`constructor(${params})\`\n`
          }
          frontmatter += '\n'
        }
        
        if (node.classDef.properties.length > 0) {
          frontmatter += `### Properties\n\n`
          for (const prop of node.classDef.properties) {
            const readonly = prop.readonly ? 'readonly ' : ''
            const static_ = prop.isStatic ? 'static ' : ''
            const optional = prop.optional ? '?' : ''
            const type = formatType(prop.tsType)
            
            frontmatter += `- \`${static_}${readonly}${prop.name}${optional}: ${type}\`\n`
          }
          frontmatter += '\n'
        }
        
        if (node.classDef.methods.length > 0) {
          frontmatter += `### Methods\n\n`
          for (const method of node.classDef.methods) {
            const static_ = method.isStatic ? 'static ' : ''
            const optional = method.optional ? '?' : ''
            
            const params = method.functionDef.params?.map(p => {
              if (p.kind === 'identifier' && 'name' in p && p.name) {
                const paramOptional = p.optional ? '?' : ''
                const type = formatType(p.tsType)
                return `${p.name}${paramOptional}: ${type}`
              }
              return '...'
            }).join(', ') || ''
            
            const returnType = formatType(method.functionDef.returnType)
            
            frontmatter += `- \`${static_}${method.name}${optional}(${params}): ${returnType}\`\n`
          }
          frontmatter += '\n'
        }
      }
      break
      
    case 'interface':
      if ('interfaceDef' in node && node.interfaceDef) {
        frontmatter += `## Interface Definition\n\n`
        
        if (node.interfaceDef.properties.length > 0) {
          frontmatter += `### Properties\n\n`
          for (const prop of node.interfaceDef.properties) {
            const optional = prop.optional ? '?' : ''
            const type = formatType(prop.tsType)
            frontmatter += `- \`${prop.name}${optional}: ${type}\`\n`
          }
          frontmatter += '\n'
        }
        
        if (node.interfaceDef.methods.length > 0) {
          frontmatter += `### Methods\n\n`
          for (const method of node.interfaceDef.methods) {
            const optional = method.optional ? '?' : ''
            const params = method.params?.map(p => {
              if (p.kind === 'identifier' && 'name' in p && p.name) {
                const paramOptional = p.optional ? '?' : ''
                const type = formatType(p.tsType)
                return `${p.name}${paramOptional}: ${type}`
              }
              return '...'
            }).join(', ') || ''
            
            const returnType = formatType(method.returnType)
            frontmatter += `- \`${method.name}${optional}(${params}): ${returnType}\`\n`
          }
          frontmatter += '\n'
        }
      }
      break
      
    case 'typeAlias':
      if ('typeAliasDef' in node && node.typeAliasDef) {
        frontmatter += `## Type Definition\n\n`
        frontmatter += '```typescript\n'
        frontmatter += `type ${title} = ${formatType(node.typeAliasDef.tsType)}\n`
        frontmatter += '```\n\n'
      }
      break
      
    case 'variable':
      if ('variableDef' in node && node.variableDef) {
        frontmatter += `## Variable Definition\n\n`
        frontmatter += '```typescript\n'
        frontmatter += `${node.variableDef.kind} ${title}: ${formatType(node.variableDef.tsType)}\n`
        frontmatter += '```\n\n'
      }
      break
      
    case 'enum':
      if ('enumDef' in node && node.enumDef) {
        frontmatter += `## Enum Definition\n\n`
        frontmatter += '```typescript\n'
        frontmatter += `enum ${title} {\n`
        for (const member of node.enumDef.members) {
          const init = member.init ? ` = ${formatType(member.init)}` : ''
          frontmatter += `  ${member.name}${init},\n`
        }
        frontmatter += '}\n'
        frontmatter += '```\n\n'
      }
      break
  }
  
  // Add source location
  frontmatter += `## Source\n\n`
  frontmatter += `Located at \`${filename}:${node.location.line}:${node.location.col}\`\n`
  
  return frontmatter
}

const main = async () => {
  console.log('🔍 Parsing docs.json...')
  const parsed = docsJsonSchema.parse(docsJson)
  
  console.log(`📄 Found ${parsed.nodes.length} documentation nodes`)
  
  // Ensure output directory exists
  const outDir = '../../../apps/docs/content/docs'
  await ensureDir(outDir)
  
  console.log('📝 Generating MDX files...')
  
  let generated = 0
  
  for (const node of parsed.nodes) {
    // Skip module doc nodes as they don't have meaningful individual content
    if (node.kind === 'moduleDoc') continue
    
    const filename = toFilename(node.name)
    const filepath = join(outDir, `${filename}.mdx`)
    
    try {
      const mdxContent = generateMdx(node)
      await Deno.writeTextFile(filepath, mdxContent)
      generated++
    } catch (error) {
      console.error(`❌ Error generating ${filepath}:`, error)
    }
  }
  
  console.log(`✅ Generated ${generated} MDX files in ${outDir}/`)
}

if (import.meta.main) {
  await main()
}