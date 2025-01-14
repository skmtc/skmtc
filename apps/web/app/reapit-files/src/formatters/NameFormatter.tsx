import { z } from 'zod'

type NameFormatterProps = {
  title?: string
  forename?: string
  surname?: string
}

const nameSchema = z
  .object({
    title: z.string().optional(),
    forename: z.string().optional(),
    surname: z.string().optional()
  })
  .optional()

export const NameFormatter = ({ title, forename, surname }: NameFormatterProps) => {
  const parsed = nameSchema.safeParse({ title, forename, surname })

  return (
    <>
      {[parsed.data?.title, parsed.data?.forename, parsed.data?.surname].filter(Boolean).join(' ')}
    </>
  )
}
