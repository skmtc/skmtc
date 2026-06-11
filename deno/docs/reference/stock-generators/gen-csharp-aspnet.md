# @skmtc/gen-csharp-aspnet

ASP.NET Core server stubs from OpenAPI operations — the
gen-kotlin-spring playbook in ASP.NET idiom (CS-C). Per tag, ONE
generated file holding TWO declarations: the service seam
`public interface I<Tag>Service` (DTO-typed, `Task`-returning, zero
ASP.NET imports) and `[ApiController] public sealed partial class
<Tag>Controller(I<Tag>Service service) : ControllerBase` — a C# 12
primary constructor injecting the seam, every action a complete
expression-bodied delegation. The consumer implements the interface
and registers it in DI
(`builder.Services.AddScoped<IUsersService, UsersService>()`); DI
verifies the seam at startup. Composes with `@skmtc/gen-csharp` for
DTOs (both must pin the SAME `lang-csharp`).

Validated floor: **.NET 10 LTS**.

## Source

`skmtc-generators/gen-csharp-aspnet` (fleet).

## What it generates

- Untagged operations land in `DefaultApi`; a multi-tag operation
  joins its FIRST tag only. Method names are PascalCase from
  method+path (`GetUsersId`).
- Parameter binding from the OAS location, explicit names always:
  `[FromRoute(Name = "id")]`, `[FromQuery(Name = "limit")]`,
  `[FromHeader(Name = "X-Tenant")]`, `[FromBody]`. The OAS path
  template is ASP.NET's own (`{id}`) — verbatim into
  `[HttpGet("/users/{id}")]`; no class-level `[Route]`.
- **Seam parameters are required-first** (CS1737: C# optionals must
  trail — Kotlin's named-args tolerance does not port); optional
  parameters default (`int? limit = null`) on the seam only; ONE
  order drives the seam, the binding, and the delegation arguments.
- Status map: 200 → `Task<T>` action wrapping automatically; 201/202
  with body → `Task<ActionResult<T>>` + `StatusCode(<code>, await …)`
  + `[ProducesResponseType]`; 204 → `Task<IActionResult>` delegating
  through the generated `GeneratedResults.NoContent(Task)` helper
  (emitted once on first use — a 204 needs await-then-return, which
  the expression-bodied grammar cannot say inline); other success
  codes → 200-style + `[ProducesResponseType(<code>)]` (documented
  limit).

## Entry — a factory, no default export

```ts
import { toCsharpAspnetEntry } from '@skmtc/gen-csharp-aspnet'

export default toCsharpAspnetEntry({
  baseNamespace: 'Acme.Api'   // REQUIRED — no default; may differ from gen-csharp's
})
```

## Consumer setup

- Implement each `I<Tag>Service`; register in DI.
- `builder.Services.AddControllers()` + `app.MapControllers()`.
- For CS-B polymorphic types in payloads, set
  `AllowOutOfOrderMetadataProperties = true` (see gen-csharp's
  reference).

## Customization seams (clone to change)

| Seam | Location |
|---|---|
| Status map / action shapes | `src/AspnetApiMethod.ts` |
| Tag grouping / naming / file layout | `src/apiFile.ts` |
| The 204 helper | `src/resultsSupport.ts` |
| Controller shell (attributes, base type, injection) | `src/AspnetApiClasses.ts` |

## Limits (documented, deliberate)

- Renames (`serviceMethodName`) and the error channel
  (`ProblemDetails` advice) arrive at CS-D.
- Bodyless 201/202 render the 200-style shape +
  `[ProducesResponseType]`.
- `trace` operations use `[AcceptVerbs("TRACE", Route = …)]` (ASP.NET
  ships no `[HttpTrace]`).
