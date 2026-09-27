import * as vscode from 'vscode';
import { BrowserPreview } from './browserPreview';
import { formatCopiedResult } from './resultFormatter';

export function activate(context: vscode.ExtensionContext): void {
  const browserPreview = new BrowserPreview();

  context.subscriptions.push(
    browserPreview,
    vscode.commands.registerCommand('githubCopilotView.showResult', async () => {
      await showResult(browserPreview);
    }),
  );
}

async function readFormattedClipboard(): Promise<string | undefined> {
  const clipboardText = await vscode.env.clipboard.readText();

  if (clipboardText.trim().length === 0) {
    void vscode.window.showWarningMessage(
      'Copy a Copilot Chat response first, then run this command.',
    );
    return undefined;
  }

  return formatCopiedResult(clipboardText).markdown;
}

async function showResult(browserPreview: BrowserPreview): Promise<void> {
  try {
    const markdown = await readFormattedClipboard();
    if (markdown === undefined) {
      return;
    }

    await vscode.env.clipboard.writeText(markdown);
    await browserPreview.show(markdown);
  } catch (error) {
    void vscode.window.showErrorMessage(
      `Failed to show the Copilot result: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function deactivate(): void {}