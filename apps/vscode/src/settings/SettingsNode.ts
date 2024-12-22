import { SettingMeta } from '../types/SettingMeta';
import {
  Command,
  ThemeIcon,
  TreeItem,
  TreeItemCheckboxState,
  TreeItemCollapsibleState,
} from 'vscode';

type SettingsNodeArgs = {
  nodeId: string;
  nodeLabel: string;
  collapsibleState: TreeItemCollapsibleState;
  children?: SettingsNode[];
  command?: Command;
  meta?: SettingMeta;
  selected?: boolean;
  selectCount: number;
  editCount: number;
  description?: string;
  iconPath?: string;
};

export class SettingsNode extends TreeItem {
  children?: SettingsNode[];
  id: string;
  meta?: SettingMeta;
  command?: Command;
  selectCount: number;
  editCount: number;

  constructor({
    nodeId,
    nodeLabel,
    collapsibleState,
    command,
    children,
    meta,
    selected,
    selectCount,
    editCount,
    iconPath,
    description,
  }: SettingsNodeArgs) {
    super(nodeLabel, collapsibleState);

    const descriptionItems = [
      selectCount && `${selectCount} selected`,
      editCount && `${editCount} edited`,
    ];

    this.id = nodeId;
    this.command = command
      ? {
          ...command,
          arguments: [this],
        }
      : undefined;
    this.meta = meta;
    this.collapsibleState = collapsibleState;
    this.children = children;
    this.selectCount = selectCount;
    this.editCount = editCount;
    this.description = description ?? descriptionItems.filter(Boolean).join(', ');
    this.iconPath = iconPath ? new ThemeIcon(iconPath) : undefined;

    if (meta?.type === 'operation' || meta?.type === 'model') {
      this.checkboxState = selected
        ? TreeItemCheckboxState.Checked
        : TreeItemCheckboxState.Unchecked;
    }
  }
}
