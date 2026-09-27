import * as http from 'node:http';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import { renderResultDocument } from './resultDocument';

export class BrowserPreview implements vscode.Disposable {
  private document = '';
  private server: http.Server | undefined;
  private port: number | undefined;
  // Random per-session secret so other local processes/pages can't fetch the preview by guessing the port.
  private readonly token = randomUUID();

  public async show(markdown: string): Promise<void> {
    const fontSize = vscode.workspace.getConfiguration('githubCopilotView').get<number>('fontSize', 14);
    this.document = renderResultDocument(markdown, fontSize);
    const port = await this.ensureServer();
    const opened = await vscode.env.openExternal(
      vscode.Uri.parse(`http://127.0.0.1:${port}/?token=${this.token}`),
    );

    if (!opened) {
      void vscode.window.showErrorMessage('Unable to open the Copilot result in your browser.');
    }
  }

  public dispose(): void {
    this.server?.close();
    this.server = undefined;
    this.port = undefined;
  }

  private async ensureServer(): Promise<number> {
    if (this.port !== undefined) {
      return this.port;
    }

    this.server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (requestUrl.pathname !== '/' || requestUrl.searchParams.get('token') !== this.token) {
        response.writeHead(404);
        response.end();
        return;
      }

      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      response.end(this.document);
    });

    await new Promise<void>((resolve, reject) => {
      this.server?.once('error', reject);
      this.server?.listen(0, '127.0.0.1', () => resolve());
    });

    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('The Copilot result preview server did not receive a local port.');
    }

    this.port = address.port;
    return this.port;
  }
}