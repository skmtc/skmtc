import { scrubSelector } from '../../utilities/scrubSelector';

type StringInputProps = {
  label: string;
  helperText?: string;
  value?: string;
  name: string;
};

export class StringInput {
  label: string;
  helperText?: string;
  value?: string;
  name: string;

  constructor({ label, helperText, value, name }: StringInputProps) {
    this.label = label;
    this.helperText = helperText;
    this.value = value;
    this.name = name;
  }

  toString() {
    return `<vscode-form-group variant="horizontal">
  <vscode-label for="${scrubSelector(this.name)}">${this.label}</vscode-label>
  <vscode-textfield
    id="${scrubSelector(this.name)}"
    name="${this.name}"
    class="base-settings-input"
    value="${this.value ?? ''}"
  ></vscode-textfield>
  ${this.helperText ? `<vscode-form-helper><p>${this.helperText}</p></vscode-form-helper>` : ''}
</vscode-form-group>
`;
  }
}
