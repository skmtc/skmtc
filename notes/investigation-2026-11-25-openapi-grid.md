# Where core's parse differs from the OpenAPI rules: a generated grid

Ticket: [#413](https://github.com/skmtc/skmtc/issues/413). Measured on core 0.47.2 (main at 533bfd1d) with Ajv 8.20.0, over the 1,981 harvest documents. No parser code and no case changed.

## Result

| | Cells |
| --- | --- |
| In the grid | 9,210 |
| No rules answer (the schema is not valid in its version) | 117 |
| Agree | 4,641 |
| Disagree with the validator on values | 3,079 |
| - of these, removed by core with an error | 418 |
| Agree on values, and differ only in an annotation (`description`, `default`, `readOnly`, `deprecated`, `externalDocs`) | 1,373 |
| The parse does not return | 0 |

- The 3.1 and 3.2 cells give the same results in all 3,070 cells, so 3.2 adds no finding of its own.
- 2,145 of the 2,661 cells where core gives values, and the values are wrong, have no parse issue. A generator can still log some of them when it renders the site (`toSkippedSiblings`).
- **Same schema, other spelling.** The validator gives one answer to 2,412 sets of spellings. Core gives them other values in 157, only another annotation in 207, and only another form (a ref, an intersection, a merged schema) in 468.
- The differences are in 36 groups. 20 of them have a site in the documents; 16 have none.
- The grid is run twice with the same result, to the byte.
- 284 of the 1,981 documents have a site in a cell with wrong values. 210 have a site that loses a valid annotation (5,039 annotations).

### What is new

1. **`anyOf` and `oneOf` lose the keywords beside one ref.** `{ anyOf: [ref, { type: null }], description }` parses to a nullable ref with no description and no issue. It is in 195 documents (4,061 sites) for `description` alone. I read four such sites in real documents through `ParseContext` (docs-allganize-ai `AuditLog.agent` and `Conversation.user`, developer-watson-orchestrate-ibm-com `PhoneErrorHandling.transfer_failure`, docs-bunny-net `BillingRecordModel.Type`): each `description` or `default` is `undefined`. The rules and practice agree here, so nobody has to choose a reading. No ticket has `description`, `default` or `readOnly`, or the `[ref, null]` spelling.
2. **#402 says that `anyOf` and `oneOf` are right about a `type` that excludes the target's null. That holds only in a cycle.** For a target that is not in a cycle they merge to a schema that accepts null, as `allOf` does: `anyOf [ref]` and `oneOf [ref]` are wrong in 15 of 18 cells each, and the 3 right ones are the object in a cycle.
3. **The same schema has two recorded readings.** `allOf: [OrNull, { type: object }]` is `practice` (null is valid, "an allOf where only one member allows null"). `type: object, allOf: [OrNull]` is `rules` by #402 (null is not valid). The validator says that both are the same schema.
4. **`nullable: true` beside an `allOf` with a union in it removes the schema in 3.1 and 3.2** (`"oneOf" array is empty`). 12 cells, no document.
5. **`minLength` or `minimum` beside a ref in a cycle makes a schema that no object matches**, in every spelling but `$ref`, `allOf [ref]` and `allOf [ref, ref]`. Core reads the keyword as a string or a number, and intersects that with the object. 63 cells each, no document.

### What it confirms

| Count | Earlier | Here |
| --- | --- | --- |
| A `type` that excludes the target's null, beside one ref | 3 sites in 2 documents | the same 3 sites, in the same 2 documents |
| `nullable: true` beside a `$ref`, 3.0 | 64 documents | 64 |
| `nullable: true` beside a `$ref`, 3.1 and 3.2 | 41 | 41 |
| `nullable: true` beside an `allOf` of one ref | 175 | 176 (3,676 sites) |

`additionalProperties: false` beside an `allOf` that merges has 10 documents in the edge cases, and 32 here. This count has other spellings too: the keyword in an inline member, beside one ref, and beside a union. "An allOf where only one member allows null" has 39 there; I could not reproduce that number, because its definition is not recorded. The grid counts a nullable ref beside a ref that is not (1 document), and a nullable ref beside an inline `type` (3 documents).

## How the null case is counted

A site counts when a `type` beside one ref, in `allOf`, `anyOf` or `oneOf`, leaves out the null of a target that accepts null **by the rules**. The `type` is alone or with `nullable: false`. Refs into a component (`#/components/schemas/Company/properties/external_id`) and chains of aliases are followed. The three sites:

- `readme-llms/specs/developers-easyship-com.json` `CompanyOnboardingCreate.external_id`
- `readme-llms/specs/developers-ampeco-com.json` `SoCPriority_read.upperThresholdPercent`
- `readme-llms/specs/developers-ampeco-com.json` `SoCPriority_read.lowerThresholdPercent`

Two more ampeco sites (`phaseRotation`, `connectedPhase`) have the same spelling, and a target with `nullable: true` and an `enum` that does not list null. The rules refuse null there already, so the `type` excludes nothing. Core reads those targets as nullable ("a nullable type with an enum that does not list null", `practice`), so **#402 changes these two sites as well**, if it decides on the resolved target's `nullable`. The script counts them apart (`nullableInCore`).

## Groups

A group is one keyword and one way to differ. A difference that the spelling makes without the keyword is in the group `none` only. "Documents" is the documents (and sites) with the keyword in a cell of the group, and then by spelling. A site with two keywords is in two groups. "Cells" is how many cells are in the group.

Spellings: `allOf [ref]` is the keyword beside it, `allOf [ref, {k}]` the keyword in a second member, `[ref, ref]` two refs with the keyword beside, `[ref, null]` the target or null.

I call a case **common** from 10 documents on, the lowest count at which the edge cases chose `practice`.

### Groups that need the owner

Practice is clear and common, and contradicts the rules. Or two recorded readings contradict each other (the last row, which is not common).

| Keyword | The rules | Core | Documents (sites) | Cells | Reading by the rule of the file | A case now? | Ticket |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `nullable: true`, no `type` | null is not valid: 3.0 adds it to a `type` in the same schema only, 3.1 has no such keyword | null is valid | 229 (4,831). 3.0: `allOf [ref]` 121, `oneOf [ref, ref]` 30, `allOf [ref, {k}]` 15, `oneOf [ref]` 15, `anyOf [ref, ref]` 3, `anyOf [ref]` 2, `allOf [ref, ref]` 1. 3.1: `$ref` 41, `allOf [ref]` 34, `oneOf [ref, ref]` 14, `allOf [ref, {k}]` 2, `oneOf [ref]` 2, `anyOf [ref, ref]` 1 | 179 | `practice` | For `allOf [ref]`, and `$ref` in 3.1 and 3.2. **Not** for the other spellings: 77 documents (905 sites) | none |
| `type` with `nullable: true` | null is not valid: the target refuses it | null is valid | 43 (251). 3.0: `allOf [ref]` 23, `allOf [ref, {k}]` 8, `oneOf [ref, ref]` 6, `allOf [ref, ref]` 2, `oneOf [ref]` 1, `anyOf [ref, ref]` 1. 3.1: `allOf [ref]` 4, `oneOf [ref, ref]` 3, `$ref` 2, `allOf [ref, {k}]` 2, `oneOf [ref]` 2, `anyOf [ref, ref]` 1 | 288 | `practice` | `allOf [ref]` and `anyOf [ref]`, with a target in a cycle | #402 for `anyOf` and `oneOf` in a cycle; none for the rest |
| `additionalProperties: false` | only the properties beside the keyword are valid | the properties of the target are valid too | 32 (722). Inline member or two refs 21 (645), `oneOf` / `anyOf` 10 (48), one ref 6 (29) | 189 | `practice` | Beside an `allOf` that merges: yes, `practice`. Beside a kept ref: yes, `undecided`. One ref, an inline member and a union: **no** | skmtc-generators#117 for a kept ref; none for the rest |
| `type: [type, null]` (3.1, 3.2) | null is not valid: the target refuses it | null is valid | 14 (171). `allOf [ref, {k}]` 7, `$ref` 4, `allOf [ref]` 2, `oneOf [ref]` 1, `oneOf [ref, ref]` 1 | 114 | `practice`: null is written where the site says which types it takes | no | none (#397 is the list of types in 3.0) |
| `type` without the target's null | null is not valid | null is valid, except in a cycle | 4 (80). 3.1 `allOf [ref, {k}]` 3 (79), 3.0 `oneOf [ref, ref]` 1 | 123 | `rules`. But `practice` by the case "an allOf where only one member allows null", for the 79 sites | `allOf [ref]`: yes, `undecided`. `allOf [ref, {k}]`: yes, `practice`, and `rules` for a kept ref | #402 for one ref |

### Groups where the rules and practice agree, or the case is rare

| Keyword | The rules | Core | Documents (sites) | Cells | Reading by the rule of the file | A case now? | Ticket |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `description` | it is at the site | lost, no issue | 195 (4,061). 3.1: `anyOf [ref, null]` 118, `oneOf [ref, null]` 42, `oneOf [ref]` 16, `anyOf [ref]` 1. 3.0: `oneOf [ref]` 26, `anyOf [ref]` 5, `anyOf [ref, null]` 1 | 168 | `rules`, and practice agrees | no | none |
| `default` | it is at the site | lost, mostly with no issue | 30 (198). 3.1: `anyOf [ref, null]` 26, `oneOf [ref]` 3, `anyOf [ref]` 1. 3.0: `oneOf [ref]` 1 | 174 | `rules` | no | none |
| `default: null`, where null is not valid | a default that is not valid: 3.0 must not, 3.1 should not | lost, in 94 of 190 cells with no issue | 22 (139). 3.0: `allOf [ref]` 8, `oneOf [ref, ref]` 5, `allOf [ref, {k}]` 2, `oneOf [ref]` 1. 3.1: `$ref` 5, `oneOf [ref, ref]` 3, `allOf [ref]` 2, `anyOf [ref, ref]` 2, `oneOf [ref]` 1 | 190 | `rules`, as "a default that is a string, on a number". What null means there is not clear | The same for a number: yes, `rules`, and it has an issue | #402 (gaps table) |
| `readOnly` | it is at the site | lost, in 168 of 252 cells with no issue | 21 (127). 3.0: `oneOf [ref, ref]` 7, `oneOf [ref]` 3, `anyOf [ref]` 1, `anyOf [ref, ref]` 1. 3.1: `oneOf [ref, null]` 5, `oneOf [ref, ref]` 3, `anyOf [ref, null]` 3, `anyOf [ref, ref]` 1 | 252 | `rules` | no | none |
| `default: null`, where null is valid | it is at the site | lost, also beside `allOf [ref]` and a 3.1 `$ref` | 16 (518). 3.1: `anyOf [ref, null]` 15, `oneOf [ref, null]` 1 | 169 | `rules` | no | #402 (gaps table) for one ref; none for `[ref, null]`, which has all the sites |
| `deprecated` | it is at the site | lost | 13 (135). 3.1: `anyOf [ref, null]` 8, `oneOf [ref, null]` 1 (106 sites), `anyOf [ref]` 1, `oneOf [ref, ref]` 1. 3.0: `oneOf [ref]` 1, `anyOf [ref, ref]` 1 | 275 | `rules` | no | #402 (gaps table) beside a ref to a union; none for the rest |
| `not` | a schema | removed, with an error | 4 (39). 3.0 `allOf [ref, {k}]` | 406 | `neither`: the policy `system.not: strict` | no; `notSystem.test.ts` has it | none (policy in force) |
| `required` | values without the property are not valid | valid: the keyword is lost beside a ref to a union | 3 (44). `allOf [ref]` 3.1: 2, 3.0: 1 | 15 | `rules` | no | none |
| `type` with `nullable: false` | null is not valid | null is valid | 2 (3). 3.0 `allOf [ref]`: the known sites | 150 | `rules` | "a type beside an allOf of one ref to a schema that allows null": yes, `undecided` | #402 |
| `properties` | values that do not match are not valid | valid: the keyword is lost beside a ref to a union | 2 (40). 3.1 `allOf [ref]` | 15 | `rules` | no | none |
| `enum` with null | the listed values that the type allows | any value of the type: the enum is removed | 1 (2). 3.1 `$ref` | 261 | `practice` for null, by #399 | On a schema with a type: yes, `undecided`. Beside a ref: **no** | #399 |
| `enum` | null is not valid: it is not listed | null is valid | 1 (1). 3.1 `oneOf [ref, null]` | 186 | `practice`, as on a schema with a type | On a schema with a type: yes, `practice`. Beside a ref: **no** | none |
| `type`, the same | null is not valid: the type excludes it | null is valid, beside `[ref, null]` | 1 (1). 3.1 `oneOf [ref, null]` | 42 | `rules` | no | #402 (the question is the same; it has no `[ref, null]`) |
| none | null is not valid: the other member of the `allOf` refuses it, or both members of the `oneOf` accept it | null is valid | 1 (2). 3.0 `allOf [ref, ref]` | 33 | `practice` | `allOf`: yes, `practice`. `oneOf [OrNull, null]`: no | none |
| `type`, narrower | the values of the narrower type | all values of the target, beside `$ref` in 3.1 and `allOf [ref]` | 1 (4). 3.1 `$ref` | 15 | `rules` | `allOf [ref]`: yes, `undecided`. `$ref`: **no** | #402 |
| `externalDocs` | it is at the site | lost, with `UNEXPECTED_PROPERTY` | 0 | 253 | `rules` | no | #402 (gaps table) |
| `const` | null is not valid | null is valid, beside a target or a member that allows it | 0 | 128 | `rules` (rare) | no | none |
| `enum` | only the listed values | all values of a union, or of an object in a cycle | 0 | 107 | `rules` | no | none |
| `const` | only that value | all values of a union, or of an object in a cycle | 0 | 74 | `rules` | no | none |
| `minLength` | no effect on an object | no object is valid, with a target in a cycle | 0 | 63 | `rules` | no | none |
| `minimum` | no effect on an object | no object is valid, with a target in a cycle | 0 | 63 | `rules` | no | none |
| `type`, narrower | null is not valid | null is valid | 0 | 35 | `rules` | no | #402 |
| `nullable: false` | null is valid: the keyword adds nothing | null is not valid, in `allOf [ref, {k}]` | 0 | 15 | `rules` (rare) | no | none |
| `required` | null is valid: no `type` refuses it | null is not valid, for an object or null in a cycle | 0 | 15 | `rules` (rare). Core reads the member as an object | "properties without a type" is near: `practice` | none |
| `properties` | as above | as above | 0 | 15 | as above | as above | none |
| `additionalProperties: false` | as above | as above | 0 | 15 | as above | no | none |
| `minLength` | null is valid | null is not valid, for an object or null in a cycle | 0 | 15 | `rules` | no | none |
| `minimum` | null is valid | null is not valid, for an object or null in a cycle | 0 | 15 | `rules` | no | none |
| `nullable: true` (3.1, 3.2) | a schema | removed: `"oneOf" array is empty` | 0 | 12 | `rules`: it is a fault of the parser | no | none |
| `minLength` | a shorter string is not valid | valid: lost beside a ref to a union of scalars | 0 | 5 | `rules` | no | none |
| `minimum` | a lower number is not valid | valid: lost beside a ref to a union of scalars | 0 | 5 | `rules` | no | none |

Two sites can be in one group and not behave the same, because a site can have more keywords than a cell. Of the 722 sites of `additionalProperties: false`, 17 have no other keyword that changes values; of the 4,831 of `nullable: true`, 4,829.

#356 (annotations in a second member of an `allOf`) has no group of its own. In `allOf [ref, {k}]` core keeps `description` and `readOnly` for every target, and loses `default` and `deprecated` for one kind of union each, and a valid `default: null` for two targets. With a target in a cycle, `description` gives an intersection where `allOf [ref]` gives a ref. No cell reproduces the endless parse of #356: the cycles of the grid go through a property of the target. #397 and #398 have no group either: the grid writes each version's own types, and a `type` list in 3.0 has no rules answer (117 cells).

## The same schema in another spelling

Sets of spellings that the validator gives one answer, and how many of them core gives more than one. Only spellings with the same members are compared.

| Keyword | Sets | Other values | Only another annotation | Only another form |
| --- | --- | --- | --- | --- |
| none | 108 | 0 | 0 | 33 |
| `type`, the same | 63 | 0 | 0 | 21 |
| `type` without the target's null | 54 | 3 | 0 | 15 |
| `type` with `nullable: false` | 117 | 18 | 0 | 21 |
| `type` with `nullable: true` | 111 | 7 | 0 | 32 |
| `type: [type, null]` | 66 | 0 | 0 | 26 |
| `type`, narrower | 27 | 9 | 0 | 0 |
| `nullable: true` | 108 | 14 | 0 | 21 |
| `nullable: false` | 108 | 15 | 0 | 18 |
| `enum` | 126 | 15 | 0 | 27 |
| `enum` with null | 108 | 3 | 0 | 39 |
| `const` | 120 | 10 | 0 | 32 |
| `default` | 108 | 0 | 42 | 0 |
| `default: null` | 108 | 0 | 24 | 12 |
| `required` | 108 | 12 | 0 | 30 |
| `properties` | 108 | 12 | 0 | 30 |
| `additionalProperties: false` | 108 | 15 | 0 | 27 |
| `minLength` | 108 | 12 | 0 | 30 |
| `minimum` | 108 | 12 | 0 | 30 |
| `not` | 108 | 0 | 0 | 0 |
| `readOnly` | 108 | 0 | 42 | 0 |
| `deprecated` | 108 | 0 | 39 | 0 |
| `description` | 108 | 0 | 42 | 0 |
| `externalDocs` | 108 | 0 | 18 | 24 |
| **All** | **2,412** | **157** | **207** | **468** |

## The `rules` text of the existing cases

Each of the 26 cases of `openapiEdgeCases.test.ts`, in each of its versions (63), against the validator. **There are no differences.**

| | Case and version pairs |
| --- | --- |
| The text says which values are valid, and the validator agrees | 54 |
| The text says that the schema is not valid, and it is not (`required: true` in 3 versions; a list of types, a member of type null and a numeric `exclusiveMinimum` in 3.0) | 6 |
| The validator has no answer: "a default that is a string, on a number" does not change which values are valid | 3 |

Two limits. The text is prose, so I wrote what it says as values by hand (`CLAIMS` in `.scripts/openapi-grid-cases.ts`). For the three 3.0 cases that are not valid, and `required: true` in 3.0, the answer comes from the translation and not from Ajv: 3.0 has its own schema language. By the 3.0 text `const` is ignored; the official JSON Schema of 3.0 documents refuses an unknown keyword, and I did not run it.

## Agreeing with the rules, where practice may differ

Core agrees with the rules here, so these are not groups. In 3.0 the keywords beside a `$ref` are ignored. The edge cases record that for `nullable` (64 documents, `rules`). The others have no case:

| Keyword beside a 3.0 `$ref` | Documents (sites) |
| --- | --- |
| `description` | 220 (6,420) |
| `type`, the same | 76 (1,280) |
| `nullable: true` | 58 (501) |
| `default` | 26 (142) |
| `deprecated` | 17 (67) |
| `required` | 14 (34) |
| `readOnly` | 14 (309) |
| `type` with `nullable: true` | 10 (37) |
| another `type` than the target's | 6 (24) |
| `properties` | 5 (12) |
| `enum` | 5 (17) |
| `nullable: false` | 3 (6) |
| `minLength` | 2 (7) |
| `default: null` | 1 (4) |
| `type` without the target's null | 1 (1) |

## How it was measured

```sh
cd deno
deno run -A .scripts/openapi-grid.ts grid.json                      # the grid and both answers, about 3 minutes
deno run -A .scripts/openapi-grid-count.ts <documents> count.json   # the sites, under a minute
deno run -A .scripts/openapi-grid-report.ts grid.json count.json    # the groups and the tables above
deno run -A .scripts/openapi-grid-cases.ts                          # the existing cases
```

- **The grid**: 24 keywords (one of them none), 10 spellings, 14 targets (an object, one that allows null, an alias of each and each in a cycle; a union of objects, one that allows null and one in a cycle; a union of scalars; a string and a number, with and without null) and 3 versions. A keyword with nothing to write for a target is left out. I added the spellings `[ref, null]`, which the ticket does not list, because 219 of the 932 documents in 3.1 and 3.2 have one.
- **The values**: `null`, `{}`, `{a: "a"}`, `{b: "b"}`, `{b: 1}`, `"a"`, `"bbb"`, `1.5` and `5`. `a` is a property of the target, `b` the one that the keyword names.
- **The rules**: Ajv 2020 for 3.1 and 3.2. `nullable` is taken out first, because Ajv reads it, and 3.1 has no such keyword. 3.0 is translated (`translate30`, with its own tests).
- **Core**: cells share documents as separate components, 100 to a document. Each of the 1,980 cells with a target in a cycle has a process of its own, with 20 seconds and 512 MB. The result is written as JSON Schema from core's objects. A nullable schema accepts null whatever else it says, which is how core reads it.
- **The closed object**: `toJsonSchema` writes `additionalProperties: false` on an object that says nothing. The script reads the parsed object, and writes the keyword only when core has it. So an object that says nothing is open on both sides.
- **A removed schema**: a component that core removed, or that refers to one, is its own answer (`removed`). It does not accept every value.
- **A ref with keywords** is the schema that `resolve()` gives at its site. So a keyword that core carries on the ref and leaves out of the resolved schema (`type`) does not count as kept. A difference from `parseBoundedMain.ts`, which writes a ref's own fields.
- **Annotations**: the validator cannot show them. The script looks for the keyword on the parsed site, on a member of an intersection, or on each member of a union. In the rules it is at the site when the version reads it there.

## What was not measured

- Two keywords at one site. The counts say how many sites have a keyword, and not that each of them behaves as its cell.
- `pattern`, `format`, `multipleOf`, the other bounds, `items`, `patternProperties`, `unevaluatedProperties`, `discriminator`, `if`, `$defs` and `$ref` into them as a target of a cell.
- A value that two members of a union accept. The second member accepts none of the values, so `oneOf` and `anyOf` look the same. Core does not keep which of the two a union was, so this difference exists and has no number here.
- A `type` that the target does not have at all (`type: string` beside an object): 110 sites, not in the grid.
- Sites outside the grid, as counted: 1,130 with a target of another kind (an array, a boolean, no type), 299 unions of two or more and null, 281 with a member of type `null` in 3.0 (#398), 159 with a target that is not in the document, 43 with a nested `allOf`, `anyOf` or `oneOf`, 14 with two of the three. 73,302 sites are in it.
- The nearest target stands for a raw one: an integer counts as a number, and a union in a cycle that allows null as one that does not.
- What authors mean. The readings in the tables are mine, from the rule at the top of the file and the count.
- Settings: `system.not`, `system.anyOf`, `system.intersections` and the others were left at their defaults.
