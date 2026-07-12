/**
 * A small, rule-driven OpenAPI linter ported from swagger2openapi's
 * `linter/linter.js`. Rules are loaded from `rules.json`.
 *
 * Unlike the original — which threw (via `should`) on the first violation — this
 * port records violations on `options.violations`, so linting reports rather
 * than aborts. Validation continues and the caller inspects the collected list.
 *
 * @module
 */

import rulesData from './rules.json' with { type: 'json' }
import { isJsonArray, isJsonObject, isNumber, isString, type JsonValue, toJson } from './json.ts'
import type { Linter, LinterRule, ValidateOptions } from './types.ts'

const asStringArray = (value: JsonValue | undefined): string[] | undefined => {
  if (isString(value)) return [value]
  if (isJsonArray(value)) return value.filter(isString)
  return undefined
}

const toLinterRule = (value: JsonValue): LinterRule | undefined => {
  if (!isJsonObject(value)) return undefined
  if (!isString(value.name) || !isString(value.description)) return undefined
  const objects = asStringArray(value.object)
  if (!objects) return undefined

  const rule: LinterRule = {
    name: value.name,
    description: value.description,
    object: objects,
    enabled: value.enabled === true
  }
  const truthy = asStringArray(value.truthy)
  if (truthy) rule.truthy = truthy
  if (isNumber(value.properties)) rule.properties = value.properties
  const or = asStringArray(value.or)
  if (or) rule.or = or
  const xor = asStringArray(value.xor)
  if (xor) rule.xor = xor
  if (
    isJsonObject(value.pattern) &&
    isString(value.pattern.property) &&
    isString(value.pattern.value)
  ) {
    rule.pattern = {
      property: value.pattern.property,
      value: value.pattern.value,
      split: isString(value.pattern.split) ? value.pattern.split : undefined,
      omit: isString(value.pattern.omit) ? value.pattern.omit : undefined
    }
  }
  if (isJsonObject(value.notContain)) {
    const properties = asStringArray(value.notContain.properties)
    if (properties && isString(value.notContain.value)) {
      rule.notContain = { properties, value: value.notContain.value }
    }
  }
  return rule
}

const normalizeRules = (raw: JsonValue): Record<string, LinterRule> => {
  const result: Record<string, LinterRule> = {}
  if (!isJsonObject(raw)) return result
  for (const key of Object.keys(raw)) {
    const rule = toLinterRule(raw[key])
    if (rule && rule.enabled) result[key] = rule
  }
  return result
}

let activeRules: Record<string, LinterRule> = normalizeRules(toJson(rulesData))

/** Merges additional rules (in the `rules.json` shape) into the active rule set. */
export const loadRules = (extra: JsonValue): void => {
  activeRules = { ...activeRules, ...normalizeRules(extra) }
}

const isEmpty = (value: JsonValue): boolean => {
  if (value === null) return true
  if (isString(value)) return value.length === 0
  if (isJsonArray(value)) return value.length === 0
  if (isJsonObject(value)) return Object.keys(value).length === 0
  return false
}

const currentPointer = (options: ValidateOptions): string => {
  const context = options.context ?? []
  return context.length ? context[context.length - 1] : '#'
}

/**
 * Lints `object` (identified by `objectName`, e.g. `operation`, `schema`) against
 * the active rules, pushing any violations onto `options.violations`.
 */
export const lint: Linter = (objectName, object, options) => {
  if (!isJsonObject(object)) return

  const record = (rule: LinterRule, message?: string): void => {
    const violations = options.violations ?? (options.violations = [])
    violations.push({
      rule: rule.name,
      description: message ?? rule.description,
      pointer: currentPointer(options)
    })
  }

  for (const ruleName of Object.keys(activeRules)) {
    const rule = activeRules[ruleName]
    const objects = isJsonArray(rule.object) ? rule.object : [rule.object]
    if (!(objects[0] === '*' || objects.includes(objectName))) continue
    options.lintRule = rule

    if (rule.truthy) {
      for (const property of rule.truthy) {
        if (typeof object[property] === 'undefined' || isEmpty(object[property])) record(rule)
      }
    }
    if (typeof rule.properties === 'number') {
      if (Object.keys(object).length !== rule.properties) record(rule)
    }
    if (rule.or) {
      if (!rule.or.some(property => typeof object[property] !== 'undefined')) record(rule)
    }
    if (rule.xor) {
      let found = false
      let conflict = false
      for (const property of rule.xor) {
        if (typeof object[property] !== 'undefined') {
          if (found) conflict = true
          found = true
        }
      }
      if (!found || conflict) record(rule)
    }
    if (rule.pattern) {
      const source = object[rule.pattern.property]
      const components =
        rule.pattern.split && isString(source)
          ? source.split(rule.pattern.split)
          : isString(source)
            ? [source]
            : []
      const regex = new RegExp(rule.pattern.value)
      for (let component of components) {
        if (rule.pattern.omit) component = component.split(rule.pattern.omit).join('')
        if (component && !regex.test(component)) record(rule)
      }
    }
    if (rule.notContain) {
      for (const property of rule.notContain.properties) {
        const value = object[property]
        if (isString(value) && value.indexOf(rule.notContain.value) >= 0) record(rule)
      }
    }
  }

  delete options.lintRule
}
