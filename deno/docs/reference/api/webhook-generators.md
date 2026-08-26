# Webhook generators

> The fourth generator flavor, for OpenAPI 3.1 webhooks: `toWebhookEntry`,
> `toWebhookProjectionBase` (via `toTsWebhookProjectionBase`), and
> `context.insertWebhook`. Same shape as the operation flavor, with an
> `OasWebhook` in place of an `OasOperation`.

Source:

- `skmtc/deno/core/dsl/webhook/toWebhookEntry.ts`
- `skmtc/deno/core/dsl/webhook/toWebhookProjectionBase.ts`
- `skmtc/deno/core/dsl/webhook/WebhookDriver.ts`
- `skmtc/deno/core/oas/webhook/Webhook.ts`
- `skmtc/deno/lang-typescript/src/toTsWebhookProjectionBase.ts`
- `skmtc/deno/gen-ts-webhook/` — the worked example

## What a webhook is

An OpenAPI **3.1** document can declare a top-level `webhooks` map:
calls the *server* makes to the consumer. Structurally each webhook is
an Operation Object — the same `parameters`, `requestBody`, `responses`
— but keyed by a **name** rather than a URL path, and with inverted
semantics: `requestBody` is the payload delivered *to* the consumer's
handler, and `responses` is what the handler returns to acknowledge.

That inversion is why webhooks are a distinct subject in the parsed
document — `OasWebhook`, carrying `name` and `method` where an
`OasOperation` carries `path` and `method` — and never routed through
an operation generator. A generator that emits client calls would emit
exactly the wrong thing for a webhook.

## The three pieces

Each mirrors its operation-flavor sibling; only the subject changes.

| Piece | Webhook flavor | Operation sibling |
| --- | --- | --- |
| Entry factory | `toWebhookEntry({ id, transform, toEnrichmentSchema, … })` | [`toOasOperationEntry`](entry-factories.md) |
| Projection base | `toTsWebhookProjectionBase({ id, toIdentifierName, toIdentifierType, toExportPath, toEnrichmentSchema, … })` | [`toTsOasOperationProjectionBase`](projection-bases.md) |
| Insert method | `context.insertWebhook({ projection, webhook, variant? })` | [`insertOperation`](generate-context.md) |

The entry's `transform` receives `{ context, webhook, variant }` and,
as in every flavor, produces no output by returning — it calls
`context.insertWebhook(...)`, which runs the `WebhookDriver`
(cache-keyed by identifier name + export path, deduplicated like any
other Definition) and returns an `Inserted`.

The static surface of a webhook projection matches the other flavors:
`toIdentifierName` (pure, the cache-key half), `toIdentifierType`,
`toExportPath`, `toEnrichments`, and an optional `isSupported`
capability predicate the Driver probes on every insert.

## Enrichments and variants

Webhook enrichments route as
`enrichments[generatorId][name][method][variant]` — the webhook **name**
sits in the slot the operation flavor gives to `path`. Variants default
to `'main'`; an entry opts in by declaring `supportsVariant: () => true`,
and the engine then fans out one `transform` call per variant declared
in the consumer's enrichment block.

## The worked example

`@skmtc/gen-ts-webhook` emits one handler type per webhook and is small
enough to read in one sitting. Its entire entry:

```ts
export const tsWebhookEntry = toWebhookEntry({
  id: denoJson.name,
  transform({ context, webhook, variant }) {
    context.insertWebhook({ projection: WebhookHandler, webhook, variant })
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})
```

And its projection base — identifier `<PascalName>WebhookHandler`,
export path `@/webhooks/<PascalName>.generated.ts`:

```ts
export const WebhookHandlerBase = toTsWebhookProjectionBase({
  id: denoJson.name,
  toIdentifierName({ webhook }) {
    return `${toPascalCase(webhook.name)}WebhookHandler`
  },
  toIdentifierType: () => ({ type: 'type' }),
  toExportPath({ webhook }) {
    return join('@', 'webhooks', `${toPascalCase(webhook.name)}.generated.ts`)
  },
  toEnrichmentSchema: () => emptyEnrichmentSchema
})
```

## Common questions

### Do webhooks work on OpenAPI 3.0 documents?

No — the `webhooks` map is a 3.1 feature. A 3.0 document has no
webhook subjects, so a webhook generator produces nothing (and that is
not an error).

### Can a webhook projection insert models?

Yes. The base class carries the same `insertModel` /
`insertNormalizedModel` / `insertOperation` wrappers as the other
flavors, so a handler type can pull in the payload schema as a normal
model definition.

## See also

- [Entry factories](entry-factories.md) — the shared entry shape
- [Projection bases](projection-bases.md) — the shared base shape
- [GenerateContext](generate-context.md) — the insert-method family
- [Enrichments](../../concepts/enrichments.md) — the routing structure the name/method
  pair plugs into
