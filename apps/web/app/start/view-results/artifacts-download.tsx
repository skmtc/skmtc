import { Button } from '@/components/ui/button'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

type ArtifactsDownloadProps = {
  artifacts: Record<string, string>
  downloadFileTree: Record<string, string>
}

export const ArtifactsDownload = ({ artifacts, downloadFileTree }: ArtifactsDownloadProps) => {
  const isEmpty = Object.keys(artifacts ?? {}).length === 0

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="link"
          className="text-indigo-600 no-underline hover:underline px-1"
          disabled={isEmpty}
        >
          Download
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => downloadArtifacts({ name: 'reapit-artifacts', artifacts })}
        >
          Generated artifacts
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            downloadArtifacts({ name: 'reapit-foundations', artifacts, downloadFileTree })
          }}
        >
          Runnable project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

type DownloadArtifactsArgs = {
  name: string
  artifacts: Record<string, string>
  downloadFileTree?: Record<string, string>
}

const downloadArtifacts = async ({
  name,
  artifacts,
  downloadFileTree = {}
}: DownloadArtifactsArgs) => {
  const zip = new JSZip()

  Object.entries(downloadFileTree).forEach(([name, content]) => {
    zip.file(name, content)
  })

  Object.entries(artifacts).forEach(([name, content]) => {
    zip.file(name, content)
  })

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, `${name}.zip`)
}
