import type { JsonObject, JsonValue } from './overlay.ts'

/**
 * A self-contained JSONPath query engine covering the subset used by OpenAPI
 * Overlays — no external dependency, so consuming projects never have to
 * resolve an npm package.
 *
 * Supported syntax:
 * - root `$` (optional; a bare leading name like `info.version` is also accepted)
 * - child access `.name`, `['name']`, `["name"]`
 * - wildcard `.*`, `[*]`
 * - recursive descent `..name`, `..*`, `..[...]`
 * - array index `[0]`, `[-1]` and unions `['a','b']`, `[0,1]`
 * - filter expressions `[?(@.field == 'value')]` with `== != < <= > >=`,
 *   `&& || !`, parentheses, existence (`@.field`), nested paths (`@.a.b`),
 *   and string / number / boolean / null literals
 *
 * Path resolution inside filters is null-safe: a missing or `null` segment
 * yields no match instead of throwing (jsonpath-plus 10.x throws here, which
 * silently aborts overlay actions during recursive descent over real specs).
 *
 * @module
 */

/** A single match with the live `parent` reference and key, for in-place mutation. */
export type PathMatch = {
  value: JsonValue
  parent: JsonObject | JsonValue[] | null
  parentProperty: string | number | null
}

type Selector =
  | { kind: 'name'; name: string }
  | { kind: 'wildcard' }
  | { kind: 'union'; keys: Array<string | number> }
  | { kind: 'filter'; predicate: (node: JsonValue) => boolean }

type Step = { descendant: boolean; selector: Selector }

function isObject(value: JsonValue): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// --- Query execution -------------------------------------------------------

/** Apply a single selector to one node's value, producing its matching children. */
function applySelector(value: JsonValue, selector: Selector): PathMatch[] {
  const matches: PathMatch[] = []

  switch (selector.kind) {
    case 'name': {
      if (isObject(value) && Object.prototype.hasOwnProperty.call(value, selector.name)) {
        matches.push({ value: value[selector.name], parent: value, parentProperty: selector.name })
      }
      break
    }
    case 'wildcard': {
      if (Array.isArray(value)) {
        value.forEach((element, index) =>
          matches.push({ value: element, parent: value, parentProperty: index })
        )
      } else if (isObject(value)) {
        for (const key of Object.keys(value)) {
          matches.push({ value: value[key], parent: value, parentProperty: key })
        }
      }
      break
    }
    case 'union': {
      for (const key of selector.keys) {
        if (typeof key === 'number') {
          if (Array.isArray(value)) {
            const index = key < 0 ? value.length + key : key
            if (index >= 0 && index < value.length) {
              matches.push({ value: value[index], parent: value, parentProperty: index })
            }
          } else if (isObject(value) && Object.prototype.hasOwnProperty.call(value, String(key))) {
            matches.push({ value: value[String(key)], parent: value, parentProperty: String(key) })
          }
        } else if (isObject(value) && Object.prototype.hasOwnProperty.call(value, key)) {
          matches.push({ value: value[key], parent: value, parentProperty: key })
        }
      }
      break
    }
    case 'filter': {
      if (Array.isArray(value)) {
        value.forEach((element, index) => {
          if (selector.predicate(element)) {
            matches.push({ value: element, parent: value, parentProperty: index })
          }
        })
      } else if (isObject(value)) {
        for (const key of Object.keys(value)) {
          if (selector.predicate(value[key])) {
            matches.push({ value: value[key], parent: value, parentProperty: key })
          }
        }
      }
      break
    }
  }

  return matches
}

/** Every node in `value`'s subtree, including `value` itself (pre-order). */
function gatherDescendants(value: JsonValue): JsonValue[] {
  const result: JsonValue[] = [value]
  if (Array.isArray(value)) {
    for (const element of value) result.push(...gatherDescendants(element))
  } else if (isObject(value)) {
    for (const key of Object.keys(value)) result.push(...gatherDescendants(value[key]))
  }
  return result
}

/**
 * Evaluate `expression` against `root`, returning every match in document
 * order. Throws on a malformed expression; an expression that simply matches
 * nothing returns `[]`.
 */
export function queryPaths(root: JsonValue, expression: string): PathMatch[] {
  const steps = parsePath(expression)
  let current: PathMatch[] = [{ value: root, parent: null, parentProperty: null }]

  for (const step of steps) {
    const next: PathMatch[] = []
    for (const node of current) {
      const targets = step.descendant ? gatherDescendants(node.value) : [node.value]
      for (const target of targets) {
        next.push(...applySelector(target, step.selector))
      }
    }
    current = next
  }

  return current
}

// --- Path parsing ----------------------------------------------------------

function parsePath(expression: string): Step[] {
  const source = expression.trim()
  const steps: Step[] = []
  let i = source[0] === '$' ? 1 : 0

  while (i < source.length) {
    let descendant = false
    if (source[i] === '.' && source[i + 1] === '.') {
      descendant = true
      i += 2
    } else if (source[i] === '.') {
      i += 1
    }

    if (i >= source.length) {
      throw new Error(`Unexpected end of JSONPath: ${expression}`)
    }

    if (source[i] === '[') {
      const end = findBracketEnd(source, i)
      steps.push({ descendant, selector: parseBracket(source.slice(i + 1, end)) })
      i = end + 1
    } else if (source[i] === '*') {
      steps.push({ descendant, selector: { kind: 'wildcard' } })
      i += 1
    } else {
      const start = i
      while (i < source.length && source[i] !== '.' && source[i] !== '[') i++
      const name = source.slice(start, i).trim()
      if (name === '') throw new Error(`Empty JSONPath segment in: ${expression}`)
      steps.push({
        descendant,
        selector: name === '*' ? { kind: 'wildcard' } : { kind: 'name', name },
      })
    }
  }

  return steps
}

/** Index of the `]` that closes the `[` at `start`, respecting quotes. */
function findBracketEnd(source: string, start: number): number {
  let depth = 0
  let quote: string | null = null

  for (let i = start; i < source.length; i++) {
    const char = source[i]
    if (quote !== null) {
      if (char === '\\') i++
      else if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') quote = char
    else if (char === '[') depth++
    else if (char === ']' && --depth === 0) return i
  }

  throw new Error(`Unbalanced brackets in JSONPath: ${source}`)
}

function parseBracket(inner: string): Selector {
  const trimmed = inner.trim()

  if (trimmed === '*') return { kind: 'wildcard' }

  if (trimmed.startsWith('?')) {
    const open = trimmed.indexOf('(')
    const close = trimmed.lastIndexOf(')')
    if (open === -1 || close <= open) throw new Error(`Malformed filter: ${inner}`)
    return { kind: 'filter', predicate: compileFilter(trimmed.slice(open + 1, close)) }
  }

  const keys = splitUnion(trimmed).map(parseKey)
  if (keys.length === 0) throw new Error(`Empty bracket selector: ${inner}`)
  return { kind: 'union', keys }
}

/** Split a union body on commas that sit outside quotes. */
function splitUnion(body: string): string[] {
  const parts: string[] = []
  let current = ''
  let quote: string | null = null

  for (let i = 0; i < body.length; i++) {
    const char = body[i]
    if (quote !== null) {
      current += char
      if (char === quote) quote = null
      continue
    }
    if (char === "'" || char === '"') {
      quote = char
      current += char
    } else if (char === ',') {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  parts.push(current)

  return parts.map((part) => part.trim()).filter((part) => part.length > 0)
}

function parseKey(token: string): string | number {
  if (
    (token.startsWith("'") && token.endsWith("'")) ||
    (token.startsWith('"') && token.endsWith('"'))
  ) {
    return token.slice(1, -1).replace(/\\(['"\\])/g, '$1')
  }
  if (/^-?\d+$/.test(token)) return Number(token)
  return token
}

// --- Filter expressions ----------------------------------------------------

type Token =
  | {
    t: '@' | '.' | '[' | ']' | '(' | ')' | '==' | '!=' | '<' | '<=' | '>' | '>=' | '&&' | '||' | '!'
  }
  | { t: 'str' | 'num' | 'ident'; v: string }

type ValueEval = (node: JsonValue) => JsonValue | undefined

function tokenizeFilter(expression: string): Token[] {
  const tokens: Token[] = []
  const isIdentChar = (char: string) => /[A-Za-z0-9_\-$]/.test(char)
  let i = 0

  while (i < expression.length) {
    const char = expression[i]

    if (/\s/.test(char)) {
      i++
      continue
    }

    if (char === "'" || char === '"') {
      let value = ''
      let j = i + 1
      while (j < expression.length && expression[j] !== char) {
        if (expression[j] === '\\') {
          value += expression[j + 1] ?? ''
          j += 2
        } else {
          value += expression[j]
          j++
        }
      }
      tokens.push({ t: 'str', v: value })
      i = j + 1
      continue
    }

    const three = expression.slice(i, i + 3)
    if (three === '===' || three === '!==') {
      tokens.push({ t: three === '===' ? '==' : '!=' })
      i += 3
      continue
    }

    const two = expression.slice(i, i + 2)
    if (
      two === '==' || two === '!=' || two === '<=' || two === '>=' || two === '&&' || two === '||'
    ) {
      tokens.push({ t: two })
      i += 2
      continue
    }

    if (
      char === '@' || char === '.' || char === '[' || char === ']' || char === '(' || char === ')'
    ) {
      tokens.push({ t: char })
      i++
      continue
    }
    if (char === '<' || char === '>' || char === '!') {
      tokens.push({ t: char })
      i++
      continue
    }

    if (/[0-9]/.test(char) || (char === '-' && /[0-9]/.test(expression[i + 1] ?? ''))) {
      let j = i + 1
      while (j < expression.length && /[0-9.]/.test(expression[j])) j++
      tokens.push({ t: 'num', v: expression.slice(i, j) })
      i = j
      continue
    }

    if (isIdentChar(char)) {
      let j = i
      while (j < expression.length && isIdentChar(expression[j])) j++
      tokens.push({ t: 'ident', v: expression.slice(i, j) })
      i = j
      continue
    }

    throw new Error(`Unexpected character '${char}' in filter: ${expression}`)
  }

  return tokens
}

function looseEqual(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  return a === b
}

function relational(a: JsonValue | undefined, b: JsonValue | undefined, op: string): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b
  }
  if (typeof a === 'string' && typeof b === 'string') {
    return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b
  }
  return false
}

function isTruthy(value: JsonValue | undefined): boolean {
  return value === undefined ? false : Boolean(value)
}

function resolveFilterPath(
  node: JsonValue,
  segments: Array<string | number>,
): JsonValue | undefined {
  let current: JsonValue | undefined = node
  for (const segment of segments) {
    if (current === undefined) return undefined
    if (typeof segment === 'number') {
      if (Array.isArray(current) && segment >= 0 && segment < current.length) {
        current = current[segment]
      } else if (
        isObject(current) && Object.prototype.hasOwnProperty.call(current, String(segment))
      ) {
        current = current[String(segment)]
      } else {
        return undefined
      }
    } else if (isObject(current) && Object.prototype.hasOwnProperty.call(current, segment)) {
      current = current[segment]
    } else {
      return undefined
    }
  }
  return current
}

/** Compile a filter body (the `…` of `[?(…)]`) into a predicate over the candidate node. */
function compileFilter(expression: string): (node: JsonValue) => boolean {
  const tokens = tokenizeFilter(expression)
  let pos = 0

  const peek = (): Token | undefined => tokens[pos]
  const advance = (): Token | undefined => tokens[pos++]
  const expect = (t: Token['t']): void => {
    const token = advance()
    if (!token || token.t !== t) throw new Error(`Expected '${t}' in filter: ${expression}`)
  }

  const parseOr = (): (node: JsonValue) => boolean => {
    let left = parseAnd()
    while (peek()?.t === '||') {
      advance()
      const right = parseAnd()
      const previous = left
      left = (node) => previous(node) || right(node)
    }
    return left
  }

  const parseAnd = (): (node: JsonValue) => boolean => {
    let left = parseUnary()
    while (peek()?.t === '&&') {
      advance()
      const right = parseUnary()
      const previous = left
      left = (node) => previous(node) && right(node)
    }
    return left
  }

  const parseUnary = (): (node: JsonValue) => boolean => {
    if (peek()?.t === '!') {
      advance()
      const operand = parseUnary()
      return (node) => !operand(node)
    }
    return parseComparison()
  }

  const parseComparison = (): (node: JsonValue) => boolean => {
    if (peek()?.t === '(') {
      advance()
      const inner = parseOr()
      expect(')')
      return inner
    }

    const left = parseValue()
    const operator = peek()?.t
    if (
      operator === '==' || operator === '!=' || operator === '<' ||
      operator === '<=' || operator === '>' || operator === '>='
    ) {
      advance()
      const right = parseValue()
      return (node) => {
        const a = left(node)
        const b = right(node)
        if (operator === '==') return looseEqual(a, b)
        if (operator === '!=') return !looseEqual(a, b)
        return relational(a, b, operator)
      }
    }

    return (node) => isTruthy(left(node))
  }

  const parseValue = (): ValueEval => {
    const token = peek()
    if (!token) throw new Error(`Unexpected end of filter: ${expression}`)

    if (token.t === '@') {
      advance()
      const segments: Array<string | number> = []
      while (peek()?.t === '.' || peek()?.t === '[') {
        if (peek()?.t === '.') {
          advance()
          const name = advance()
          if (!name || name.t !== 'ident') {
            throw new Error(`Expected identifier after '.' in filter: ${expression}`)
          }
          segments.push(name.v)
        } else {
          advance()
          const key = advance()
          if (key?.t === 'str' || key?.t === 'ident') segments.push(key.v)
          else if (key?.t === 'num') segments.push(Number(key.v))
          else throw new Error(`Expected key after '[' in filter: ${expression}`)
          expect(']')
        }
      }
      return (node) => resolveFilterPath(node, segments)
    }

    if (token.t === 'str') {
      advance()
      return () => token.v
    }
    if (token.t === 'num') {
      advance()
      return () => Number(token.v)
    }
    if (token.t === 'ident') {
      advance()
      if (token.v === 'true') return () => true
      if (token.v === 'false') return () => false
      if (token.v === 'null') return () => null
      return () => token.v
    }

    throw new Error(`Unexpected token '${token.t}' in filter: ${expression}`)
  }

  const evaluator = parseOr()
  if (pos !== tokens.length) throw new Error(`Unexpected trailing tokens in filter: ${expression}`)
  return evaluator
}
