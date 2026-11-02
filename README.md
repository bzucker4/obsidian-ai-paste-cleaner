# AI Paste Cleaner

Paste from ChatGPT, Claude, Gemini or Grok into Obsidian and get clean markdown, automatically.

## What it fixes

- **Math delimiters:** `\( x \)` becomes `$x$` and `\[ ... \]` becomes a `$$` block, so Obsidian renders it.
- **Citation markers:** removes `[1]`, `[1][2]`, `[1, 3]` and `【4:0†source】`. Markdown links, footnotes (`[^1]`) and reference definitions are kept.
- **Copy-button text:** removes leftover `Copy code` lines and the language label above them.
- **Lists:** turns `•`, `◦` and `▪` bullets into markdown lists and `1)` into `1.`.
- **Whitespace:** removes invisible zero-width characters, converts non-breaking spaces, trims trailing spaces (keeping two-space line breaks) and collapses extra blank lines.
- **Optional:** remove a trailing "Sources:" list, replace em dashes, straighten curly quotes.

Code blocks and inline code are never changed.

## Usage

With **Clean on paste** on (the default), just paste. If the text has nothing to fix, Obsidian pastes it normally.

Commands:

- **Clean selection (or whole note)**
- **Paste and clean** (for when Clean on paste is off)
- **Paste without cleaning**

Every rule can be turned on or off in Settings → AI Paste Cleaner.

## Installation

### Manual

Copy `main.js` and `manifest.json` into `<your vault>/.obsidian/plugins/ai-paste-cleaner/`, then enable the plugin in Settings → Community plugins.

### Development

```bash
npm install
npm test        # unit tests for the cleaning rules
npm run build   # type-check and build main.js
```

## Privacy

Everything runs locally. The plugin makes no network requests.

## License

0BSD
