import {address} from '@/types/address.generated.ts'

export class AddressesClient {
/**
 * Get one address
 */
async getAddressesId(id: string) {const res = await fetch(`/addresses/${id}`)
return address.parse(await res.json())}
}
