# Why three phases

> The rationale for separating Parse, Generate, and Render.

## The question

## The short answer

## Each phase's distinct concern

### Parse: error tolerance + typed model

### Generate: cross-generator coordination

### Render: serialization

## What's lost by combining phases

### Combining Parse + Generate

### Combining Generate + Render

## What's gained by separating them

### Each phase's invariants

### The structuredClone boundary at Generate's start

## See also
