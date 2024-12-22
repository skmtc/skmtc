import { Pre, RawCode, highlight } from "codehike/code"
import { tokenTransitions } from "@/components/annotations/token-transitions"
import { wordWrap } from "../annotations/word-wrap"
import {
  collapse,
  collapseContent,
  collapseTrigger,
} from "@/components/annotations/collapse"
import { mark } from "@/components/annotations/mark"
import { focus } from "@/components/annotations/focus"
import { IdeWindow } from "@/components/ide"
import { callout } from "@/components/annotations/callout"
import { hover } from "@/components/annotations/hover"
import { tooltip } from "@/components/annotations/tooltip"
import { CopyButton } from "@/components/ui/copy-button"
import { z } from "zod"
import { Block } from "codehike/blocks"

type CodeProps = {
  tree: RawCode | undefined
  tooltips: z.infer<typeof Block>[] | undefined
  codeblock: RawCode
}

export async function Code({ codeblock, tooltips, tree }: CodeProps) {
  const highlighted = await highlight(codeblock, "github-from-css")

  highlighted.annotations = highlighted.annotations.map((a) => {
    const tooltip = tooltips?.find((t) => t.title === a.query)

    if (!tooltip) return a

    return {
      ...a,
      data: { ...a.data, children: tooltip.children },
    }
  })

  return (
    <div className="rounded-lg border border-black/10 overflow-hidden shadow-md">
      <IdeWindow copyButton={<CopyButton text={highlighted.code} />}>
        <Pre
          code={highlighted}
          handlers={[
            tokenTransitions,
            collapse,
            collapseTrigger,
            collapseContent,
            mark,
            wordWrap,
            callout,
            hover,
            focus,
            tooltip,
          ]}
          className="flex bg-white my-0 w-full rounded-none max-h-[400px] overflow-auto dark:bg-gray-700"
        />
      </IdeWindow>
    </div>
  )
}
