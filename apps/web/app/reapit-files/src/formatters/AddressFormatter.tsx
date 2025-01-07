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

export const AddressFormatter = ({
  buildingName,
  buildingNumber,
  line1,
  line2,
  line3,
  line4,
  postcode,
  country,
}: AddressFormatterProps) => {
  return <>{[buildingName, buildingNumber, line1, line2, line3, line4, postcode, country].filter(Boolean).join(', ')}</>
}
