# The GraphQL asymmetry

> Why OAS is parsed host-side but GraphQL is parsed worker-side.

## The question

## The short answer

## The constraint: `structuredClone`

### What survives a Worker postMessage

### What doesn't

## Why OAS can cross the boundary as parsed JSON

## Why GraphQL can't

### Class instances with back-references

### Why we don't refactor to avoid them

## Consequences

### Pre-parse step exists only for OAS

### GraphQL pipeline does more work inside the Worker

### Tradeoffs

## See also
