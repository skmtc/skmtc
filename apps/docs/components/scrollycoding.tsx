import { z } from "zod"
import { Selection, Selectable, SelectionProvider } from "@/lib/selection"
import { Block, CodeBlock, parseProps } from "codehike/blocks"
import { Code } from "@/components/ui/ide-code"
import { Intro } from "@/components/ui/intro"

const Schema = Block.extend({
  intro: Block.optional(),
  tree: CodeBlock.optional(),
  steps: z.array(
    Block.extend({ code: CodeBlock, tooltips: z.array(Block).optional() }),
  ),
  outro: Block.extend({ title: z.string() }).optional(),
})

export const Scrollycoding = (props: unknown) => {
  console
  const { intro, tree, steps, outro } = parseProps(props, Schema)

  return (
    <>
      <Intro>{intro?.children}</Intro>
      <SelectionProvider className="flex-col gap-4">
        <div className="top-0 pt-4 hsl(var(--background)) sticky z-10">
          <div className="overflow-auto shadow-md rounded-lg border border-black/10">
            <Selection
              from={steps.map(({ code, tooltips }) => (
                <Code codeblock={code} tree={tree} tooltips={tooltips} />
              ))}
            />
          </div>
        </div>

        <div className="pl-2 pt-8 prose max-w-4xl mx-auto">
          {steps.map((step, i) => (
            <Selectable
              key={i}
              index={i}
              selectOn={["click", "scroll"]}
              className="border-l-4 border-transparent data-[selected=true]:border-indigo-200 px-5 mb-2 rounded bg-transparent cursor-pointer"
            >
              <h2 className="mt-8 text-base">{step.title}</h2>
              <div>{step.children}</div>
            </Selectable>
          ))}
        </div>
      </SelectionProvider>
      {outro && (
        <>
          {outro.title && <h2 className="mt-8 text-base">{outro.title}</h2>}
          <div>{outro?.children}</div>
        </>
      )}
    </>
  )
}
