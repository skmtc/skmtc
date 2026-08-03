import {address} from '@/types/address.generated.ts'

export class AddressesClient {
constructor(private baseUrl: string) {}

async getAddressesId(id: string) {const res = await fetch(`${this.baseUrl}/addresses/${id}`);
return address.parse(await res.json());}
}
