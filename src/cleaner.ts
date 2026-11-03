// Pure text cleaning for markdown copied from AI chat tools.
// No Obsidian imports, so it can be unit tested in Node.

export type DashMode = 'keep' | 'hyphen' | 'comma';

export interface CleanOptions {
	/** Convert \( \) to $ $ and \[ \] to $$ $$. */
	fixLatex: boolean;
	/** Remove [1], [1][2], [1, 3] and 【4:0†source】 style citation markers. */
	stripCitations: boolean;
	/** Remove a trailing "Sources:" / "References:" / "Citations:" block. */
	stripSourcesFooter: boolean;
	/** Turn •, ◦, ▪, ‣, ∙ bullets into "- " and "1)" into "1.". */
	normalizeLists: boolean;
	/** Remove "Copy code" / "Copy" lines and the language label left above them by chat UIs. */
	fixCodeArtifacts: boolean;
	/** Remove zero-width characters, convert non-breaking spaces, trim trailing spaces, collapse blank lines. */
	tidyWhitespace: boolean;
	/** How to replace em dashes. */
	dashMode: DashMode;
	/** Convert curly quotes and apostrophes to straight ones. */
	straightQuotes: boolean;
}

export const DEFAULT_CLEAN_OPTIONS: CleanOptions = {
	fixLatex: true,
	stripCitations: true,
	stripSourcesFooter: false,
	normalizeLists: true,
	fixCodeArtifacts: true,
	tidyWhitespace: true,
	dashMode: 'keep',
	straightQuotes: false,
};

const CODE_LANGS = new Set([
	'bash', 'sh', 'shell', 'zsh', 'powershell', 'ps1', 'cmd', 'bat',
	'python', 'py', 'javascript', 'js', 'typescript', 'ts', 'jsx', 'tsx',
	'json', 'yaml', 'yml', 'toml', 'ini', 'xml', 'html', 'css', 'scss',
	'sql', 'go', 'rust', 'java', 'kotlin', 'swift', 'c', 'cpp', 'c++', 'csharp', 'c#',
	'php', 'ruby', 'r', 'lua', 'dart', 'scala', 'perl', 'markdown', 'md',
	'dockerfile', 'makefile', 'graphql', 'diff', 'plaintext', 'text', 'latex', 'tex',
]);

const DASH_REPLACEMENT: Record<Exclude<DashMode, 'keep'>, string> = {
	hyphen: ' - ',
	comma: ', ',
};

// A fenced code block (``` or ~~~), or an unclosed fence running to the end.
// Matches "```js\nlet a = 1;\n```", rejects "plain text".
// Try it: https://regex101.com/?regex=%5E(%5B%20%5Ct%5D*)(%60%7B3%2C%7D%7C~%7B3%2C%7D)%5B%5E%5Cn%5D*%5Cn%5B%5Cs%5CS%5D*%3F(%3F%3A%5E%5C1%5C2%5B%20%5Ct%5D*%24%7C(%3F!%5B%5Cs%5CS%5D))&flags=gm&testString=%60%60%60js%0Alet%20a%20%3D%201%3B%0A%60%60%60
const FENCED_CODE = /^([ \t]*)(`{3,}|~{3,})[^\n]*\n[\s\S]*?(?:^\1\2[ \t]*$|(?![\s\S]))/gm;

// An inline code span.
// Matches "`npm run build`", rejects "no backticks here".
// Try it: https://regex101.com/?regex=(%60%2B)(%3F!%60)%5B%5E%5Cn%5D*%3F%5B%5E%60%5D%5C1(%3F!%60)%7C(%60%2B)%5B%5E%60%5Cn%5D%5C2(%3F!%60)&flags=g&testString=%60npm%20run%20build%60
const INLINE_CODE = /(`+)(?!`)[^\n]*?[^`]\1(?!`)|(`+)[^`\n]\2(?!`)/g;

// A protected-code placeholder this module inserts.
// Matches "\u0000AIPC3\u0000", rejects "AIPC3".
// Try it: https://regex101.com/?regex=%5Cu0000AIPC(%5Cd%2B)%5Cu0000&flags=g&testString=%5Cu0000AIPC3%5Cu0000
const PLACEHOLDER_TOKEN = /\u0000AIPC(\d+)\u0000/g;

// Display math written as \[ ... \], possibly across lines.
// Matches "\\[ E = mc^2 \\]", rejects "[1]".
// Try it: https://regex101.com/?regex=%5C%5C%5C%5B(%5B%5Cs%5CS%5D%2B%3F)%5C%5C%5C%5D&flags=g&testString=%5C%5C%5B%20E%20%3D%20mc%5E2%20%5C%5C%5D
const DISPLAY_MATH = /\\\[([\s\S]+?)\\\]/g;

// Inline math written as \( ... \) on one line.
// Matches "\\( x^2 \\)", rejects "(x^2)".
// Try it: https://regex101.com/?regex=%5C%5C%5C((%5B%5E%5Cn%5D%2B%3F)%5C%5C%5C)&flags=g&testString=%5C%5C(%20x%5E2%20%5C%5C)
const INLINE_MATH = /\\\(([^\n]+?)\\\)/g;

// A ChatGPT file-search citation.
// Matches " 【4:0†source】", rejects "[4]".
// Try it: https://regex101.com/?regex=%5B%20%5Ct%5D*%E3%80%90%5B%5E%E3%80%91%5Cn%5D*%E3%80%91&flags=g&testString=%20%E3%80%904%3A0%E2%80%A0source%E3%80%91
const FILE_CITATION = /[ \t]*【[^】\n]*】/g;

// Numeric citations like [1], [1, 2], [1-3] or [1][2]; not links, footnote refs or reference definitions.
// Matches "fast [1][2].", rejects "[1](https://x.com) or [1]: https://x.com".
// Try it: https://regex101.com/?regex=%5B%20%5Ct%5D*(%3F%3A%5C%5B%5Cd%7B1%2C3%7D(%3F%3A%5Cs*%5B%2C%E2%80%93-%5D%5Cs*%5Cd%7B1%2C3%7D)*%5C%5D)%2B(%3F!%5B(%5C%5B%3A%5D)&flags=g&testString=fast%20%5B1%5D%5B2%5D.
const NUMERIC_CITATION = /[ \t]*(?:\[\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\])+(?![([:])/g;

// A trailing Sources/References/Citations block made only of list items, links or blank lines.
// Matches "\n\nSources:\n- https://a.com", rejects "\n\nSources: see the docs, then continue writing".
// Try it: https://regex101.com/?regex=%5Cn%2B(%3F%3A%23%7B1%2C6%7D%5B%20%5Ct%5D*)%3F(%3F%3A%5C*%5C*)%3F(%3F%3ASources%7CReferences%7CCitations%7CFurther%20reading)(%3F%3A%5C*%5C*)%3F%3A%3F(%3F%3A%5C*%5C*)%3F%5B%20%5Ct%5D*%5Cn(%3F%3A%5B%20%5Ct%5D*(%3F%3A%5B-*%2B%5D%7C%5Cd%2B%5B.)%5D%7C%5C%5B%5Cd%2B%5C%5D)%5B%5E%5Cn%5D*%5Cn%3F%7C%5B%20%5Ct%5D*https%3F%3A%5C%2F%5C%2F%5B%5E%5Cn%5D*%5Cn%3F%7C%5B%20%5Ct%5D*%5Cn)*%24&flags=i&testString=%0A%0ASources%3A%0A-%20https%3A%2F%2Fa.com
const SOURCES_FOOTER = /\n+(?:#{1,6}[ \t]*)?(?:\*\*)?(?:Sources|References|Citations|Further reading)(?:\*\*)?:?(?:\*\*)?[ \t]*\n(?:[ \t]*(?:[-*+]|\d+[.)]|\[\d+\])[^\n]*\n?|[ \t]*https?:\/\/[^\n]*\n?|[ \t]*\n)*$/i;

// A line starting with a Unicode bullet.
// Matches "  • item", rejects "- item".
// Try it: https://regex101.com/?regex=%5E(%5B%20%5Ct%5D*)%5B%E2%80%A2%E2%97%A6%E2%96%AA%E2%96%AB%E2%80%A3%E2%88%99%E2%97%8F%E2%97%8B%E2%96%A0%E2%96%A1%E2%9E%A4%E2%96%BA%E2%80%93%5D%5B%20%5Ct%5D%2B&flags=&testString=%20%20%E2%80%A2%20item
const UNICODE_BULLET = /^([ \t]*)[•◦▪▫‣∙●○■□➤►–][ \t]+/;

// A numbered item written as "1)".
// Matches "1) first", rejects "1. first".
// Try it: https://regex101.com/?regex=%5E(%5B%20%5Ct%5D*)(%5Cd%7B1%2C3%7D)%5C)%5B%20%5Ct%5D%2B&flags=&testString=1)%20first
const PAREN_NUMBER = /^([ \t]*)(\d{1,3})\)[ \t]+/;

// A chat UI button label left on its own line.
// Matches "Copy code", rejects "Copy this file".
// Try it: https://regex101.com/?regex=%5E(copy%20code%7Ccopy%7Ccopied!%3F%7Cedit%7Crun)%24&flags=i&testString=Copy%20code
const COPY_BUTTON_LABEL = /^(copy code|copy|copied!?|edit|run)$/i;

// Zero-width characters.
// Matches "a\u200Bb", rejects "ab".
// Try it: https://regex101.com/?regex=%5B%E2%80%8B-%E2%80%8D%E2%81%A0%EF%BB%BF%5D&flags=g&testString=a%5Cu200Bb
const ZERO_WIDTH = /[\u200B-\u200D\u2060\uFEFF]/g;

// Non-breaking spaces.
// Matches "a\u00A0b", rejects "a b".
// Try it: https://regex101.com/?regex=%5B%C2%A0%E2%80%AF%5D&flags=g&testString=a%5Cu00A0b
const NBSP = /[\u00A0\u202F]/g;

// A line ending in exactly two spaces (markdown hard break).
// Matches "line␣␣", rejects "line␣␣␣".
// Try it: https://regex101.com/?regex=%5B%5E%20%5D%20%7B2%7D%24&flags=&testString=line%E2%90%A3%E2%90%A3
const HARD_BREAK_END = /[^ ] {2}$/;

// Trailing spaces or tabs.
// Matches "text␣", rejects "text".
// Try it: https://regex101.com/?regex=%5B%20%5Ct%5D%2B%24&flags=&testString=text%E2%90%A3
const TRAILING_SPACE = /[ \t]+$/;

// Three or more newlines (two or more blank lines).
// Matches "\n\n\n", rejects "\n\n".
// Try it: https://regex101.com/?regex=%5Cn%7B3%2C%7D&flags=g&testString=%0A%0A%0A
const EXTRA_BLANK_LINES = /\n{3,}/g;

// An em dash with any surrounding spaces.
// Matches "word — word", rejects "word - word".
// Try it: https://regex101.com/?regex=%5B%20%5Ct%5D*%E2%80%94%5B%20%5Ct%5D*&flags=g&testString=word%20%E2%80%94%20word
const EM_DASH = /[ \t]*—[ \t]*/g;

// Curly single quotes and apostrophes.
// Matches "don’t", rejects "don't".
// Try it: https://regex101.com/?regex=%5B%E2%80%98%E2%80%99%E2%80%9A%E2%80%B2%5D&flags=g&testString=don%E2%80%99t
const CURLY_SINGLE = /[‘’‚′]/g;

// Curly double quotes.
// Matches "“hi”", rejects ""hi"".
// Try it: https://regex101.com/?regex=%5B%E2%80%9C%E2%80%9D%E2%80%9E%E2%80%B3%5D&flags=g&testString=%E2%80%9Chi%E2%80%9D
const CURLY_DOUBLE = /[“”„″]/g;

// Windows or old Mac line endings.
// Matches "\r\n", rejects "\n".
// Try it: https://regex101.com/?regex=%5Cr%5Cn%3F&flags=g&testString=%5Cr%0A
const LINE_ENDING = /\r\n?/g;

const placeholderFor = (i: number): string => `\u0000AIPC${i}\u0000`;

/**
 * Swap fenced code blocks and inline code for placeholders so no rule touches them.
 * Returns the masked text and the protected segments, in placeholder order.
 */
function protectCode(text: string): { masked: string; saved: string[] } {
	const saved: string[] = [];
	const stash = (s: string): string => placeholderFor(saved.push(s) - 1);
	const masked = text.replace(FENCED_CODE, stash).replace(INLINE_CODE, stash);
	return { masked, saved };
}

function restoreCode(text: string, saved: readonly string[]): string {
	return text.replace(PLACEHOLDER_TOKEN, (_m, i: string) => saved[Number(i)] ?? '');
}

const mapLines = (text: string, fn: (line: string) => string): string => text.split('\n').map(fn).join('\n');

function fixLatex(text: string): string {
	return text
		.replace(DISPLAY_MATH, (_m, body: string) => `$$\n${body.trim()}\n$$`)
		.replace(INLINE_MATH, (_m, body: string) => `$${body.trim()}$`);
}

function stripCitations(text: string): string {
	return text.replace(FILE_CITATION, '').replace(NUMERIC_CITATION, '');
}

function stripSourcesFooter(text: string): string {
	return text.replace(SOURCES_FOOTER, '\n');
}

function normalizeLists(text: string): string {
	return mapLines(text, (line) => line.replace(UNICODE_BULLET, '$1- ').replace(PAREN_NUMBER, '$1$2. '));
}

/** Drop chat UI button lines ("Copy code") and a code-language label directly above one. */
function fixCodeArtifacts(text: string): string {
	const kept = text.split('\n').reduce<string[]>((acc, line) => {
		if (!COPY_BUTTON_LABEL.test(line.trim())) return [...acc, line];
		const prev = acc.length ? acc[acc.length - 1].trim().toLowerCase() : '';
		return CODE_LANGS.has(prev) ? acc.slice(0, -1) : acc;
	}, []);
	return kept.join('\n');
}

function tidyWhitespace(text: string): string {
	const spaced = text.replace(ZERO_WIDTH, '').replace(NBSP, ' ');
	const trimmed = mapLines(spaced, (line) => (HARD_BREAK_END.test(line) ? line : line.replace(TRAILING_SPACE, '')));
	return trimmed.replace(EXTRA_BLANK_LINES, '\n\n');
}

function replaceDashes(text: string, mode: DashMode): string {
	return mode === 'keep' ? text : text.replace(EM_DASH, DASH_REPLACEMENT[mode]);
}

function straightenQuotes(text: string): string {
	return text.replace(CURLY_SINGLE, "'").replace(CURLY_DOUBLE, '"');
}

/** Convert Windows and old Mac line endings to "\n". */
export const normalizeLineEndings = (text: string): string => text.replace(LINE_ENDING, '\n');

/** Clean markdown copied from an AI chat. Code blocks and inline code are never modified. */
export function cleanText(input: string, options: CleanOptions = DEFAULT_CLEAN_OPTIONS): string {
	const normalized = normalizeLineEndings(input);
	// Chat UI artifacts sit next to code blocks, so remove them before masking code.
	const preMasked = options.fixCodeArtifacts ? fixCodeArtifacts(normalized) : normalized;
	const { masked, saved } = protectCode(preMasked);
	const steps: Array<[boolean, (t: string) => string]> = [
		[options.fixLatex, fixLatex],
		[options.stripCitations, stripCitations],
		[options.stripSourcesFooter, stripSourcesFooter],
		[options.normalizeLists, normalizeLists],
		[options.dashMode !== 'keep', (t) => replaceDashes(t, options.dashMode)],
		[options.straightQuotes, straightenQuotes],
		[options.tidyWhitespace, tidyWhitespace],
	];
	const cleaned = steps.reduce((t, [enabled, fn]) => (enabled ? fn(t) : t), masked);
	return restoreCode(cleaned, saved);
}
