import {address} from '@/types/address.generated.ts'

export class AddressesClient {
async getAddressesId(id: string) {const res = await fetch(`/addresses/${id}`, {
    method: 'GET'
  })

  if (!res.ok) {
    throw new Error(await res.text())
  }

  return address.parse(await res.json())}
}
