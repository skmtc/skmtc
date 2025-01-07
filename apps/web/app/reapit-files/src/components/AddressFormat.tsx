type Address = {
  buildingName?: string | undefined
  buildingNumber?: string | undefined
  line1?: string | undefined
  line2?: string | undefined
  line3?: string | undefined
  line4?: string | undefined
  postcode?: string | undefined
  countryId?: string | undefined
}

export const AddressFormat = (props: Address) => {
  const { buildingName, buildingNumber, line1, line2, line3, line4, postcode, countryId } = props

  return [buildingName, buildingNumber, line1, line2, line3, line4, postcode, countryId].filter(Boolean).join(', ')
}
