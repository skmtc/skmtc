import { z } from 'zod'

export type AddressFormatterProps = {
  buildingName?: string
  buildingNumber?: string
  line1?: string
  line2?: string
  line3?: string
  line4?: string
  postcode?: string
  country?: string
}

const addressSchema = z
  .object({
    buildingName: z.string().optional(),
    buildingNumber: z.string().optional(),
    line1: z.string().optional(),
    line2: z.string().optional(),
    line3: z.string().optional(),
    line4: z.string().optional(),
    postcode: z.string().optional(),
    country: z.string().optional()
  })
  .optional()

export const AddressFormatter = ({
  buildingName,
  buildingNumber,
  line1,
  line2,
  line3,
  line4,
  postcode,
  country
}: AddressFormatterProps) => {
  const parsed = addressSchema.safeParse({
    buildingName,
    buildingNumber,
    line1,
    line2,
    line3,
    line4,
    postcode,
    country
  })

  return (
    <>
      {[
        parsed.data?.buildingName,
        parsed.data?.buildingNumber,
        parsed.data?.line1,
        parsed.data?.line2,
        parsed.data?.line3,
        parsed.data?.line4,
        parsed.data?.postcode,
        parsed.data?.country
      ]
        .filter(Boolean)
        .join(', ')}
    </>
  )
}
