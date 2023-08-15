import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface FontPluginSettings {
	mySetting: string;
	font: string; 
  }
  
  const DEFAULT_SETTINGS: FontPluginSettings = {
	mySetting: 'default',
	font: 'Shabnam'
  }

async function downloadFont(fontName:string) {

	new Notice(`Downloading ${fontName} font...`);
  
	// Download logic here
  
	const fontCSS = //...
  
	new Notice('Font downloaded successfully!');
  
	return fontCSS;
  
  }

  function applyCss(css) {

	// Create style tag
	const style = document.createElement('style'); 
	
	// Add CSS content
	style.innerHTML = css;
  
	// Append style tag to head
	document.head.appendChild(style);
  
	// Optional: Remove existing custom CSS
	const existingStyle = document.getElementById('farsi-font-plugin-css');
	if (existingStyle) {
	  existingStyle.remove(); 
	}
  
	// Give ID to new style tag
	style.id = 'farsi-font-plugin-css';
  
  }

export default class MyPlugin extends Plugin {
	settings: FontPluginSettings;

	async onload() {
		await this.loadSettings();

		const font = this.settings.font;

		if (font === 'Shabnam') {

			const css = await downloadFont('Shabnam');
			
			applyCss(css);
		  
		  } else if (font === 'Vazirmatn') {
		  
			const css = await downloadFont('Vazirmatn');
			
			applyCss(css);
			
		  }

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}



class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
		.setName('Font')
		.setDesc('Select the font for the Obsidian workspace')
		.addDropdown(dropdown => {
			dropdown.addOptions({
			'Shabnam': 'Shabnam',
			'Vazirmatn': 'Vazirmatn'
			})
			.setValue(this.plugin.settings.font)
			.onChange(async (value) => {
			this.plugin.settings.font = value;
			await this.plugin.saveSettings();
			});
		})
	}
}
