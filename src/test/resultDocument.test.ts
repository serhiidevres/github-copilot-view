import assert from 'node:assert/strict';
import { renderResultDocument } from '../resultDocument';

function runTest(name: string, test: () => void): void {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('escapes raw HTML tags to prevent injection', () => {
  const html = renderResultDocument('<script>alert(1)</script>');
  assert.equal(html.includes('<script>alert(1)</script>'), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

runTest('escapes HTML inside inline code spans', () => {
  const html = renderResultDocument('`<img src=x onerror=alert(1)>`');
  assert.equal(html.includes('<img src=x'), false);
  assert.match(html, /<code>&lt;img src=x onerror=alert\(1\)&gt;<\/code>/);
});

runTest('rejects javascript: links but keeps the label', () => {
  const html = renderResultDocument('[click me](javascript:alert(1))');
  assert.equal(html.includes('href="javascript:alert(1)"'), false);
  assert.match(html, /<p>click me<\/p>/);
});

runTest('allows http, https, and mailto links', () => {
  const html = renderResultDocument(
    '[a](https://example.com) [b](http://example.com) [c](mailto:test@example.com)',
  );
  assert.match(html, /<a href="https:\/\/example\.com">a<\/a>/);
  assert.match(html, /<a href="http:\/\/example\.com">b<\/a>/);
  assert.match(html, /<a href="mailto:test@example\.com">c<\/a>/);
});

runTest('keeps a single level of balanced parens inside a URL', () => {
  const html = renderResultDocument('[wiki](https://en.wikipedia.org/wiki/Foo_(bar))');
  assert.match(html, /<a href="https:\/\/en\.wikipedia\.org\/wiki\/Foo_\(bar\)">wiki<\/a>/);
});

runTest('renders headings, lists, and code fences', () => {
  const html = renderResultDocument('# Title\n\n- one\n- two\n\n```js\nconst x = 1;\n```');
  assert.match(html, /<h1>Title<\/h1>/);
  assert.match(html, /<ul>\n<li>one<\/li>\n<li>two<\/li>\n<\/ul>/);
  assert.match(html, /<pre><code>const x = 1;<\/code><\/pre>/);
});

runTest('switches list type between ordered and unordered', () => {
  const html = renderResultDocument('1. first\n2. second\n- bullet');
  assert.match(html, /<ol>\n<li>first<\/li>\n<li>second<\/li>\n<\/ol>\n<ul>\n<li>bullet<\/li>\n<\/ul>/);
});

runTest('renders bold and italic inline formatting', () => {
  const html = renderResultDocument('**bold** and *italic*');
  assert.match(html, /<strong>bold<\/strong>/);
  assert.match(html, /<em>italic<\/em>/);
});

runTest('includes a restrictive Content-Security-Policy', () => {
  const html = renderResultDocument('hello');
  assert.match(html, /default-src 'none'/);
  assert.match(html, /Content-Security-Policy/);
});

runTest('applies the configured font size', () => {
  const html = renderResultDocument('hello', 20);
  assert.match(html, /font: 20px\/1\.55/);
});

runTest('falls back to the default font size for invalid values', () => {
  const html = renderResultDocument('hello', 0);
  assert.match(html, /font: 14px\/1\.55/);
});
