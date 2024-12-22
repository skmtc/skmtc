import { Pre, RawCode, highlight } from 'codehike/code'
import { Block, CodeBlock, parseProps } from 'codehike/blocks'
import { z } from 'zod'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

const Schema = Block.extend({ tabs: z.array(CodeBlock) })

export async function CodeWithTabs(props: unknown) {
  const { tabs } = parseProps(props, Schema)
  return <CodeTabs tabs={tabs} />
}

export async function CodeTabs(props: { tabs: RawCode[] }) {
  const { tabs } = props
  const highlighted = await Promise.all(tabs.map(tab => highlight(tab, 'github-from-css')))

  return (
    <div className="rounded-sm border border-black/10 overflow-hidden shadow-md">
      <Tabs defaultValue={tabs[0]?.meta} className="bg-black/5">
        <TabsList className="rounded-none p-0">
          {tabs.map(tab => (
            <TabsTrigger key={tab.meta} value={tab.meta}>
              {tab.meta}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab, i) => (
          <TabsContent key={tab.meta} value={tab.meta}>
            <Pre
              code={highlighted[i]}
              className="flex bg-white my-0 w-full rounded-none max-h-[500px] overflow-auto"
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
