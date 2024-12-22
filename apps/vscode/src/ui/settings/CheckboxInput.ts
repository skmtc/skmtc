import { scrubSelector } from '../../utilities/scrubSelector';

type CheckboxInputProps = {
  label: string;
  helperText?: string;
  value?: boolean;
  name: string;
};

export class CheckboxInput {
  label: string;
  helperText?: string;
  value?: boolean;
  name: string;

  constructor({ label, helperText, value, name }: CheckboxInputProps) {
    this.label = label;
    this.helperText = helperText;
    this.value = value;
    this.name = name;
  }

  toString() {
    return `<vscode-form-group variant="horizontal">
      <vscode-label for=id="${scrubSelector(this.name)}">${this.label}</vscode-label>
  <vscode-checkbox id="${scrubSelector(this.name)}"
    class="base-settings-input"
    name="${this.name}"
    checked="${`${this.value ?? false}`}"
  ></vscode-checkbox>
  ${this.helperText ? `<vscode-form-helper><p>${this.helperText}</p></vscode-form-helper>` : ''}
</vscode-form-group>
`;
  }
}
