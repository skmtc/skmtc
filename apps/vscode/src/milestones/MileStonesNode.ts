import { Command, ThemeIcon, TreeItem } from 'vscode';

type MilestonesNodeArgs = {
  nodeId: string;
  nodeLabel: string;
  command?: Command;
  tooltip?: string;
  description?: string;
  icon: ThemeIcon;
  contextValue?: string;
};

export class MilestonesNode extends TreeItem {
  id: string;
  command?: Command;
  children: MilestonesNode[] | undefined;

  constructor({
    nodeId,
    nodeLabel,
    command,
    contextValue,
    icon,
    description,
    tooltip,
  }: MilestonesNodeArgs) {
    super(nodeLabel);

    this.id = nodeId;
    this.command = command;
    this.tooltip = tooltip;
    this.description = description;
    this.iconPath = icon;
    this.contextValue = contextValue;
  }
}
