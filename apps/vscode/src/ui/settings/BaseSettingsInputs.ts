import { CheckboxInput } from './CheckboxInput';

type BaseSettingsInputsArgs = {
  generatorId: string;
  selected: boolean;
  stackTrail: string[];
};

export class BaseSettingsInputs {
  generatorId: string;
  selected: CheckboxInput;

  stackTrail: string[];

  heading: string;

  constructor({
    generatorId,
    selected,
    stackTrail = [],
  }: BaseSettingsInputsArgs) {
    this.generatorId = generatorId;

    this.stackTrail = stackTrail;

    this.selected = new CheckboxInput({
      label: 'Selected',
      name: stackTrail.concat('selected').join(':'),
      value: selected,
    });

    this.heading =
      this.stackTrail.length > 2
        ? `${this.stackTrail.slice(2).join(' ')} <span class="normal">${this.generatorId}</span>`
        : `${this.generatorId}`;
  }

  toString() {
    return `
    <vscode-label>${this.heading}</vscode-label>

    ${this.selected}
    <vscode-divider></vscode-divider>
    `;
  }
}
