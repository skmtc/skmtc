import { CheckboxInput } from './CheckboxInput';
import { StringInput } from './StringInput';

type BaseSettingsInputsArgs = {
  generatorId: string;

  selected: boolean;
  name?: string;
  exportPath?: string;
  importFrom?: string;

  stackTrail: string[];
};

export class BaseSettingsInputs {
  generatorId: string;
  selected: CheckboxInput;
  name: StringInput;
  exportPath: StringInput;
  importFrom: StringInput;

  stackTrail: string[];

  heading: string;

  constructor({
    generatorId,
    selected,
    name = '',
    exportPath = '',
    importFrom = '',
    stackTrail = [],
  }: BaseSettingsInputsArgs) {
    this.generatorId = generatorId;

    this.stackTrail = stackTrail;

    this.selected = new CheckboxInput({
      label: 'Selected',
      name: stackTrail.concat('selected').join(':'),
      value: selected,
    });

    this.name = new StringInput({
      label: 'Name',
      name: stackTrail.concat('name').join(':'),
      value: name,
    });

    this.exportPath = new StringInput({
      label: 'Export path',
      name: stackTrail.concat('export-path').join(':'),
      value: exportPath,
    });

    this.importFrom = new StringInput({
      label: 'Import from',
      name: stackTrail.concat('import-from').join(':'),
      value: importFrom,
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
    ${this.name}
    ${this.exportPath}
    ${this.importFrom}
    <vscode-divider></vscode-divider>
    `;
  }
}
