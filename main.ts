import {
	App,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";



interface FontPluginSettings {
	font: string;
	force_mode: boolean;
	custom_css_mode: boolean;
	custom_css: string;
}

const DEFAULT_SETTINGS: FontPluginSettings = {
	font: "None",
	force_mode: false,
	custom_css_mode: false,
	custom_css: "",
};

function get_default_css(font_family_name: string,css_class=':root *') {
	return `${css_class} {
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
function get_custom_css(font_family_name: string, css_class=":root *")
{
	return `${css_class} * {
		font-family: ${font_family_name} !important;
		}`
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

function applyCss(css: string, css_id: string, appendMode = false) {
	// Check if style tag with the given ID already exists
	const existingStyle = document.getElementById(css_id);

	if (existingStyle && appendMode) {
		// Append CSS content to existing style tag
		existingStyle.innerHTML += css;
	} else {
		// Create style tag
		const style = document.createElement("style");

		// Add CSS content
		style.innerHTML = css;

		// Append style tag to head
		document.head.appendChild(style);

		// Optional: Remove existing custom CSS
		if (existingStyle) {
			existingStyle.remove();
		}

		// Give ID to new style tag
		style.id = css_id;
	}
}


export default class FontPlugin extends Plugin {
	settings: FontPluginSettings;
	config_dir: string =  this.app.vault.configDir;
	plugin_folder_path = `${this.config_dir}/plugins/custom-font-loader`
	font_folder_path = `${this.app.vault.configDir}/fonts`

	async load_plugin() {
		await this.loadSettings()
		try {
			const font_file_name: string = this.settings.font
			if (
				font_file_name &&
				font_file_name.toLowerCase() != "none"
			) {
				if (font_file_name != "all")
					{
						await this.process_and_load_font(font_file_name, false);
					}
				else {
					applyCss('', 'custom_font_base64')
					const files = await this.app.vault.adapter.list(this.font_folder_path)
					for (const file of files.files) {
						const file_name = file.split('/')[2]
						await this.process_and_load_font(file_name, true)
					}
				}
			} else {
				applyCss('', 'custom_font_base64')
				applyCss('', 'custom_font_general')
			}


		} catch (error) {
			new Notice(error);
		}

	}

	private async process_and_load_font(font_file_name: string,load_all_fonts:boolean) {
		console.log('loading %s', font_file_name);
		const css_font_path = `${this.plugin_folder_path}/${font_file_name.toLowerCase().replace('.', '_')}.css`;

		if (!await this.app.vault.adapter.exists(css_font_path)) {
			await this.convert_font_to_css(font_file_name, css_font_path);
		}
		else {
			await this.load_font(css_font_path, load_all_fonts)
			await this.load_css(font_file_name)
		}
	}
	private async load_font(css_font_path: string,appendMode: boolean)
	{
		const content = await this.app.vault.adapter.read(css_font_path);
		applyCss(content, 'custom_font_base64',appendMode);
	}
	private async load_css(font_file_name: string) {
		
		let css_string = "";
		const font_family_name: string = font_file_name.split('.')[0];

		if (this.settings.custom_css_mode) {
			css_string = this.settings.custom_css;
		}
		else {
			css_string = get_default_css(font_family_name);
		}
		if (this.settings.force_mode)
			css_string += `
					* {
						font-family: ${font_family_name} !important;
					}
						`;
		applyCss(css_string, 'custom_font_general');
	}

	private async convert_font_to_css(font_file_name: string, css_font_path: string) {
		new Notice("Processing Font files");
		const file = `${this.config_dir}/fonts/${font_file_name}`;
		const arrayBuffer = await this.app.vault.adapter.readBinary(file);

		// Convert to base64
		const base64 = arrayBufferToBase64(arrayBuffer);

		const font_family_name: string = font_file_name.split('.')[0];
		const font_extension_name: string = font_file_name.split('.')[1];

		let css_type="";
		switch(font_extension_name) {
		case 'woff':
			css_type = 'font/woff';
			break;
		case 'ttf': 
			css_type = 'font/truetype';
			break;
		case 'woff2':
			css_type = 'font/woff2';
			break;
		case 'otf':
			css_type = 'font/opentype'
			break;
		default:
			css_type = 'font';
		}

		const base64_css = `@font-face{
	font-family: '${font_family_name}';
	src: url(data:${css_type};base64,${base64});
}`;
		this.app.vault.adapter.write(css_font_path, base64_css);
		console.log('saved font %s into %s', font_family_name, css_font_path);

		console.log('Font CSS Saved into %s', css_font_path);
		await this.load_plugin();
	}

	async onload() {
		this.load_plugin()
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
		const font_folder_path = `${this.app.vault.configDir}/fonts`

		const infoContainer = containerEl.createDiv();
		infoContainer.setText("In Order to set the font, copy your font into '.obsidian/fonts/' directory.");
		const options = [{ name: "none", value: "None" }];
		try {
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
			options.push({name: "all", value:"Multiple fonts"})

		}
		catch (error) {
			console.log(error)
		}
		// Show combo box in UI somehow
		new Setting(containerEl)
			.setName("Font")
			.setDesc("Choose font (If you choose multiple fonts option, we will load and process all fonts in the folder for you)")
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
						await this.plugin.load_plugin()
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
					await this.plugin.load_plugin()
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
					this.plugin.load_plugin()
					this.display()
				})
			})
		if (this.plugin.settings.custom_css_mode) {
			new Setting(containerEl)
				.setName("Custom CSS Style")
				.setDesc("Input your custom css style")
				.addTextArea(async (text) => {
					text.onChange(async (new_value) => {
						this.plugin.settings.custom_css = new_value
						await this.plugin.saveSettings();
						await this.plugin.load_plugin();
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
						
						if (font_family_name=='all'){
							if (await this.app.vault.adapter.exists(font_folder_path)) {
								const files = await this.app.vault.adapter.list(font_folder_path)
								
								let final_str = ""
								// Add files as options
								for (const file of files.files) {
									const file_name = file.split('/')[2]
									const font_family = file_name.split('.')[0]
									final_str +="\n"+ get_custom_css(font_family, '.'+font_family)
								}
								text.setValue(final_str)
							}
						}
						else{
							text.setValue(get_default_css(font_family_name))
						}
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
