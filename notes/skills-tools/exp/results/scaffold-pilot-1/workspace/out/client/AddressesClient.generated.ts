import {address} from '@/types/address.generated.ts'

export class AddressesClient {
    async getApiAddressesId(id: string) {
    const res = await fetch(`/addresses/${id}`, { method: 'get' })
    return address.parse(await res.json())
  }
}
