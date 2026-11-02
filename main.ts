import { Editor, Notice, Plugin } from 'obsidian';
import { cleanText, normalizeLineEndings } from './cleaner';
import { AiPasteCleanerSettings, AiPasteCleanerSettingTab, DEFAULT_SETTINGS } from './settings';

export default class AiPasteCleanerPlugin extends Plugin {
	settings: AiPasteCleanerSettings = { ...DEFAULT_SETTINGS };

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new AiPasteCleanerSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('editor-paste', (evt, editor) => this.handlePaste(evt, editor)));

		this.addCommand({
			id: 'clean-selection',
			name: 'Clean selection (or whole note)',
			editorCallback: (editor) => this.cleanSelectionOrNote(editor),
		});

		this.addCommand({
			id: 'paste-and-clean',
			name: 'Paste and clean',
			editorCallback: async (editor) => {
				const raw = await this.readClipboard();
				if (raw !== null) editor.replaceSelection(cleanText(raw, this.settings));
			},
		});

		this.addCommand({
			id: 'paste-without-cleaning',
			name: 'Paste without cleaning',
			editorCallback: async (editor) => {
				const raw = await this.readClipboard();
				if (raw !== null) editor.replaceSelection(raw);
			},
		});
	}

	private handlePaste(evt: ClipboardEvent, editor: Editor): void {
		if (!this.settings.cleanOnPaste || evt.defaultPrevented) return;
		const data = evt.clipboardData;
		// Leave file and image pastes to Obsidian.
		if (!data || data.files.length > 0) return;
		const raw = data.getData('text/plain');
		if (!raw) return;
		const cleaned = cleanText(raw, this.settings);
		// Nothing to fix: let Obsidian handle the paste normally.
		if (cleaned === normalizeLineEndings(raw)) return;
		evt.preventDefault();
		editor.replaceSelection(cleaned);
		if (this.settings.showNotice) new Notice('Pasted text cleaned');
	}

	private cleanSelectionOrNote(editor: Editor): void {
		const selection = editor.getSelection();
		if (selection) {
			editor.replaceSelection(cleanText(selection, this.settings));
			return;
		}
		const before = editor.getValue();
		const after = cleanText(before, this.settings);
		if (after === before) {
			new Notice('Nothing to clean');
			return;
		}
		const cursor = editor.getCursor();
		editor.setValue(after);
		editor.setCursor(Math.min(cursor.line, editor.lastLine()), cursor.ch);
	}

	private async readClipboard(): Promise<string | null> {
		try {
			return await navigator.clipboard.readText();
		} catch (error) {
			console.error('AI Paste Cleaner: could not read the clipboard', error);
			new Notice('Could not read the clipboard');
			return null;
		}
	}

	async loadSettings(): Promise<void> {
		this.settings = { ...DEFAULT_SETTINGS, ...((await this.loadData()) as Partial<AiPasteCleanerSettings> | null) };
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}
}
