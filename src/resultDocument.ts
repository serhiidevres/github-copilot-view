export function renderResultDocument(markdown: string, fontSize = 14): string {
  const contentSecurityPolicy = [
    "default-src 'none'",
    "img-src data:",
    "style-src 'unsafe-inline'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ');
  // Guard against non-finite or absurdly small values coming from user settings.
  const safeFontSize = Number.isFinite(fontSize) && fontSize >= 6 ? fontSize : 14;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
  <title>Copilot Result</title>
  <style>
    :root { color-scheme: light dark; }
    body { background: var(--vscode-editor-background, Canvas); color: var(--vscode-editor-foreground, CanvasText); font: ${safeFontSize}px/1.55 var(--vscode-font-family, sans-serif); margin: 0 auto; max-width: 920px; padding: 28px; }
    h1, h2, h3, h4, h5, h6 { line-height: 1.25; margin: 1.45em 0 .55em; }
    h1 { border-bottom: 1px solid var(--vscode-editorWidget-border, currentColor); padding-bottom: .35em; }
    p, ul, ol, pre { margin: .75em 0; }
    pre { background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, .12)); overflow-x: auto; padding: 12px; }
    code { font-family: var(--vscode-editor-font-family, monospace); }
    :not(pre) > code { background: var(--vscode-textCodeBlock-background, rgba(127, 127, 127, .12)); padding: .1em .3em; }
    a { color: var(--vscode-textLink-foreground, LinkText); }
  </style>
</head>
<body>${renderMarkdown(markdown)}</body>
</html>`;
}

function renderMarkdown(markdown: string): string {
  const lines = markdown.split('\n');
  const output: string[] = [];
  let paragraph: string[] = [];
  let codeLines: string[] = [];
  let fence: string | undefined;
  let listType: 'ol' | 'ul' | undefined;

  const flushParagraph = (): void => {
    if (paragraph.length > 0) {
      output.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = (): void => {
    if (listType) {
      output.push(`</${listType}>`);
      listType = undefined;
    }
  };

  for (const line of lines) {
    const fenceMatch = /^\s*(```|~~~)/.exec(line);
    if (fenceMatch) {
      flushParagraph();
      closeList();
      if (fence) {
        output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        fence = undefined;
      } else {
        fence = fenceMatch[1];
      }
      continue;
    }

    if (fence) {
      codeLines.push(line);
      continue;
    }

    const heading = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushParagraph();
      closeList();
      const level = heading[1].length;
      output.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const listItem = /^\s*([-*+]|\d+\.)\s+(.+)$/.exec(line);
    if (listItem) {
      flushParagraph();
      const nextListType = /\d+\./.test(listItem[1]) ? 'ol' : 'ul';
      if (listType && listType !== nextListType) {
        closeList();
      }
      if (!listType) {
        listType = nextListType;
        output.push(`<${listType}>`);
      }
      output.push(`<li>${renderInline(listItem[2])}</li>`);
      continue;
    }

    if (line.trim().length === 0) {
      flushParagraph();
      closeList();
      continue;
    }

    closeList();
    paragraph.push(line.trim());
  }

  if (fence) {
    output.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  closeList();
  return output.join('\n');
}

function renderInline(text: string): string {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Allows a single level of balanced parens in the URL (e.g. `...wiki/Foo_(bar)`) instead of stopping at the first `)`.
  html = html.replace(/\[([^\]]+)\]\(((?:[^\s()]|\([^\s()]*\))+)\)/g, (_match, label: string, url: string) => {
    return isSafeUrl(url) ? `<a href="${escapeHtml(url)}">${label}</a>` : label;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  return html;
}

function isSafeUrl(url: string): boolean {
  return /^(https?:|mailto:)/i.test(url);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}