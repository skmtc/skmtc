#!/usr/bin/env node
// Structural verification of the generated Kotlin (no kotlinc on this
// machine). Part of `deno task verify` — do not edit. Exits non-zero on
// any failure.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const outDir = 'out/com/example/models'
const failures = []
const ok = (cond, msg) => {
  if (!cond) failures.push(msg)
}

const models = ['Order', 'OrderItem', 'OrderStatus', 'Address', 'Category']
const files = {}
for (const model of models) {
  const path = join(outDir, `${model}.generated.kt`)
  ok(existsSync(path), `missing file: ${path}`)
  if (existsSync(path)) files[model] = readFileSync(path, 'utf8')
}

for (const [model, text] of Object.entries(files)) {
  ok(/^package com\.example\.models$/m.test(text), `${model}: missing 'package com.example.models' directive`)
  ok(!text.includes('??'), `${model}: doubled '?' in a type`)
  ok(!/^import com\.example\.models\./m.test(text), `${model}: same-package import should be suppressed`)
}

const order = files['Order'] ?? ''
ok(/data class Order\s*\(/.test(order), 'Order: not a data class')
ok(order.includes('@JsonProperty("shipping_address")'), 'Order: missing @JsonProperty("shipping_address")')
ok(/val shippingAddress: Address\b/.test(order), 'Order: shippingAddress not typed Address')
ok(/val billingAddress: Address\? = null/.test(order), 'Order: billingAddress should be `Address? = null` (optional)')
ok(/val customerNotes: String\? = null/.test(order), 'Order: customerNotes should be `String? = null` (nullable+optional)')
ok(/val `object`: String\b/.test(order), 'Order: hard keyword must be backticked `object`')
ok(!order.includes('@JsonProperty("object")'), 'Order: `object` keeps its wire name — no @JsonProperty needed')
ok(order.includes('val items: List<OrderItem>'), 'Order: items not typed List<OrderItem>')
ok(/^import com\.fasterxml\.jackson\.annotation\.JsonProperty$/m.test(order), 'Order: missing Jackson JsonProperty import')

const item = files['OrderItem'] ?? ''
ok(item.includes('@JsonProperty("unit_price")'), 'OrderItem: missing @JsonProperty("unit_price")')
ok(/val unitPrice: /.test(item), 'OrderItem: unit_price not renamed to unitPrice')
ok(/val giftWrap: \w+\? = null/.test(item), 'OrderItem: gift_wrap should be optional with default null')

const status = files['OrderStatus'] ?? ''
ok(/enum class OrderStatus/.test(status), 'OrderStatus: not an enum class')
for (const value of ['pending', 'paid', 'shipped', 'cancelled']) {
  ok(status.toLowerCase().includes(value), `OrderStatus: wire value '${value}' unrepresented`)
}

const category = files['Category'] ?? ''
ok(/val children: List<Category>\? = null/.test(category), 'Category: children should be `List<Category>? = null` (self-reference)')

if (failures.length) {
  console.error(`KOTLIN CHECKS FAILED (${failures.length}):`)
  for (const f of failures) console.error(`  - ${f}`)
  process.exit(1)
}
console.log(`kotlin checks: all pass (${models.length} files)`)
