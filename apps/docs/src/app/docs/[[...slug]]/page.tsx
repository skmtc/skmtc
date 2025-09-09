import { DocsBody, DocsDescription, DocsPage, DocsTitle } from 'fumadocs-ui/page'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import docsData from '@/gen/docs.json'
import { DocsApp } from '@/gen/react/DocsApp'
import { DocsJson } from '@/gen/docs-types'

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params

  console.log('Params: ', docsData.nodes)

  const page = docsData.nodes.find(node => node.name === params.slug?.join('/'))

  if (!page) notFound()

  console.log('PAGE: ', page)

  const description = page.jsDoc?.doc?.split('\n')?.[0]

  return (
    <DocsPage /* toc={page?.toc} full={page?.full} */>
      <DocsTitle>{page.name}</DocsTitle>
      {/* <DocsDescription>{description}</DocsDescription> */}
      <DocsBody>
        <DocsApp slug={params.slug} docsData={docsData as DocsJson} />
      </DocsBody>
    </DocsPage>
  )
}

export async function generateStaticParams() {
  const docs = docsData as DocsJson

  // Generate params for all symbols in the docs
  const symbolParams = docs.nodes
    .filter(node => node.kind !== 'moduleDoc') // Exclude module doc from individual pages
    .map(node => ({
      slug: [node.name] // Convert symbol name to slug array
    }))

  // Add the root/index page
  const indexParam = { slug: [] }

  return [indexParam, ...symbolParams]
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params
  const page = docsData.nodes.find(node => node.name === params.slug?.join('/'))

  if (!page) notFound()

  return {
    title: page.name,
    description: page.jsDoc?.doc
  }
}
