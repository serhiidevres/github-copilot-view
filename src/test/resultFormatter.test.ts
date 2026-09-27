import assert from 'node:assert/strict';
import { formatCopiedResult } from '../resultFormatter';

function runTest(name: string, test: () => void): void {
  try {
    test();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

runTest('preserves regular Markdown', () => {
  const result = formatCopiedResult('# Result\n\nUse **this** solution.');
  assert.equal(result.markdown, '# Result\n\nUse **this** solution.');
  assert.deepEqual(result.removedSections, []);
});

runTest('removes a recognized reasoning section', () => {
  const result = formatCopiedResult('# Thinking\nInternal detail\n\n# Result\nFinal answer');
  assert.equal(result.markdown, '# Result\nFinal answer');
  assert.deepEqual(result.removedSections, ['thinking']);
});

runTest('keeps analysis inside a code fence', () => {
  const result = formatCopiedResult('```text\n# Analysis\nkeep this\n```\n\n# Result\nFinal answer');
  assert.equal(result.markdown, '```text\n# Analysis\nkeep this\n```\n\n# Result\nFinal answer');
});

runTest('normalizes Windows line endings', () => {
  const result = formatCopiedResult('# Result\r\n\r\nFinal answer\r\n');
  assert.equal(result.markdown, '# Result\n\nFinal answer');
});

runTest('does not remove unrecognized headings', () => {
  const result = formatCopiedResult('# Approach\nUseful explanation');
  assert.equal(result.markdown, '# Approach\nUseful explanation');
});

runTest('strips tool-call narration from a copied chat transcript', () => {
  const input = [
    'Updated todo list',
    '',
    'Read , lines 1 to 55',
    '',
    'Replacing 40 lines with 43 lines in ',
    '',
    '',
    '```',
    '',
    '```',
    'Now the activity bar icon and the tree data provider: ',
    '',
    'Created ',
    '',
    ' ',
    '',
    'Created ',
    '',
    'Now update `extension.ts`: ',
    '',
    'Replacing 56 lines with 65 lines in ',
    '',
    '',
    '```',
    '',
    '```',
    'Now delete the unused webview preview file and update the README: ',
    '',
    'Replacing 12 lines with 14 lines in ',
    '',
    '',
    '```',
    '',
    '```',
    "Now let's verify compile/type-check and tests pass: ",
    '',
    'Ran terminal command: npm run check-types; npm test',
    '',
    'Checked , , , no problems found',
    '',
    "Type-check, tests, and lint all pass. Let's run the compile task to confirm the esbuild bundle builds cleanly too: ",
    '',
    'Ran terminal command: npm run compile',
    '',
    'Build succeeds. Summary of the implementation:',
    '',
    '- **`README.md`**: workflow section updated to describe the sidebar.',
    '',
    'Type-check, existing tests, and the esbuild bundle all pass. Press F5 to try it in an Extension Development Host.',
    '',
    'Completed: *Add functionality* (1/9)',
    '',
    'Made changes.',
  ].join('\n');

  const expected = [
    'Build succeeds. Summary of the implementation:',
    '',
    '- **`README.md`**: workflow section updated to describe the sidebar.',
    '',
    'Type-check, existing tests, and the esbuild bundle all pass. Press F5 to try it in an Extension Development Host.',
  ].join('\n');

  const result = formatCopiedResult(input);
  assert.equal(result.markdown, expected);
});

runTest('drops a lone Created tool-call line', () => {
  const result = formatCopiedResult('Created \n\nFinal answer text.');
  assert.equal(result.markdown, 'Final answer text.');
});

runTest('drops a Replacing line and its diff-preview fence', () => {
  const result = formatCopiedResult('Replacing 5 lines with 6 lines in foo.ts\n\n```\n\n```\n\nFinal answer text.');
  assert.equal(result.markdown, 'Final answer text.');
});

runTest('drops trailing Completed and Made changes markers', () => {
  const result = formatCopiedResult('Final answer text.\n\nCompleted: *Some task* (2/5)\n\nMade changes.');
  assert.equal(result.markdown, 'Final answer text.');
});

runTest('keeps a lead-in line followed by real content', () => {
  const result = formatCopiedResult('Summary of changes:\n\n- item one\n- item two');
  assert.equal(result.markdown, 'Summary of changes:\n\n- item one\n- item two');
});

runTest('drops a lead-in line followed by a tool call', () => {
  const result = formatCopiedResult('Now updating the config:\n\nRan terminal command: npm run build\n\nFinal answer text.');
  assert.equal(result.markdown, 'Final answer text.');
});

runTest('drops narration sentences and bare Read lines interleaved between tool calls', () => {
  const input = [
    'Read ',
    '',
    'Now implementing the second pass per the plan. ',
    '',
    "Now let's add tests for the new behavior. ",
    '',
    'Read ',
    '',
    "Now let's run the type-check and tests. ",
    '',
    'Ran terminal command: npm run check-types; npm test',
    '',
    "All tests pass, including the full transcript case matching the exact expected output. Let's also run the compile task to confirm the esbuild bundle builds cleanly. ",
    '',
    'Ran terminal command: npm run compile',
    '',
    'Build succeeds. Summary of the implementation:',
    '',
    '- item one',
    '- item two',
    '',
    'Type-check, all 11 tests, and the esbuild bundle all pass.',
  ].join('\n');

  const expected = [
    'Build succeeds. Summary of the implementation:',
    '',
    '- item one',
    '- item two',
    '',
    'Type-check, all 11 tests, and the esbuild bundle all pass.',
  ].join('\n');

  const result = formatCopiedResult(input);
  assert.equal(result.markdown, expected);
});

runTest('keeps the real answer when a trailing housekeeping tool call follows it', () => {
  const input = [
    'Updated todo list',
    '',
    'Read , lines 1 to 120',
    '',
    'Now replacing the noise patterns with the cutoff-based algorithm. ',
    '',
    'Replacing 22 lines with 28 lines in ',
    '',
    '```',
    '',
    '```',
    '',
    'Checked , no problems found',
    '',
    'Ran terminal command: npm test',
    '',
    "All tests pass. Let's run the compile task to confirm the bundle still builds. ",
    '',
    'Ran terminal command: npm run compile',
    '',
    'Reworked the algorithm: it now anchors the cutoff to the last real content block.',
    '',
    'All tests pass, and both check-types and compile succeed.',
    '',
    'Updated todo list',
    '',
    'Made changes.',
  ].join('\n');

  const expected = [
    'Reworked the algorithm: it now anchors the cutoff to the last real content block.',
    '',
    'All tests pass, and both check-types and compile succeed.',
  ].join('\n');

  const result = formatCopiedResult(input);
  assert.equal(result.markdown, expected);
});