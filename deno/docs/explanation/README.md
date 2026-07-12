# Explanation

> Design rationale — why SKMTC is built the way it is, the
> alternatives considered, and the trade-offs accepted. For evaluators
> deciding whether SKMTC fits, and for the curious after first
> success.

## Deciding whether to adopt

- [Comparison to other tools](comparison-to-other-tools.md) — the landscape, and when to pick something else
- [Why clone-to-customize](why-clone-to-customize.md) — the central bet, with its counter-cases
- [Design philosophy](design-philosophy.md) — the principles behind the choices
- [Status and roadmap](status-and-roadmap.md) — what to depend on today
- [Security model](security-model.md) — the sandbox and its residual risks

## Understanding the machine

- [How idempotency works](how-idempotency-works.md) — the order-independence proof
- [Why three phases](why-three-phases.md) — what combining phases would break
- [Error handling philosophy](error-handling-philosophy.md) — lenient input, strict diagnostics
- [The GraphQL asymmetry](the-graphql-asymmetry.md) — why GraphQL parses worker-side
