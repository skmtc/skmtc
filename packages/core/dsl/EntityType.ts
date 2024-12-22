import { match } from 'npm:ts-pattern@5.2.0'

export class EntityType {
  type: 'variable' | 'type'
  constructor(type: 'variable' | 'type') {
    this.type = type
  }

  toString(): string {
    return match(this.type)
      .with('variable', () => 'const')
      .with('type', () => 'type')
      .exhaustive()
  }
}
