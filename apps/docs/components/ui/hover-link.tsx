import Link from "fumadocs-core/link"

type HoverLinkProps = {
  href?: string
  children?: React.ReactNode
}

export const HoverLink = (props: HoverLinkProps) => {
  if (props.href?.startsWith("hover:")) {
    const hover = props.href.slice("hover:".length)
    return (
      <span
        className="underline decoration-dotted underline-offset-4"
        data-hover={hover}
      >
        {props.children}
      </span>
    )
  }

  return <Link {...props} />
}
