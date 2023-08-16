import {
	App,
	Editor,
	MarkdownView,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

// Remember to rename these classes and interfaces!

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

function applyCss(css: string) {
	// Create style tag
	const style = document.createElement("style");

	// Add CSS content
	style.innerHTML = css;

	// Append style tag to head
	document.head.appendChild(style);

	// Optional: Remove existing custom CSS
	const existingStyle = document.getElementById("custom-font-plugin-css");
	if (existingStyle) {
		existingStyle.remove();
	}

	// Give ID to new style tag
	style.id = "custom-font-plugin-css";
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

				// Check if converted.css exists
				const path =
					".obsidian/plugins/obsidian-custom-font/converted.css";

				if (this.settings.font == this.settings.processed_font && await this.app.vault.adapter.exists(path)) {
					const convertedCSS = await this.app.vault.adapter.read(
						path
					);
					console.log('css file %s loaded into memory', path)
					applyCss(convertedCSS);
				} else {
					new Notice("Processing Font files");
					const file = '.obsidian/fonts/' + this.settings.font
					const arrayBuffer = await this.app.vault.adapter.readBinary(file);

					// Convert to base64
					const base64 = arrayBufferToBase64(arrayBuffer);
					const font_name = this.settings.font.replace('.woff', '')
					const cssString = `
  @font-face {
    font-family: '${font_name}';
    src: url(data:font/woff;base64,${base64})
  }
  :root {
	--default-font: ${font_name};
	--font-family-editor: ${font_name};
  }
`;
					this.app.vault.adapter.write(path, cssString)
					this.settings.processed_font = this.settings.font
					await this.saveSettings()
					new Notice('Processing Font Finished')
					await this.onload()
				}
			}
			else{ 
				applyCss('')
			}
		} catch (error) {
			new Notice(error);
		}

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new FontSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000)
		);
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

		const options = [{ name: "none", value: "None" }];
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
			else{
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
