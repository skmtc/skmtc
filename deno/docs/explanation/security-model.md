# Security model

> Worker permissions and the threat model.

## The question

## The short answer

## The trust boundary

### Host process

### Worker process

## Deno permissions granted to the Worker

### read

### write

### env

### Denied: net

### Denied: run

## Residual risks

### env reads + write → exfiltration via git push

### Workspace pollution

## Mitigations

### Clone-to-customize favors auditable source

### Manifest as forensic record

### CI-side controls

## What SKMTC doesn't protect against

## See also
