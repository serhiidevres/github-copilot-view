# GithubCopilotView

Preview a copied GitHub Copilot Chat response in your default browser, or copy it as clean Markdown.

## Workflow

1. Use GitHub Copilot Chat normally, including its model, context, multi-turn, and edit features.
2. Click Copilot Chat's built-in **Copy** button on the response you want to use.
3. Run **Show Copilot Result** (`githubCopilotView.showResult`) from the Command Palette.

The command reformats the clipboard content (stripping reasoning/tool-call noise), writes the cleaned Markdown back to the clipboard so it's ready to paste elsewhere (e.g. Obsidian), and opens a local HTML preview of it in your default browser.

This is an ordinary VS Code command, so you can assign your own keyboard shortcut to it from the Keyboard Shortcuts editor.

## Settings

- `githubCopilotView.fontSize` — Font size (in pixels) for the text shown in the browser preview. Defaults to `14`. Change it in the Settings editor (search for "GithubCopilotView") or in `settings.json`:

  ```json
  {
    "githubCopilotView.fontSize": 18
  }
  ```

## Installation

These steps are the same on Windows and Linux; only the shell prompt differs.

1. Clone or download this repository, then open a terminal in its root folder.
2. Install dependencies and package the extension into a `.vsix` file:

   ```powershell
   npm install
   npx @vscode/vsce package --no-rewrite-relative-links --allow-missing-repository
   ```

   The extra flags are needed because this repository does not declare a `repository` field in `package.json`. This produces a file named `github-copilot-view-<version>.vsix` in the project root.
3. Install the generated file into VS Code, either:
   - From the terminal: `code --install-extension github-copilot-view-<version>.vsix`
   - From the UI: open the **Extensions** view, click the `...` menu, choose **Install from VSIX...**, and select the file.

The `code` command must be on your `PATH` for the terminal method. On Windows, enable this via the "Add to PATH" checkbox in the VS Code installer (or run **Shell Command: Install 'code' command in PATH** from the Command Palette). On Linux, package manager installs of VS Code typically add `code` to `PATH` automatically; otherwise use the same Command Palette command.

## Security and Scope

The extension reads only the system clipboard after you invoke a command. It does not read GitHub Copilot Chat history, trigger Copilot's Copy button, access private reasoning, or inspect model/context settings.

Copied markup is escaped before rendering, and only a safe Markdown subset is supported: headings, lists, code blocks, inline code, emphasis, and `http`, `https`, or `mailto` links. Copied HTML and scripts are never executed. Links that use other schemes (e.g. `javascript:`) are rendered as plain text instead of a clickable link.

The browser preview is served from a local HTTP server bound to `127.0.0.1` on a random port. Because the response may contain sensitive code or context, each preview request must include a random per-session token generated when the extension host starts; requests without a valid token receive a `404`. The server and its token are torn down when the extension is deactivated. The rendered page also sets a restrictive `Content-Security-Policy` (`default-src 'none'`) that blocks scripts and any network access besides inline styles and `data:` images.

## Development

```powershell
npm install
npm run check-types
npm test
```

Press `F5` in VS Code to launch an Extension Development Host.

## Debug
Run 'Attach to Extension Host' debug configuration.

Run command to launc VS Code debug instance
```
code --extensionDevelopmentPath="PathToExtension" --inspect-brk-extensions=9229
```
Replace PathToExtension with real path to the root directory for the extension.

## License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](LICENSE) file for details.