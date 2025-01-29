import { z } from 'zod'

type Address = {
  buildingName?: string
  buildingNumber?: string
  line1?: string
  line2?: string
  line3?: string
  line4?: string
  postcode?: string
  countryId?: string
}

export type AddressFormatterProps = {
  value: Address
}

const addressSchema = z.object({
  buildingName: z.string().optional(),
  buildingNumber: z.string().optional(),
  line1: z.string().optional(),
  line2: z.string().optional(),
  line3: z.string().optional(),
  line4: z.string().optional(),
  postcode: z.string().optional(),
  countryId: z.string().optional()
})

export const AddressFormatter = ({ value }: AddressFormatterProps) => {
  const parsed = addressSchema.safeParse(value)

  if (!parsed.success) {
    return <> - </>
  }

  const { buildingName, buildingNumber, line1, line2, line3, line4, postcode, countryId } =
    parsed.data

  return (
    <>
      {[buildingName, buildingNumber, line1, line2, line3, line4, postcode, countryId]
        .filter(Boolean)
        .join(', ')}
    </>
  )
}
