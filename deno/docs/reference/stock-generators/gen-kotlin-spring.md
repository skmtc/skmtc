# @skmtc/gen-kotlin-spring

> Produce Spring Boot server interfaces (one annotated
> `interface <Tag>Api` per tag) from OpenAPI operations.

An operation generator — the "interfaceOnly" pattern: generated output
is complete (never a stub); the consumer writes
`@RestController class UsersController : UsersApi` in non-generated
code and Spring binds the interface-declared annotations at startup.
The first accumulator-style operation generator on the Kotlin path.

## Source

`skmtc-generators/gen-kotlin-spring/src/`

## What it generates

For `GET /users/{id}` (path `id`, optional query `verbose`, 200 →
`User`) and `POST /users` (body `CreateUserBody`, 201 → `User`), both
tagged `users`:

```kotlin
package com.example.api

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestParam

interface UsersApi {
    @GetMapping("/users/{id}")
    fun getUsersId(@PathVariable("id") id: String, @RequestParam("verbose") verbose: Boolean?): User

    @PostMapping("/users")
    fun postUsers(@RequestBody body: CreateUserBody): User
}
```

(`User` / `CreateUserBody` imports suppressed — same package as the
DTOs in the default setup.)

## Grouping and naming

- One interface per tag: `users` → `UsersApi`. Untagged operations land
  in `DefaultApi`; a multi-tag operation joins its FIRST tag only.
- Method names derive from method + path (`get /users/{id}` →
  `getUsersId`) — never from `operationId` (author-controlled,
  emitter-dependent).
- Construction is accumulator-style (the gen-msw pattern): the first
  operation in a tag creates the interface Definition via
  `findDefinition` + `defineAndRegister`; later operations `add` their
  method. Method order = document order.

## Method policy (v1)

- Mapping annotation: `@GetMapping` / `@PostMapping` / `@PutMapping` /
  `@PatchMapping` / `@DeleteMapping`; `head`/`options`/`trace` fall back
  to `@RequestMapping(method = [RequestMethod.HEAD], path = ["…"])`.
  The OAS path goes in verbatim — `{id}` is already Spring's template
  syntax.
- Parameters, in order: path params (`@PathVariable("wire_name")`,
  non-null), query params (`@RequestParam("wire_name")`, optional →
  nullable type), then the JSON body (`@RequestBody body: T`, nullable
  when the requestBody is not `required`). Binding annotations ALWAYS
  carry the explicit wire name, so camelCase/sanitization renames are
  free.
- Types come from gen-kotlin's value layer (`toKtValue`) — refs insert
  the DTO peer (the dependency edge needs no gen-kotlin transform);
  inline shapes synthesize named siblings in the tag file
  (`PostUsersBody`). The value owns the nullability `?`.
- Return type = the lowest-2xx response's `application/json` schema;
  none → no `: T` (Kotlin's implicit `Unit`).

## Entry — a factory, no default export

`basePackage` is required and has no default:

```ts
import { toKotlinSpringEntry } from '@skmtc/gen-kotlin-spring'

export default toKotlinSpringEntry({ basePackage: 'com.example.api' })
```

May equal or differ from gen-kotlin's `basePackage`: same package →
DTO references render bare; different packages → imports render
automatically. Run `@skmtc/gen-kotlin` beside it on the same document
for the DTOs.

## Consumer setup (kotlinx end-to-end, validated by bootRun)

- `spring-boot-starter-web` with `spring-boot-starter-json` (Jackson)
  EXCLUDED — Spring then auto-registers the
  `KotlinSerializationJsonHttpMessageConverter` when
  `kotlinx-serialization-json` is on the classpath.
- `kotlin-reflect` on the classpath — Spring MVC's Kotlin parameter
  handling throws `NoClassDefFoundError` without it.
- The `plugin.spring` Gradle plugin (opens Spring-annotated classes).

## Customization seams (clone to change)

| Seam | Location |
|---|---|
| Grouping (per-tag) + interface naming | `src/apiFile.ts` |
| Method naming, parameter/body/return policy, mapping annotations | `src/SpringApiMethod.ts` |
| Interface body arrangement | `src/SpringApiInterface.ts` |

## Limits (documented, deliberate)

- Spring MVC with plain `fun` — no WebFlux, no `suspend` (a later
  sibling/clone, same no-flavor-flag rule as serialization).
- Named exclusions: header/cookie params, non-JSON content types,
  multi-status response unions, `ResponseEntity<T>`, security
  annotations, servers/base-path prefixes.
- kotlinx.serialization flavor only — the Jackson flavor
  (`gen-kotlin-jackson` + Jackson-flavored Spring docs) is the named
  follow-up.
- Peer-version rule: gen-kotlin-spring and gen-kotlin must pin the
  SAME `@skmtc/lang-kotlin` version — two lang copies in one module
  graph break `KtFile`'s same-package import suppression
  (`instanceof` fails across copies). The release cascade keeps them
  aligned.

Architecture: `notes/lang/23-kotlin-spring-architecture.md`.
Language layer skill: `docs/skills/skmtc-lang-kotlin/`.
