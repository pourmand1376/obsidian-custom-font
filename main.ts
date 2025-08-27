import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";

interface FontPluginSettings {
	font_folder: string;
	font: string;
	force_mode: boolean;
	custom_css_mode: boolean;
	custom_css: string;
}

const DEFAULT_SETTINGS: FontPluginSettings = {
	font_folder: "",
	font: "None",
	force_mode: false,
	custom_css_mode: false,
	custom_css: "",
};

function get_default_css(font_family_name: string, css_class = ":root *") {
	return `${css_class} {
		--font-default: '${font_family_name}';
		--default-font: '${font_family_name}';
		--font-family-editor: '${font_family_name}';
		--font-monospace-default: '${font_family_name}';
		--font-interface-override: '${font_family_name}';
		--font-text-override: '${font_family_name}';
		--font-monospace-override: '${font_family_name}';	
	}
`;
}
function get_custom_css(font_family_name: string, css_class = ":root *") {
	return `${css_class} * {
		font-family: '${font_family_name}' !important;
		}`;
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
	config_dir: string = this.app.vault.configDir;
	plugin_folder_path = `${this.config_dir}/plugins/custom-font-loader`;
	private processingNoticeShown = false;

	async load_plugin() {
		await this.loadSettings();
		try {
			const font_file_name: string = this.settings.font;
			if (font_file_name && font_file_name.toLowerCase() != "none") {
				if (font_file_name != "all") {
					await this.process_and_load_font(font_file_name, false);
				} else {
					applyCss("", "custom_font_base64");
					const files = await this.app.vault.adapter.list(
						this.settings.font_folder
					);
					for (const file of files.files) {
						const file_name = file.replace(
							this.settings.font_folder,
							""
						);
						await this.process_and_load_font(file_name, true);
					}
				}
			} else {
				applyCss("", "custom_font_base64");
				applyCss("", "custom_font_general");
			}
		} catch (error) {
			console.error("Error loading fonts:", error);
			new Notice(`Error loading fonts: ${error.message || error}`);
		}
	}

	private async process_and_load_font(
		font_file_name: string,
		load_all_fonts: boolean
	) {
		try {
			console.log("loading %s", font_file_name);
			const css_font_path = `${this.plugin_folder_path}/${font_file_name
				.toLowerCase()
				.replace(".", "_")}.css`;

			if (!(await this.app.vault.adapter.exists(css_font_path))) {
				await this.convert_font_to_css(font_file_name, css_font_path);
				// Load the font directly after conversion
				await this.load_font(css_font_path, load_all_fonts);
				await this.load_css(font_file_name);
			} else {
				await this.load_font(css_font_path, load_all_fonts);
				await this.load_css(font_file_name);
			}
		} catch (error) {
			console.error(`Error processing font ${font_file_name}:`, error);
			new Notice(`Failed to process font: ${font_file_name}`);
		}
	}
	private async load_font(css_font_path: string, appendMode: boolean) {
		const content = await this.app.vault.adapter.read(css_font_path);
		applyCss(content, "custom_font_base64", appendMode);
	}
	private async load_css(font_file_name: string) {
		let css_string = "";
		const font_family_name: string = font_file_name.split(".")[0].toLowerCase();

		if (this.settings.custom_css_mode) {
			css_string = this.settings.custom_css;
		} else {
			css_string = get_default_css(font_family_name);
		}
		if (this.settings.force_mode)
			css_string += `
					* {
						font-family: '${font_family_name}' !important;
					}
						`;
		applyCss(css_string, "custom_font_general");
	}

	private async convert_font_to_css(
		font_file_name: string,
		css_font_path: string
	) {
		try {
			// Show notice only once to prevent spam
			if (!this.processingNoticeShown) {
				new Notice("Processing Font files");
				this.processingNoticeShown = true;
				// Reset the flag after a delay to allow for future operations
				setTimeout(() => {
					this.processingNoticeShown = false;
				}, 5000);
			}
			
			const file = `${this.settings.font_folder}/${font_file_name}`;
			const arrayBuffer = await this.app.vault.adapter.readBinary(file);

			const font_family_name: string = font_file_name
				.split(".")[0]
				.toLowerCase();
			const font_extension_name: string = font_file_name
				.split(".")[1]
				.toLowerCase();

			// Use CSS Font Loading API for better performance
			const fontBlob = new Blob([arrayBuffer]);
			const fontUrl = URL.createObjectURL(fontBlob);
			
			const fontFace = new FontFace(font_family_name, `url(${fontUrl})`, {
				display: 'swap' // Better loading performance
			});

			try {
				await fontFace.load();
				// Check if document.fonts.add is available (modern browsers)
				const fonts = document.fonts as any; // eslint-disable-line @typescript-eslint/no-explicit-any
				if (fonts && typeof fonts.add === 'function') {
					fonts.add(fontFace); // eslint-disable-line @typescript-eslint/no-explicit-any
					console.log(`Font ${font_family_name} loaded successfully using CSS Font Loading API`);
				} else {
					console.log(`CSS Font Loading API not fully supported, falling back to traditional method for ${font_family_name}`);
					throw new Error('CSS Font Loading API not supported');
				}
				
				// Still create CSS file for backward compatibility
				const base64 = arrayBufferToBase64(arrayBuffer);
				const css_type = font_extension_name === "woff" ? "font/woff" :
								font_extension_name === "woff2" ? "font/woff2" :
								font_extension_name === "otf" ? "font/opentype" : "font/truetype";
				
				const base64_css = `@font-face{
	font-family: '${font_family_name}';
	src: url(data:${css_type};base64,${base64});
	font-display: swap;
}`;
				await this.app.vault.adapter.write(css_font_path, base64_css);
				
				// Clean up object URL to prevent memory leaks
				URL.revokeObjectURL(fontUrl);
			} catch (fontLoadError) {
				console.warn(`CSS Font Loading API failed for ${font_family_name}, falling back to traditional method:`, fontLoadError);
				URL.revokeObjectURL(fontUrl);
				
				// Fallback to traditional base64 approach
				const base64 = arrayBufferToBase64(arrayBuffer);
				const css_type = font_extension_name === "woff" ? "font/woff" :
								font_extension_name === "woff2" ? "font/woff2" :
								font_extension_name === "otf" ? "font/opentype" : "font/truetype";
				
				const base64_css = `@font-face{
	font-family: '${font_family_name}';
	src: url(data:${css_type};base64,${base64});
	font-display: swap;
}`;
				await this.app.vault.adapter.write(css_font_path, base64_css);
			}

			console.log("saved font %s into %s", font_family_name, css_font_path);
		} catch (error) {
			console.error(`Error converting font ${font_file_name} to CSS:`, error);
			throw error; // Re-throw to be handled by caller
		}
	}

	async onload() {
		this.load_plugin();
		// This adds a settings tab so the user can configure various aspects of the plugin

		this.addSettingTab(new FontSettingTab(this.app, this));
	}

	async onunload() {
		applyCss("", "custom_font_base64");
		applyCss("", "custom_font_general");
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
		infoContainer.setText(
			"In Order to set the font, copy your font into fonts directory that you set"
		);

		new Setting(containerEl)
			.setName("Fonts Folder")
			.setDesc("Folder to look for your custom fonts")
			.addText((text) => {
				text.onChange(async (value) => {
					this.plugin.settings.font_folder = value;
					await this.plugin.saveSettings();
					await this.plugin.loadSettings();
				});
				if (this.plugin.settings.font_folder.trim() == "") {
					this.plugin.settings.font_folder = `${this.app.vault.configDir}/fonts`;
				}
				if (!this.plugin.settings.font_folder.endsWith("/"))
					this.plugin.settings.font_folder =
						this.plugin.settings.font_folder + "/";
				text.setValue(this.plugin.settings.font_folder);
			});

		const font_folder_path = this.plugin.settings.font_folder;

		const options = [{ name: "none", value: "None" }];
		try {
			if (!(await this.app.vault.adapter.exists(font_folder_path))) {
				await this.app.vault.adapter.mkdir(font_folder_path);
			}
			if (await this.app.vault.adapter.exists(font_folder_path)) {
				const files = await this.app.vault.adapter.list(
					font_folder_path
				);

				// Add files as options
				for (const file of files.files) {
					const file_name = file.replace(font_folder_path, "");
					if (file_name.startsWith(".")) continue; //ignore hidden files
					options.push({ name: file_name, value: file_name });
				}
			}
			options.push({ name: "all", value: "Multiple fonts" });
		} catch (error) {
			console.log(error);
		}

		new Setting(containerEl)
			.setName("Reload fonts from folder")
			.setDesc(
				"This button reloades from the folder you specified (it also creates the folder for you)"
			)
			.addButton((button) => {
				button.setButtonText("Reload");
				button.onClick((callback) => {
					this.plugin.saveSettings();
					this.plugin.load_plugin();
					this.display();
				});
			});
		this.containerEl.createDiv();

		new Setting(containerEl)
			.setName("Font")
			.setDesc(
				`Choose font (If you can't see your fonts, make sure your fonts are in the folder you specified and hit reload. 
				Also if you choose multiple fonts option, we will load and process all fonts in the folder for you. In that Case, enable Custom CSS Mode)`
			)
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
						await this.plugin.load_plugin();
						this.display();
					});
			});

		if (this.plugin.settings.font.toLowerCase() != "none") {

			new Setting(containerEl)
				.setName("Force Style")
				.setDesc(
					"This option should only be used if you have installed a community theme and normal mode doesn't work"
				)
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.force_mode);
					toggle.onChange(async (value) => {
						this.plugin.settings.force_mode = value;
						await this.plugin.saveSettings();
						await this.plugin.load_plugin();
					});
				});
			new Setting(containerEl)
				.setName("Custom CSS Mode")
				.setDesc(
					"If you want to apply a custom css style rather than default style, choose this."
				)
				.addToggle((toggle) => {
					toggle.setValue(this.plugin.settings.custom_css_mode);
					toggle.onChange(async (value) => {
						if (this.plugin.settings.custom_css_mode == false) {
							this.plugin.settings.custom_css = "";
						}
						this.plugin.settings.custom_css_mode = value;
						this.plugin.saveSettings();
						this.plugin.load_plugin();
						this.display();
					});
				});
			if (this.plugin.settings.custom_css_mode) {
				new Setting(containerEl)
					.setName("Custom CSS Style")
					.setDesc("Input your custom css style. Use the font filename without extension (in lowercase) as the font-family name. For example, if your font file is 'MyFont.ttf', use 'myfont' in your CSS.")
					.addTextArea(async (text) => {
						text.onChange(async (new_value) => {
							this.plugin.settings.custom_css = new_value;
							await this.plugin.saveSettings();
							await this.plugin.load_plugin();
						});
						text.setDisabled(!this.plugin.settings.custom_css_mode);

						if (this.plugin.settings.custom_css == "") {
							let font_family_name = "";
							try {
								font_family_name =
									this.plugin.settings.font.split(".")[0].toLowerCase();
							} catch (error) {
								console.log(error);
							}

							if (font_family_name == "all") {
								if (
									await this.app.vault.adapter.exists(
										font_folder_path
									)
								) {
									const files = await this.app.vault.adapter.list(
										font_folder_path
									);

									let final_str = "";
									// Add files as options
									for (const file of files.files) {
										const file_name = file.split("/")[2];
										const font_family = file_name.split(".")[0].toLowerCase();
										final_str +=
											"\n" +
											get_custom_css(
												font_family,
												"." + font_family
											);
									}
									text.setValue(final_str);
								}
							} else {
								// Generate a helpful template for custom CSS with examples
								const template = `/* Example CSS for your font: ${font_family_name} */

/* Apply to all text */
:root * {
	--font-default: '${font_family_name}';
	--default-font: '${font_family_name}';
	--font-family-editor: '${font_family_name}';
	--font-interface-override: '${font_family_name}';
	--font-text-override: '${font_family_name}';
}

/* Example: Apply to custom CSS class */
.custom-font * {
	font-family: '${font_family_name}' !important;
}

/* Example: Apply to specific elements only */
.custom-font h1, .custom-font h2, .custom-font h3 {
	font-family: '${font_family_name}' !important;
}`;
								text.setValue(template);
							}
						} else {
							text.setValue(this.plugin.settings.custom_css);
						}
						text.onChanged();

						text.inputEl.style.width = "100%";
						text.inputEl.style.height = "100px";

					});
			}
		}
	}
}
