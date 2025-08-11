export class KvState {
  kv: Deno.Kv

  constructor(kv: Deno.Kv) {
    this.kv = kv
  }
}
