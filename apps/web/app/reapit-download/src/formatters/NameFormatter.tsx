import { z } from 'zod'

type Name = {
  title?: string
  forename?: string
  surname?: string
}

const nameSchema = z.object({
  title: z.string().optional(),
  forename: z.string().optional(),
  surname: z.string().optional()
})

type NameFormatterProps = {
  value: Name
}

export const NameFormatter = ({ value }: NameFormatterProps) => {
  const parsed = nameSchema.safeParse(value)

  if (!parsed.success) {
    return <> - </>
  }

  const { title, forename, surname } = parsed.data

  return <>{[title, forename, surname].filter(Boolean).join(' ')}</>
}
