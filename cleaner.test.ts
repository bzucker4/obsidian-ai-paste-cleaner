import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, CleanOptions, DEFAULT_CLEAN_OPTIONS } from '../src/cleaner';

const clean = (input: string, overrides: Partial<CleanOptions> = {}): string =>
	cleanText(input, { ...DEFAULT_CLEAN_OPTIONS, ...overrides });

test('inline math \\( \\) becomes $ $', () => {
	assert.equal(clean('Energy is \\( E = mc^2 \\) here.'), 'Energy is $E = mc^2$ here.');
});

test('display math \\[ \\] becomes a $$ block', () => {
	assert.equal(clean('Formula:\n\\[\n a^2 + b^2 = c^2\n\\]\nDone.'), 'Formula:\n$$\na^2 + b^2 = c^2\n$$\nDone.');
});

test('numeric citations are removed, including chained and ranged ones', () => {
	assert.equal(clean('Paris is the capital [1][2]. It is large [3, 4]. Old [5-7].'), 'Paris is the capital. It is large. Old.');
});

test('ChatGPT file citations are removed', () => {
	assert.equal(clean('See the report 【4:0†source】.'), 'See the report.');
});

test('markdown links, footnote refs and reference definitions are kept', () => {
	const input = 'A [1](https://a.com) link, a footnote[^1], and a ref [2][ref].\n\n[1]: https://b.com';
	assert.equal(clean(input), input);
});

test('Unicode bullets and "1)" become markdown lists, keeping indentation', () => {
	assert.equal(clean('• one\n  ◦ nested\n1) first\n2) second'), '- one\n  - nested\n1. first\n2. second');
});

test('"Copy code" and the language label above it are removed', () => {
	const input = 'Run this:\n\npython\nCopy code\nprint("hi")';
	assert.equal(clean(input), 'Run this:\n\nprint("hi")');
});

test('a "Copy" line after normal prose keeps the prose', () => {
	assert.equal(clean('Keep this line\nCopy\nNext'), 'Keep this line\nNext');
});

test('fenced code blocks are never modified', () => {
	const input = '```js\nconst a = arr[1];   \nconst m = "\\\\(x\\\\)";\n• not a bullet\n\n\n\nend\n```';
	assert.equal(clean(input), input);
});

test('an unclosed fence protects everything after it', () => {
	const input = 'Text\n```\nraw [1] • x';
	assert.equal(clean(input), input);
});

test('inline code is never modified', () => {
	assert.equal(clean('Use `arr[1]` and `\\(x\\)` here [2].'), 'Use `arr[1]` and `\\(x\\)` here.');
});

test('whitespace: zero-width chars, nbsp, trailing spaces, blank lines', () => {
	assert.equal(clean('a​b c   \n\n\n\nd'), 'ab c\n\nd');
});

test('two trailing spaces (markdown hard break) are kept', () => {
	assert.equal(clean('line one  \nline two'), 'line one  \nline two');
});

test('CRLF line endings become LF', () => {
	assert.equal(clean('a\r\nb\rc'), 'a\nb\nc');
});

test('em dashes are kept by default', () => {
	assert.equal(clean('fast — and cheap'), 'fast — and cheap');
});

test('em dash modes: hyphen and comma', () => {
	assert.equal(clean('fast — and cheap', { dashMode: 'hyphen' }), 'fast - and cheap');
	assert.equal(clean('fast—and cheap', { dashMode: 'comma' }), 'fast, and cheap');
});

test('straight quotes option', () => {
	assert.equal(clean('“Don’t” go', { straightQuotes: true }), '"Don\'t" go');
	assert.equal(clean('“Don’t” go'), '“Don’t” go');
});

test('sources footer removed only when enabled', () => {
	const input = 'Answer text.\n\nSources:\n- https://a.com\n- https://b.com\n';
	assert.equal(clean(input, { stripSourcesFooter: true }), 'Answer text.\n');
	assert.equal(clean(input), input);
});

test('a "Sources" mention followed by prose is not treated as a footer', () => {
	const input = 'Intro.\n\nSources:\nI read three books and they disagreed.';
	assert.equal(clean(input, { stripSourcesFooter: true }), input);
});

test('every rule off leaves text unchanged apart from line endings', () => {
	const off: CleanOptions = {
		fixLatex: false, stripCitations: false, stripSourcesFooter: false, normalizeLists: false,
		fixCodeArtifacts: false, tidyWhitespace: false, dashMode: 'keep', straightQuotes: false,
	};
	const input = '• x [1] \\(y\\) — “z”   \n\n\n\nCopy code';
	assert.equal(cleanText(input, off), input);
});

test('already clean markdown is unchanged', () => {
	const input = '# Title\n\nSome **bold** text with $x$ math.\n\n- item one\n- item two\n';
	assert.equal(clean(input), input);
});
