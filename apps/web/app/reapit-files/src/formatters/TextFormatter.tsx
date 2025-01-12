type TextFormatterProps = {
  value?: string
}

export const TextFormatter = ({ value }: TextFormatterProps) => {
  return <>{value || ''}</>
}
