import { List } from './List';

type SchemaSettingsInputsArgs = {
  generatorId: string;
  list: List;
  stackTrail: string[];
};

export class SchemaSettingsInputs {
  generatorId: string;

  list: List;

  stackTrail: string[];

  heading: string;

  constructor({ generatorId, stackTrail = [], list }: SchemaSettingsInputsArgs) {
    this.generatorId = generatorId;

    this.stackTrail = stackTrail;

    this.list = list;

    this.heading =
      this.stackTrail.length > 2 ? `${this.stackTrail.slice(2).join(' ')}` : `${this.generatorId}`;
  }

  toString() {
    return `
    <vscode-label>${this.heading}</vscode-label>

    ${this.list}
    <vscode-divider></vscode-divider>
    `;
  }
}
