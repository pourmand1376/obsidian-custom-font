import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

const my_css = `body {
	--font-default: 'test',
	--font-monospace-default: '',
	--font-interface-override: '',
	--font-text-override: '',
	--font-monospace-override: '',	
}`

const plugin_name = 'custom-font-loader'

interface FontPluginSettings {
	font: string;
	processed_font: string;
}

const DEFAULT_SETTINGS: FontPluginSettings = {
	font: "None",
	processed_font: "",
};

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function applyCss(css: string,css_id:string) {
	// Create style tag
	const style = document.createElement("style");

	// Add CSS content
	style.innerHTML = css;

	// Append style tag to head
	document.head.appendChild(style);

	// Optional: Remove existing custom CSS
	const existingStyle = document.getElementById(css_id);
	if (existingStyle) {
		existingStyle.remove();
	}

	// Give ID to new style tag
	style.id = css_id;
}

export default class FontPlugin extends Plugin {
	settings: FontPluginSettings;

	async onload() {
		await this.loadSettings();

		try {
			if (
				this.settings.font &&
				this.settings.font.toLowerCase() != "none"
			) {
				console.log('loading %s', this.settings.font)
				const font_family_name = this.settings.font.split('.')[0]
				// Check if converted font exists
				const path = `.obsidian/plugins/${plugin_name}/${this.settings.font}.css`

				if (this.settings.font == this.settings.processed_font && await this.app.vault.adapter.exists(path)) {
					const convertedCSS = await this.app.vault.adapter.read(
						path
					);
					console.log('css file %s loaded into memory', path)
					applyCss(convertedCSS,"custom-font-plugin-css");
					const cssString = `
					body {
						--font-default: '${font_family_name}';
						--font-family-editor: '${font_family_name}';
					}
					`;
					applyCss(cssString,'custom-font-apply')
				} else {
					new Notice("Processing Font files");
					const file = '.obsidian/fonts/' + this.settings.font
					const arrayBuffer = await this.app.vault.adapter.readBinary(file);

					// Convert to base64
					const base64 = arrayBufferToBase64(arrayBuffer);
					
					const base64_css = `
					@font-face{
						font-family: '${font_family_name}';
						src: url(base64, ${base64});
					}`
					this.app.vault.adapter.write(path,base64_css)
					console.log('saved font %s into %s',font_family_name,path)

					this.settings.processed_font = this.settings.font
					await this.saveSettings()
					new Notice('Processing Font Finished')
					
					await this.onload()
				}
			}
			else {
				applyCss('',"custom-font-plugin-css")
				applyCss('',"custom-font-apply")
			}
		} catch (error) {
			new Notice(error);
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FontSettingTab(this.app, this));
	}

	onunload() { }

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class FontSettingTab extends PluginSettingTab {
	plugin: FontPlugin;

	constructor(app: App, plugin: FontPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	async display() {
		const { containerEl } = this;

		containerEl.empty();

		const infoContainer = containerEl.createDiv();
		infoContainer.setText("In Order to set the font, copy your font into '.obsidian/fonts/' directory.");

		const options = [{ name: "Don't Change", value: "None" }];
		try {
			const font_folder_path = '.obsidian/fonts'
			if (await this.app.vault.adapter.exists(font_folder_path)) {
				const files = await this.app.vault.adapter.list(font_folder_path)

				// Add files as options
				for (const file of files.files) {
					const file_name = file.split('/')[2]
					options.push({ name: file_name, value: file_name });
				}
			}
			else {
				await this.app.vault.adapter.mkdir('.obsidian/fonts')
			}


		}
		catch (error) {
			console.log(error)
		}
		// Show combo box in UI somehow
		new Setting(containerEl)
			.setName("Font")
			.setDesc("Choose font")
			.addDropdown((dropdown) => {
				// Add options
				for (const opt of options) {
					dropdown.addOption(opt.name, opt.value);
				}
				dropdown
					.setValue(this.plugin.settings.font)
					.onChange(async (value) => {
						this.plugin.settings.font = value;
						await this.plugin.saveSettings();
						await this.plugin.onload()
					});
			});
	}
}
