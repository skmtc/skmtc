import { UpdateSettingMessage } from '../types/messages';

import '@vscode-elements/elements';

// Get access to the VS Code API from within the webview context
const vscode = acquireVsCodeApi();

// Just like a regular webpage we need to wait for the webview
// DOM to load before we can reference any of the HTML elements
// or toolkit components

window.addEventListener('load', main);

const debounce = (callback: (...args: any[]) => void, wait: number) => {
  let timeoutId: undefined | number;

  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
};

function main() {
  const settingsChange = document.querySelectorAll('.base-settings-input');

  settingsChange.forEach((setting) => {
    setting.addEventListener('input', handleSettingsChange);
  });
}

const handleSettingsChange = debounce((event: Event) => {
  const target = event.target as HTMLInputElement;

  const updateSetting: UpdateSettingMessage = {
    command: 'updateSetting',
    payload: {
      value: target.type === 'checkbox' ? target.checked : target.value,
      stackTrail: target.name,
      fromForm: true,
    },
  };

  vscode.postMessage(updateSetting);
}, 300);
