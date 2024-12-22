import { QuickPickItem, window, Disposable, QuickInputButtons } from 'vscode';

type CreateQuickPickArgs = {
  title: string;
  placeholder?: string;
  items: QuickPickItem[];
};

export async function createQuickPick({ title, placeholder, items }: CreateQuickPickArgs) {
  const pick = await showQuickPick({
    title,
    placeholder,
    items,
    shouldResume: shouldResume,
  });

  function shouldResume() {
    // Could show a notification with the option to resume.
    return new Promise<boolean>((resolve, reject) => {
      // noop
    });
  }

  return pick;
}

class InputFlowAction {
  static back = new InputFlowAction();
  static cancel = new InputFlowAction();
  static resume = new InputFlowAction();
}

interface QuickPickParameters<T extends QuickPickItem> {
  title: string;
  items: T[];
  placeholder: string | undefined;
  shouldResume: () => Thenable<boolean>;
}

const showQuickPick = async <T extends QuickPickItem, P extends QuickPickParameters<T>>({
  title,
  items,
  placeholder,
  shouldResume,
}: P) => {
  const disposables: Disposable[] = [];
  try {
    return await new Promise<T | (P extends { buttons: (infer I)[] } ? I : never)>(
      (resolve, reject) => {
        const input = window.createQuickPick<T>();
        input.title = title;
        input.step = 1;
        input.totalSteps = 1;
        input.placeholder = placeholder;
        input.items = items;

        disposables.push(
          input.onDidTriggerButton((item) => {
            if (item === QuickInputButtons.Back) {
              reject(InputFlowAction.back);
            } else {
              resolve(<any>item);

              input.dispose();
            }
          }),
          input.onDidChangeSelection((items) => {
            resolve(items[0]);
            input.dispose();
          }),
          input.onDidHide(() => {
            (async () => {
              reject(
                shouldResume && (await shouldResume())
                  ? InputFlowAction.resume
                  : InputFlowAction.cancel
              );
            })().catch(reject);
          })
        );
        input.show();
      }
    );
  } finally {
    disposables.forEach((d) => d.dispose());
  }
};
