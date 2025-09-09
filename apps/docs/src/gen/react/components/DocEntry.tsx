import React from 'react'
import type { DocEntryProps } from '../types'
import { parseMarkdown } from '../utils/jsdoc-links'
import { renderValue } from '../utils/index'

export const DocEntry: React.FC<DocEntryProps> = ({
  name,
  jsDoc,
  location,
  declarationKind,
  def
}) => {
  console.log('DOC ENTRY: ', name, jsDoc, location, declarationKind, def)

  return (
    <article className="doc-entry mb-8 p-4 border rounded-lg">
      <header className="mb-4">
        <h3 className="text-xl font-bold">{name}</h3>
        {declarationKind && <span className="text-sm text-gray-600">{declarationKind}</span>}
        {location && (
          <div className="text-sm text-gray-500 mt-1">
            {location.filename}:{location.line}:{location.col}
          </div>
        )}
      </header>

      {jsDoc?.doc && (
        <div
          className="prose mb-4"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(jsDoc.doc) }}
        />
      )}

      {jsDoc?.tags && jsDoc.tags.length > 0 && (
        <div className="mt-4 space-y-2">
          {jsDoc.tags.map((tag, index) => (
            <div key={index} className="text-sm">
              <span className="font-semibold capitalize">{tag.kind}: </span>
              {tag.name && <span className="font-mono">{tag.name} </span>}
              {tag.doc && <span dangerouslySetInnerHTML={{ __html: parseMarkdown(tag.doc) }} />}
            </div>
          ))}
        </div>
      )}

      {def && (
        <div className="mt-4">
          <pre className="bg-gray-100 p-3 rounded overflow-x-auto">
            <code>{renderValue(def)}</code>
          </pre>
        </div>
      )}
    </article>
  )
}
