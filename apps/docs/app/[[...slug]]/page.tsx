import { getPage, getPages } from "@/app/source"
import type { Metadata } from "next"
import { DocsPage, DocsBody } from "fumadocs-ui/page"
import { notFound } from "next/navigation"

type PageProps = {
  params: { slug?: string[] }
}

export default async function Page({ params }: PageProps) {
  const page = getPage(params.slug)

  if (page == null) {
    notFound()
  }

  const MDX = page.data.exports.default

  return (
    <DocsPage
      full={page.data.full}
      tableOfContent={{ enabled: false }}
      tableOfContentPopover={{ enabled: false }}
    >
      <DocsBody className="max-w-4xl mx-auto">
        <h1>{page.data.title}</h1>
        <MDX />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  return getPages().map((page) => ({
    slug: page.slugs,
  }))
}

type GenerateMetadataArgs = { params: { slug?: string[] } }

export function generateMetadata({ params }: GenerateMetadataArgs) {
  const page = getPage(params.slug)

  if (page == null) notFound()

  return {
    title: page.data.title,
    description: page.data.description,
  } satisfies Metadata
}
