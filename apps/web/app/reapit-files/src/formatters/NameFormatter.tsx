type NameFormatterProps = {
  title?: string
  forename?: string
  surname?: string
}

export const NameFormatter = ({ title, forename, surname }: NameFormatterProps) => {
  return <>{[title, forename, surname].filter(Boolean).join(' ')}</>
}
