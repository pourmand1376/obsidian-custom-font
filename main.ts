import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";



interface FontPluginSettings {
	font: string;
	processed_font: string;
	force_mode: boolean;
	custom_css_mode: boolean;
	custom_css: string;
}

const DEFAULT_SETTINGS: FontPluginSettings = {
	font: "None",
	processed_font: "",
	force_mode: false,
	custom_css_mode: false,
	custom_css: "",
};

function get_default_css(font_family_name: string) {
	return `:root {
		--font-default: ${font_family_name};
		--default-font: ${font_family_name};
		--font-family-editor: ${font_family_name};
		--font-monospace-default: ${font_family_name},
		--font-interface-override: ${font_family_name},
		--font-text-override: ${font_family_name},
		--font-monospace-override: ${font_family_name},	
	}
	`;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function applyCss(css: string, css_id: string) {
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
	config_dir: string =  this.app.vault.configDir;
	plugin_folder_path: string = `${this.config_dir}/plugins/custom-font-loader`
	
	async process_font() {
		await this.loadSettings()
		try {
			if (
				this.settings.font &&
				this.settings.font.toLowerCase() != "none"
			) {
				console.log('loading %s', this.settings.font)
				const font_family_name: string = this.settings.font.split('.')[0]
				const font_extension_name: string = this.settings.font.split('.')[1]

				const css_font_path = `${this.plugin_folder_path}/${this.settings.font.toLowerCase().replace('.', '_')}.css`

				if (this.settings.font != this.settings.processed_font || !await this.app.vault.adapter.exists(css_font_path)) {
					new Notice("Processing Font files");
					const file = `${this.config_dir}/fonts/${this.settings.font}`
					const arrayBuffer = await this.app.vault.adapter.readBinary(file);

					// Convert to base64
					const base64 = arrayBufferToBase64(arrayBuffer);
					const css_type_font: { [key: string]: string } = {
						'woff': 'font/woff',
						'ttf': 'font/truetype',
						'woff2': 'font/woff2'
					};

					const base64_css = `@font-face{
	font-family: '${font_family_name}';
	src: url(data:${css_type_font[font_extension_name]};base64,${base64});
}`
					this.app.vault.adapter.write(css_font_path, base64_css)
					console.log('saved font %s into %s', font_family_name, css_font_path)

					this.settings.processed_font = this.settings.font
					await this.saveSettings()
					console.log('Font CSS Saved into %s', css_font_path)
					await this.process_font()
				}
				else {
					const content = await this.app.vault.adapter.read(css_font_path)
					let css_string = ""
					if (this.settings.custom_css_mode) {
						css_string = this.settings.custom_css
					}
					else {
						css_string = get_default_css(font_family_name)
					}
					if (this.settings.force_mode)
						css_string = css_string + `
					* {
						font-family: ${font_family_name} !important;
					}
						`
					applyCss(content, 'custom_font_base64')
					applyCss(css_string, 'custom_font_general')
				}
			} else {
				applyCss('', 'custom_font_base64')
				applyCss('', 'custom_font_general')
			}


		} catch (error) {
			new Notice(error);
		}

	}

	async onload() {
		this.process_font()
		// This adds a settings tab so the user can configure various aspects of the plugin

		this.addSettingTab(new FontSettingTab(this.app, this));
	}

	async onunload() {
		applyCss('', 'custom_font_base64')
		applyCss('', 'custom_font_general')
	}

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
			const font_folder_path = `${this.app.vault.configDir}/fonts`
			if (!await this.app.vault.adapter.exists(font_folder_path)) {
				await this.app.vault.adapter.mkdir(font_folder_path)
			}
			if (await this.app.vault.adapter.exists(font_folder_path)) {
				const files = await this.app.vault.adapter.list(font_folder_path)

				// Add files as options
				for (const file of files.files) {
					const file_name = file.split('/')[2]
					options.push({ name: file_name, value: file_name });
				}
			}
			options.push({name: "All fonts", value:"all"})

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
						this.plugin.settings.font = value
						await this.plugin.saveSettings()
						await this.plugin.process_font()
					});
			});
		new Setting(containerEl)
			.setName("Force Style")
			.setDesc("This option should only be used if you have installed a community theme and normal mode doesn't work")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.force_mode)
				toggle.onChange(async (value) => {
					this.plugin.settings.force_mode = value
					await this.plugin.saveSettings();
					await this.plugin.process_font()
				})
			})
		new Setting(containerEl)
			.setName("Custom CSS Mode")
			.setDesc("If you want to apply a custom css style rather than default style, choose this.")
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.custom_css_mode)
				toggle.onChange(async (value) => {
					if (this.plugin.settings.custom_css_mode == false) {
						this.plugin.settings.custom_css = ""
					}
					this.plugin.settings.custom_css_mode = value
					this.plugin.saveSettings()
					this.plugin.process_font()
					this.display()
				})
			})
		if (this.plugin.settings.custom_css_mode) {
			new Setting(containerEl)
				.setName("Custom CSS Style")
				.setDesc("Input your custom css style")
				.addTextArea((text) => {
					text.onChange(async (new_value) => {
						this.plugin.settings.custom_css = new_value
						await this.plugin.saveSettings();
						await this.plugin.process_font()
					}
					)
					text.setDisabled(!this.plugin.settings.custom_css_mode)

					if (this.plugin.settings.custom_css == "") {
						let font_family_name = ""
						try {
							font_family_name = this.plugin.settings.font.split('.')[0]
						} catch (error) {
							console.log(error)
						}
						text.setValue(get_default_css(font_family_name))
					}
					else {
						text.setValue(this.plugin.settings.custom_css)
					}
					text.onChanged()

					text.inputEl.style.width = "100%"
					text.inputEl.style.height = "100px"


				})
		}




	}
}
