import { match } from 'ts-pattern';
import { LogOutputChannel } from 'vscode';

type WriteLogsArgs = {
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
};

export const writeLogs = (logChannel: LogOutputChannel, line: WriteLogsArgs) => {
  try {
    const parsed = JSON.parse(line.message);
    handleJSON(logChannel, parsed);
  } catch (error) {
    handleString(logChannel, line);
  }
};

export const handleString = (logChannel: LogOutputChannel, line: WriteLogsArgs) => {
  match(line)
    .with({ level: 'error' }, ({ message }) => {
      logChannel?.error(message.replace(/^\s+|\s+$/g, ''));
    })
    .with({ level: 'warning' }, ({ message }) => {
      logChannel?.warn(message.replace(/^\s+|\s+$/g, ''));
    })
    .with({ level: 'info' }, ({ message }) => {
      logChannel?.info(message.replace(/^\s+|\s+$/g, ''));
    })
    .with({ level: 'debug' }, ({ message }) => {
      logChannel?.debug(message.replace(/^\s+|\s+$/g, ''));
    })
    .otherwise(({ message }) => {
      logChannel?.appendLine(message.replace(/^\s+|\s+$/g, ''));
    });
};

type JsonLogArgs = {
  level?: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  message?: string;
  stackTrail?: string;
};

export const handleJSON = (logChannel: LogOutputChannel, line: JsonLogArgs) => {
  const { level, message, stackTrail, ...rest } = line;

  if (!message) {
    return;
  }

  const content = stackTrail ? `${stackTrail}\n${message}` : message;

  match(level)
    .with('ERROR', () => logChannel?.error(content))
    .with('WARN', () => logChannel?.warn(content))
    .with('INFO', () => logChannel?.info(content))
    .with('DEBUG', () => logChannel?.debug(content))
    .otherwise(() => logChannel?.info(content));
};
