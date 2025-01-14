import { HighlightedCode, Pre, RawCode, highlight } from 'codehike/code'
import { useEffect, useState } from 'react'
import { lineNumbers } from './line-numbers'
import { CopyButton } from '@/components/viewer/copy-button'
import { File } from 'lucide-react'
import { useArtifacts } from '@/components/preview/artifacts-context'

export const CodeView = () => {
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null)
  const { state } = useArtifacts()

  const { selectedArtifact } = state

  useEffect(() => {
    highlight(selectedArtifact, 'github-from-css').then(done => setHighlighted(done))
  }, [selectedArtifact.value])

  return highlighted ? (
    <div className="flex flex-col flex-1 relative text-sm" style={highlighted.style}>
      <div className="flex justify-between items-center pl-4 pr-2 border-b">
        <div className="flex h-12 items-center gap-2 text-sm font-medium">
          <File className="size-4" />
          {selectedArtifact.meta}
        </div>
        <CopyButton text={highlighted.code} />
      </div>
      <Pre
        code={highlighted}
        style={{ ...highlighted.style, margin: 0 }}
        handlers={[lineNumbers]}
      />
    </div>
  ) : null
}
