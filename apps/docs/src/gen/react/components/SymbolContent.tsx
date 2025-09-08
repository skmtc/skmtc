import React from 'react'
import { Section } from './Section'
import Markdown from 'react-markdown'
import { processJSDocLinks } from '../utils/jsdoc-links'

interface SymbolContentProps {
  id?: string
  docs?: string
  sections?: Array<{
    header?: {
      anchor: { id: string }
      href?: string
      title: string
      doc?: string
    }
    content: {
      kind: string
      content: any[]
    }
  }>
  content?: any
}

export const SymbolContent: React.FC<SymbolContentProps> = ({ id, docs, sections, content }) => {
  return (
    <div className="space-y-7" id={id}>
      {docs && (
        <div>
          <Markdown>{processJSDocLinks(docs)}</Markdown>
        </div>
      )}

      {sections && sections.map((section, index) => <Section key={index} {...section} />)}

      {content && (
        <div>
          {/* Generic content rendering - would need specific handling based on type */}
          <pre>{JSON.stringify(content, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
