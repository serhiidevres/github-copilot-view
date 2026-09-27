const removableSectionNames = new Set([
  'thinking',
  'analysis',
  'reasoning',
  'progress',
  'tool calls',
]);

// Standalone lines VS Code Copilot Chat renders for tool invocations when a response is copied as plain text.
// Everything up to and including the last of these marks the end of the agent's "process" — only the
// content after it is the actual answer, so any narration sitting between tool calls is dropped too.
const toolCallLinePatterns: RegExp[] = [
  /^Updated\s+(\d+\s+todos?|todo list)$/i,
  /^Created\b.*$/i,
  /^Read\b.*$/i,
  /^Replacing\s+\d+\s+lines\s+with\s+\d+\s+lines\s+in\b.*$/i,
  /^Ran\s+(terminal command|task|\d+\s+terminal commands?)\b.*$/i,
  /^Checked\b.*(no problems found|background terminal output.*)$/i,
  /^Searched\s+(text|codebase|files?)\s+for\b.*$/i,
  /^Fetched\b.*$/i,
  /^Listed\b.*(items?|the contents of)\b.*$/i,
];

// Trailer lines that always get dropped wherever they land, without shifting the cutoff above.
const trailerLinePatterns: RegExp[] = [
  /^Completed:\s*\*.+\*\s*\(\d+\/\d+\)\.?$/i,
  /^Made changes\.$/i,
  /^Continue to iterate\?/i,
];

// Tool-call lines that also produce a diff-preview fence right after them.
const editToolLinePatterns: RegExp[] = [
  /^Created\b.*$/i,
  /^Read\b.*$/i,
  /^Replacing\s+\d+\s+lines\s+with\s+\d+\s+lines\s+in\b.*$/i,
];

export interface CopilotResult {
  markdown: string;
  removedSections: string[];
}

interface Heading {
  level: number;
  name: string;
}

interface Block {
  lines: string[];
  isFence: boolean;
}

export function formatCopiedResult(input: string): CopilotResult {
  const lines = input.replace(/\r\n?/g, '\n').split('\n');
  const output: string[] = [];
  const removedSections: string[] = [];
  let ignoredHeadingLevel: number | undefined;
  let inCodeFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inCodeFence = !inCodeFence;
    }

    const heading = inCodeFence ? undefined : parseHeading(line);

    if (ignoredHeadingLevel !== undefined) {
      if (heading && heading.level <= ignoredHeadingLevel) {
        ignoredHeadingLevel = undefined;
      } else {
        continue;
      }
    }

    if (heading && removableSectionNames.has(heading.name)) {
      ignoredHeadingLevel = heading.level;
      removedSections.push(heading.name);
      continue;
    }

    output.push(line);
  }

  const { markdown, removedNoise } = stripToolNarration(output.join('\n').trim());

  if (removedNoise) {
    removedSections.push('tool activity');
  }

  return {
    markdown,
    removedSections,
  };
}

function stripToolNarration(markdown: string): { markdown: string; removedNoise: boolean } {
  const blocks = splitIntoBlocks(markdown.length === 0 ? [] : markdown.split('\n'));
  const isBoundary: boolean[] = [];
  const isTrailer: boolean[] = [];
  let dropNextFence = false;

  blocks.forEach((block) => {
    if (block.isFence) {
      const fenceIsBoundary = dropNextFence || isEmptyFence(block);
      isBoundary.push(fenceIsBoundary);
      isTrailer.push(false);
      dropNextFence = false;
      return;
    }

    const singleLine = block.lines.length === 1 ? block.lines[0].trim() : undefined;
    const isToolCall = singleLine !== undefined && toolCallLinePatterns.some((pattern) => pattern.test(singleLine));
    const isTrailerLine = singleLine !== undefined && trailerLinePatterns.some((pattern) => pattern.test(singleLine));

    isBoundary.push(isToolCall);
    isTrailer.push(isTrailerLine);
    dropNextFence = isToolCall && editToolLinePatterns.some((pattern) => pattern.test(singleLine as string));
  });

  // The cutoff must anchor to the last *real* content block, not just the last tool-call line —
  // otherwise trailing housekeeping (e.g. a final "Updated todo list" after the answer) would be
  // mistaken for a new boundary and wipe out the actual answer sitting before it.
  let lastContentIndex = -1;
  for (let i = blocks.length - 1; i >= 0; i--) {
    if (!isBoundary[i] && !isTrailer[i]) {
      lastContentIndex = i;
      break;
    }
  }

  let cutoffIndex = -1;
  const searchStart = lastContentIndex === -1 ? blocks.length - 1 : lastContentIndex - 1;
  for (let i = searchStart; i >= 0; i--) {
    if (isBoundary[i]) {
      cutoffIndex = i;
      break;
    }
  }

  const kept = blocks.filter((_, index) => index > cutoffIndex && !isBoundary[index] && !isTrailer[index]);
  const removedNoise = cutoffIndex !== -1 || isBoundary.some(Boolean) || isTrailer.some(Boolean);

  return {
    markdown: kept.map((block) => block.lines.join('\n')).join('\n\n').trim(),
    removedNoise,
  };
}

function splitIntoBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    if (lines[i].trim().length === 0) {
      i++;
      continue;
    }

    const fenceMatch = /^\s*(```|~~~)/.exec(lines[i]);
    if (fenceMatch) {
      const marker = fenceMatch[1];
      const start = i;
      i++;
      while (i < lines.length && !new RegExp(`^\\s*${marker}`).test(lines[i])) {
        i++;
      }
      if (i < lines.length) {
        i++;
      }
      blocks.push({ lines: lines.slice(start, i), isFence: true });
      continue;
    }

    const start = i;
    while (i < lines.length && lines[i].trim().length > 0 && !/^\s*(```|~~~)/.test(lines[i])) {
      i++;
    }
    blocks.push({ lines: lines.slice(start, i), isFence: false });
  }

  return blocks;
}

function isEmptyFence(block: Block): boolean {
  return block.lines.slice(1, -1).every((line) => line.trim().length === 0);
}

function parseHeading(line: string): Heading | undefined {
  const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);

  if (!match) {
    return undefined;
  }

  return {
    level: match[1].length,
    name: match[2].trim().toLowerCase(),
  };
}