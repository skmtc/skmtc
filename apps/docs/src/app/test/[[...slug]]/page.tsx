import { DocsApp } from '@/gen/react/DocsApp'
import { DocsJson } from '@/gen/docs-types'
import docsData from '@/gen/docs.json'
import { source } from '@/lib/source'
import { notFound } from 'next/navigation'
import { Metadata } from 'next'

const Test = async (props: PageProps<'/docs/[[...slug]]'>) => {
  const params = await props.params

  console.log('Slug: ', params.slug)

  return <DocsApp slug={params.slug} docsData={docsData as DocsJson} />
}

export default Test

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

export async function generateMetadata(props: PageProps<'/test/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params
  const docs = docsData as DocsJson
  
  // If no slug, this is the index page
  if (!params.slug || params.slug.length === 0) {
    return {
      title: 'Documentation',
      description: 'API Documentation'
    }
  }
  
  // Find the symbol for this slug
  const symbolName = params.slug.join('/')
  const symbol = docs.nodes.find(
    node => node.name === symbolName || node.name.toLowerCase() === symbolName.toLowerCase()
  )
  
  if (!symbol) {
    notFound()
  }

  return {
    title: `${symbol.name} - Documentation`,
    description: symbol.jsDoc?.doc || `Documentation for ${symbol.name}`
  }
}
