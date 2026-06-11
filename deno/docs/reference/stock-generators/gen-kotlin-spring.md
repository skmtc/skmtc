# @skmtc/gen-kotlin-spring

> Produce Spring Boot server code from OpenAPI operations: per tag, a
> generated `@RestController` with complete delegating bodies plus the
> `<Tag>Service` interface the consumer implements.

An operation generator following the `gen-supabase-hono` pattern: the
generated artifact is the complete web layer; business logic lives
behind a generated, DTO-typed service seam the consumer implements as
a Spring bean. Output is never a stub — every generated body is a
working delegation. (This replaced the 0.0.x "interfaceOnly" shape;
spec: `notes/lang/25-kotlin-controller-service-architecture.md`.)

## Source

`skmtc-generators/gen-kotlin-spring/src/`

## What it generates

ONE file per tag — `<Tag>Api.generated.kt` — holding both
declarations (a single destination keeps inline-shape synthesis and
imports deduplicated):

```kotlin
package com.example.api

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.*   // rendered individually

interface UsersService {
    fun getUsersId(id: String, verbose: Boolean?): User

    fun postUsers(body: CreateUserBody): User
}

@RestController
class UsersController(
    private val service: UsersService
) {
    @GetMapping("/users/{id}")
    fun getUsersId(@PathVariable("id") id: String, @RequestParam("verbose") verbose: Boolean?): User = service.getUsersId(id, verbose)

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    fun postUsers(@RequestBody body: CreateUserBody): User = service.postUsers(body)
}
```

The consumer writes ONE class per tag — pure business logic, no web
concerns:

```kotlin
@Service
class UsersServiceImpl : UsersService {
    override fun getUsersId(id: String, verbose: Boolean?): User { … }
    override fun postUsers(body: CreateUserBody): User { … }
}
```

Spring DI verifies the seam at startup: a scanned controller with no
service bean fails loudly.

## Grouping, naming, method policy

- One file per tag (`users` → `UsersApi.generated.kt` holding
  `UsersService` + `UsersController`); untagged → `Default…`;
  multi-tag joins the FIRST tag only. Accumulator construction;
  method order = document order.
- Method names derive from method + path (`get /users/{id}` →
  `getUsersId`) — never `operationId`. Service and controller share
  the name; the controller body is
  `service.<name>(<params in order>)`.
- Mapping annotations: `@Get/Post/Put/Patch/DeleteMapping`;
  `head`/`options`/`trace` →
  `@RequestMapping(method = [RequestMethod.X], path = ["…"])`. The
  OAS path goes in verbatim.
- Parameters: path (`@PathVariable("wire")`, non-null) → query
  (`@RequestParam("wire")`, optional → nullable) → JSON body
  (`@RequestBody`). Wire names always explicit. Types via
  gen-kotlin's value layer — refs insert the DTO peer; inline shapes
  synthesize named siblings in the tag file; the value owns the
  nullability `?`.
- Return type = lowest-2xx `application/json` schema; none →
  implicit `Unit`.
- **Status-code inference:** lowest-2xx of 201/202/204 renders
  `@ResponseStatus(HttpStatus.CREATED/ACCEPTED/NO_CONTENT)`; 200 is
  Spring's default and renders nothing.

## Entry — a factory, no default export

```ts
import { toKotlinSpringEntry } from '@skmtc/gen-kotlin-spring'

export default toKotlinSpringEntry({ basePackage: 'com.example.api' })
```

`basePackage` is required (no default); it may equal or differ from
gen-kotlin's (different → DTO imports render automatically). Run
`@skmtc/gen-kotlin` beside it for the DTOs.

## Consumer setup (kotlinx end-to-end, validated by bootRun)

- `spring-boot-starter-web` with `spring-boot-starter-json` EXCLUDED
  (Spring auto-registers the kotlinx converter when
  `kotlinx-serialization-json` is on the classpath).
- `kotlin-reflect` on the classpath; the `plugin.spring` Gradle
  plugin.
- Component-scan must cover `basePackage` (the generated controllers)
  AND the package holding your `ServiceImpl`s.

## Customization seams (clone to change)

| Seam | Location |
|---|---|
| Grouping + file/service/controller naming | `src/apiFile.ts` |
| Method naming, parameter/body/return policy, mapping + status annotations, delegation shape | `src/SpringApiMethod.ts` |
| Class shells (annotations, injection) | `src/SpringApiInterface.ts` |

## Limits (documented, deliberate)

- Spring MVC, plain `fun` — WebFlux/`suspend` is a later sibling.
- Named exclusions: header/cookie params, non-JSON content,
  multi-status unions, `ResponseEntity<T>`, security annotations
  (the `operation.security` inference is a named follow-up),
  servers/base-path prefixes, `serviceMethodName` enrichment
  (domain-shaped seam names).
- kotlinx flavor only; Jackson is the named follow-up sibling.
- Peer-version rule: gen-kotlin-spring and gen-kotlin must pin the
  SAME `@skmtc/lang-kotlin` — two lang copies break cross-copy
  `instanceof` (same-package import suppression). The cascade keeps
  them aligned.

Architecture: `notes/lang/25-kotlin-controller-service-architecture.md`.
Language layer skill: `docs/skills/skmtc-lang-kotlin/`.
