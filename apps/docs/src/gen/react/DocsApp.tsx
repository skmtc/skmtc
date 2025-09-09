import React from 'react'
import type { DocNode } from '../docs-types'

interface DocsAppProps {
  docsNode: DocNode
  currentPath?: string
  slug?: string[]
}

export const DocsApp: React.FC<DocsAppProps> = ({ docsNode, currentPath = '/', slug }) => {
  return (
    <div className="ddoc">
      <div id="content">
        <main>

          <section>
  <div class="space-y-2 flex-1">
    {{~> deprecated deprecated ~}}

    {{~> symbol_content sections ~}}
  </div>
</section>


        </main>
      </div>
    </div>
  )
}
