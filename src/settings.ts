import { App, PluginSettingTab, Setting } from 'obsidian';
import { CleanOptions, DashMode, DEFAULT_CLEAN_OPTIONS } from './cleaner';
import type AiPasteCleanerPlugin from './main';

export interface AiPasteCleanerSettings extends CleanOptions {
	/** Clean text automatically when pasting into a note. */
	cleanOnPaste: boolean;
	/** Show a notice after a paste was cleaned. */
	showNotice: boolean;
}

export const DEFAULT_SETTINGS: AiPasteCleanerSettings = {
	...DEFAULT_CLEAN_OPTIONS,
	cleanOnPaste: true,
	showNotice: false,
};

type BooleanKey = {
	[K in keyof AiPasteCleanerSettings]: AiPasteCleanerSettings[K] extends boolean ? K : never;
}[keyof AiPasteCleanerSettings];

interface ToggleSpec {
	key: BooleanKey;
	name: string;
	desc: string;
}

const PASTE_TOGGLES: readonly ToggleSpec[] = [
	{ key: 'cleanOnPaste', name: 'Clean on paste', desc: 'Clean text automatically when you paste it into a note. Use the "Paste without cleaning" command to paste as-is.' },
	{ key: 'showNotice', name: 'Show a notice', desc: 'Show a short notice when a paste was cleaned.' },
];

const RULE_TOGGLES: readonly ToggleSpec[] = [
	{ key: 'fixLatex', name: 'Fix math delimiters', desc: 'Convert \\( \\) to $ $ and \\[ \\] to $$ $$ so Obsidian renders the math.' },
	{ key: 'stripCitations', name: 'Remove citation markers', desc: 'Remove [1], [1][2] and 【4:0†source】 markers. Markdown links and footnotes are kept.' },
	{ key: 'stripSourcesFooter', name: 'Remove sources footer', desc: 'Remove a trailing "Sources:" or "References:" list.' },
	{ key: 'normalizeLists', name: 'Normalize lists', desc: 'Turn •, ◦ and ▪ bullets into markdown lists and "1)" into "1.".' },
	{ key: 'fixCodeArtifacts', name: 'Remove copy-button text', desc: 'Remove leftover "Copy code" lines and the language label above them.' },
	{ key: 'tidyWhitespace', name: 'Tidy whitespace', desc: 'Remove invisible characters, trailing spaces and extra blank lines.' },
	{ key: 'straightQuotes', name: 'Straight quotes', desc: 'Convert curly quotes and apostrophes to straight ones.' },
];

const DASH_OPTIONS: Record<DashMode, string> = {
	keep: 'Keep em dashes',
	hyphen: 'Replace with " - "',
	comma: 'Replace with ", "',
};

export class AiPasteCleanerSettingTab extends PluginSettingTab {
	plugin: AiPasteCleanerPlugin;

	constructor(app: App, plugin: AiPasteCleanerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	private addToggle(spec: ToggleSpec): void {
		new Setting(this.containerEl)
			.setName(spec.name)
			.setDesc(spec.desc)
			.addToggle((toggle) =>
				toggle.setValue(this.plugin.settings[spec.key]).onChange(async (value) => {
					this.plugin.settings[spec.key] = value;
					await this.plugin.saveSettings();
				}),
			);
	}

	display(): void {
		this.containerEl.empty();

		new Setting(this.containerEl).setName('Pasting').setHeading();
		PASTE_TOGGLES.forEach((spec) => this.addToggle(spec));

		new Setting(this.containerEl).setName('Cleaning rules').setHeading();
		RULE_TOGGLES.forEach((spec) => this.addToggle(spec));

		new Setting(this.containerEl)
			.setName('Em dashes')
			.setDesc('What to do with em dashes in pasted text.')
			.addDropdown((dropdown) =>
				dropdown
					.addOptions(DASH_OPTIONS)
					.setValue(this.plugin.settings.dashMode)
					.onChange(async (value) => {
						this.plugin.settings.dashMode = value as DashMode;
						await this.plugin.saveSettings();
					}),
			);
	}
}
