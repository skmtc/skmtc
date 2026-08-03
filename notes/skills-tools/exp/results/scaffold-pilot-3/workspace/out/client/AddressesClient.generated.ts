import {address} from '@/types/address.generated.ts'

export class AddressesClient {
    async getApiAddressesId(id: string): Promise<unknown> {
    const res = await fetch(`/addresses/${id}`, { method: 'undefined' })
    return address.parse(await res.json())
  }
}
