 Benefits of NextList over List

  1. Honest types, no as casts

  List declared conditional return types (ToConditionalReturn, ToFilteredKeyValueReturn) and
  then escape-hatched them with as casts (lines 253, 391). That violates your global
  feedback_no_as_casting.md rule. NextList returns plain unions — NextList<V> | undefined for
  filtered helpers, NextList<V> for toConditional — with zero casts in production code.

  2. One generic instead of three

  List<Values extends Stringable[], Separator extends string, Bookends extends BookendsType>
  becomes NextList<V extends Stringable>. The other two generics encoded information the call
  site already knew (you wrote List.toObject(...) — you know the bookends are {}). They also
  produced inconsistent shapes: List<Stringable[], ...> for arrays vs List<[Key, Value], ...>
  for key-value pairs vs List<never, ...> for empty. NextList doesn't lie about its shape.

  3. Encapsulated mutation

  List.values is a public mutable array. gen-shadcn-form/Table.ts:246 does
  this.cells.values.push(...). That works today, but nothing prevents the same pattern from
  leaking into a toString() and producing nondeterministic output across renders.

  NextList makes the array private and exposes .add(v) / .addAll(vs) (both chainable, both
  filter undefined automatically). items() returns a snapshot copy. Same expressive power; same
   constructor-time mutation pattern; but the surface area is auditable and toString() purity
  is locally provable.

  4. Asymmetric and per-item wrapping

  List only supports symmetric bookends ([], {}, ()). Common shapes it couldn't express without
   hand-rolled string concatenation:

  { id, name, email }        // padded bookends
  [\n  1,\n  2,\n  3\n]      // indented multiline
  const x = 1,\n  return x   // per-item indent
  , id, name                 // leading-separator spread

  NextList adds prefix, suffix, itemPrefix, itemSuffix. Every shape above falls out of options
  instead of template-literal gymnastics around the list. This is the single biggest functional
   gain — and it's where List's value most clearly leaked at the parent template.

  5. NextKeyList / NextEntryList are Stringable

  KeyList and EntryList aren't Stringable in List. You can't write ${keyList} in a template —
  you have to remember a terminal like .toLinesPlain() or .toLines(id => id). Every other DSL
  value in SKMTC renders via ${...}, so this exception was a footgun.

  NextKeyList.toString() defaults to line-separated keys. NextEntryList.toString() defaults to
  key: value lines. The terminal methods still exist for non-default renderings — they're just
  no longer required for the common case.

  6. Cleaner filter+map in entry mapping

  EntryList.toLines((entry, i) => V) couldn't drop entries. To filter, you'd build the array
  yourself or post-filter. NextEntryList's mapFn returns V | undefined, and undefined entries
  are dropped. This collapses filter+map into one pass — useful for "only emit fields whose
  schema is supported", a recurring pattern.

  7. Read-only state observation without exposing internals

  NextList.size, NextList.isEmpty, NextKeyList.size, NextEntryList.size cover the common
  length/empty checks that previously required reaching into .values.length or .keys.length.
  Encapsulated, but not at the cost of ergonomics.

  What stays the same

  - All static builder names: toObject, toArray, toParams, toLines, toKeyValue, toRecord,
  toFilteredRecord, fromKeys, fromEntries, toEmpty, toSingle, toConditional, toObjectKey,
  hasValue, toFilteredKeyValue.
  - The Stringable contract — interpolates the same way in template literals.
  - skipEmpty semantics.
  - undefined items filtered on construction.
  - Type aliases (NextListObject<V>, NextListArray<V>, etc.) for field-declaration
  documentation.

  So migration is a name swap, not a refactor. The wins are mostly internal correctness and the
   new capabilities surface only when you reach for them.

  What this doesn't fix

  - Filtering at render time, not construction time. I considered moving the toFilteredRecord
  filter into toString() — that would catch the case where a nested list becomes empty after
  the parent is built. I left it construction-time because changing the semantics risks subtle
  behavior diffs on real generators. Worth doing in a follow-up if you confirm no one depends
  on the current ordering.
  - Location under core/typescript/. Still TS-agnostic, still misfiled. I left it next to
  List.ts so the diff is comprehensible. A move to core/dsl/ or core/helpers/ is a separate,
  easy commit when you want it.
  - The cookbook doc. Memory #21075 still applies — the API is clearer but the "which builder
  for which generated-code shape" reference table is still missing.