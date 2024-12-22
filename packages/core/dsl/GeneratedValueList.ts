import type { GeneratedValue } from '../types/GeneratedValue.ts'
import { EMPTY } from './constants.ts'

export class GeneratedValueList {
  separator: string
  private items: GeneratedValue[] = []

  constructor(separator: string) {
    this.separator = separator
  }

  add(str: GeneratedValue): void {
    this.items.push(str)
  }

  toString(): string {
    return this.items
      .map(item => item.toString())
      .filter(item => item !== EMPTY)
      .join(this.separator)
  }
}
