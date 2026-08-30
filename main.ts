import { App, Notice, Plugin, PluginSettingTab, Setting, setIcon } from "obsidian";

// Sentinel value meaning "don't override this role, keep Obsidian's default font".
const DEFAULT_FONT = "Default";

// Emoji fallback fonts appended to every custom font stack so that emojis still
// render when the chosen font lacks emoji glyphs. When a role override such as
// `--font-text-override` is set, Obsidian replaces its whole font stack
// (including the emoji fonts it normally appends), so we re-add them here.
const EMOJI_FONTS = `"Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"`;

const FONT_EXTENSIONS = ["ttf", "otf", "woff", "woff2"];

interface FontPluginSettings {
	font_folder: string;
	// Each role holds an ordered list of font paths forming a fallback chain:
	// the first font that has a glyph wins, per character. Empty = no override.
	interface_font: string[];
	text_font: string[];
	monospace_font: string[];
	// Extra fonts loaded only so they are usable via their utility class
	// (cssclasses), without being applied to any role.
	extra_fonts: string[];
	emoji_support: boolean;
	force_mode: boolean;
	// Legacy single-font setting, kept only so we can migrate existing users.
	font?: string;
}

const DEFAULT_SETTINGS: FontPluginSettings = {
	font_folder: "",
	interface_font: [],
	text_font: [],
	monospace_font: [],
	extra_fonts: [],
	emoji_support: true,
	force_mode: false,
};

// Coerce a stored role value (which may be a legacy string, the "Default"
// sentinel, undefined, or already an array) into an ordered list of font paths.
function to_path_array(value: unknown): string[] {
	const items = Array.isArray(value) ? value : value === undefined ? [] : [value];
	return items.filter(
		(v): v is string =>
			typeof v === "string" &&
			v.length > 0 &&
			v.toLowerCase() !== DEFAULT_FONT.toLowerCase()
	);
}

function with_trailing_slash(folder: string): string {
	return folder.endsWith("/") ? folder : folder + "/";
}

function basename(path: string): string {
	const parts = path.split("/");
	return parts[parts.length - 1];
}

// Weight keywords that may appear in a font filename, mapped to a display label.
const FONT_WEIGHTS: Record<string, string> = {
	thin: "Thin",
	hairline: "Thin",
	extralight: "ExtraLight",
	ultralight: "ExtraLight",
	light: "Light",
	regular: "Regular",
	normal: "Regular",
	book: "Regular",
	medium: "Medium",
	semibold: "SemiBold",
	demibold: "SemiBold",
	bold: "Bold",
	extrabold: "ExtraBold",
	ultrabold: "ExtraBold",
	black: "Black",
	heavy: "Black",
};

// CSS numeric weight for each display label.
const WEIGHT_NUMBERS: Record<string, number> = {
	Thin: 100,
	ExtraLight: 200,
	Light: 300,
	Regular: 400,
	Medium: 500,
	SemiBold: 600,
	Bold: 700,
	ExtraBold: 800,
	Black: 900,
};

interface ParsedFont {
	family: string; // human family name, e.g. "Open Sans"
	slug: string; // CSS font-family / class name, e.g. "open-sans"
	weight: string; // display weight, e.g. "Bold" ("" if none in filename)
	weightNumber: number; // CSS numeric weight (defaults to 400)
	italic: boolean;
}

// Parse a font filename into family + weight + style. Files that share a family
// (e.g. Roboto-Regular and Roboto-Bold) resolve to the same slug, so they are
// registered under one CSS font-family and the browser picks the right weight.
function parse_font(path: string): ParsedFont {
	const stem = basename(path).replace(/\.[^./]+$/, "");
	const family_tokens: string[] = [];
	let weight = "";
	let italic = false;
	for (const raw of stem.split(/[-_ ]+/)) {
		if (!raw) continue;
		let t = raw.toLowerCase();
		if (t.endsWith("italic")) {
			italic = true;
			t = t.slice(0, -"italic".length);
		} else if (t.endsWith("oblique")) {
			italic = true;
			t = t.slice(0, -"oblique".length);
		}
		if (t === "") continue; // token was purely italic/oblique
		if (FONT_WEIGHTS[t]) {
			weight = FONT_WEIGHTS[t];
			continue;
		}
		family_tokens.push(raw);
	}
	const family = family_tokens.join(" ") || stem;
	const slug =
		family.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
		"font";
	return {
		family,
		slug,
		weight,
		weightNumber: weight ? WEIGHT_NUMBERS[weight] : 400,
		italic,
	};
}

// The CSS font-family name (a family slug shared by all weights of a family).
function font_family_from_path(path: string): string {
	return parse_font(path).slug;
}

// A human label like "Roboto Bold Italic" for one font file.
function font_label(path: string): string {
	const { family, weight, italic } = parse_font(path);
	let label = family;
	if (weight) label += ` ${weight}`;
	if (italic) label += " Italic";
	return label;
}

function is_font_file(path: string): boolean {
	const name = basename(path);
	if (name.startsWith(".")) return false;
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	return FONT_EXTENSIONS.includes(ext);
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
	let binary = "";
	const bytes = new Uint8Array(buffer);
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i]);
	}
	return btoa(binary);
}

// Dynamically generated CSS (font-face declarations and font-family overrides)
// is applied through constructable stylesheets (document.adoptedStyleSheets)
// rather than injected <style> elements, which Obsidian does not allow.
const managedStyleSheets: Record<string, { sheet: CSSStyleSheet; css: string }> =
	{};

function applyCss(css: string, css_id: string, appendMode = false) {
	let entry = managedStyleSheets[css_id];

	if (!entry) {
		const sheet = new CSSStyleSheet();
		entry = { sheet, css: "" };
		managedStyleSheets[css_id] = entry;
		document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
	}

	entry.css = appendMode ? entry.css + css : css;
	entry.sheet.replaceSync(entry.css);
}

function removeCss(css_id: string) {
	const entry = managedStyleSheets[css_id];
	if (!entry) {
		return;
	}
	document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
		(sheet) => sheet !== entry.sheet
	);
	delete managedStyleSheets[css_id];
}

export default class FontPlugin extends Plugin {
	settings: FontPluginSettings;
	config_dir: string = this.app.vault.configDir;
	plugin_folder_path = `${this.config_dir}/plugins/custom-font-loader`;
	private processingNoticeShown = false;

	// Build the comma-separated font-family stack for a role: each chosen font in
	// order, then the emoji fonts last (when enabled). The browser does per-glyph
	// fallback down this list, so earlier fonts take precedence character by character.
	private font_stack(font_paths: string[]): string {
		// Dedupe by family slug: different weights of one family share a slug and
		// should appear once (the browser resolves the weight per character).
		const slugs = [...new Set(font_paths.map(font_family_from_path))];
		const families = slugs.map((slug) => `'${slug}'`);
		if (this.settings.emoji_support) families.push(EMOJI_FONTS);
		return families.join(", ");
	}

	// Every folder scanned for fonts: the vault-root `fonts` folder and the
	// config-dir `fonts` folder are always scanned, plus whatever folder the
	// user configured. Reading from all of them by default is harmless and
	// lets fonts live wherever is convenient.
	font_folders(): string[] {
		const set = new Set<string>();
		const configured = this.settings.font_folder.trim();
		if (configured) set.add(with_trailing_slash(configured));
		set.add("fonts/");
		set.add(`${this.config_dir}/fonts/`);
		return [...set];
	}

	// Every font file (full vault-relative path) found across all scanned folders.
	async list_font_files(): Promise<string[]> {
		const paths: string[] = [];
		const seen = new Set<string>();
		for (const folder of this.font_folders()) {
			try {
				if (!(await this.app.vault.adapter.exists(folder))) continue;
				const listing = await this.app.vault.adapter.list(folder);
				for (const file of listing.files) {
					if (!is_font_file(file)) continue;
					if (seen.has(file)) continue;
					seen.add(file);
					paths.push(file);
				}
			} catch (error) {
				console.error(`Error listing fonts in ${folder}:`, error);
			}
		}
		return paths;
	}

	// The fonts whose @font-face is loaded: the fonts chosen for the three roles
	// plus the extra fonts the user added for their utility class only. Only
	// these are loaded, so startup stays light instead of loading every file.
	loaded_fonts(): string[] {
		const set = new Set<string>();
		for (const role of [
			this.settings.interface_font,
			this.settings.text_font,
			this.settings.monospace_font,
			this.settings.extra_fonts,
		]) {
			for (const path of role) set.add(path);
		}
		return [...set];
	}

	// One utility class per font family (weights share a slug, so they collapse to
	// one class) — e.g. add `cssclasses: [font-roboto]` to a note's frontmatter,
	// or wrap content in `<div class="font-roboto">`. The `*` descendant selector
	// plus `!important` force the family on everything inside; the browser still
	// resolves the right weight per character.
	private utility_classes_css(paths: string[]): string {
		const lines: string[] = [];
		const seen = new Set<string>();
		for (const file of paths) {
			const slug = font_family_from_path(file);
			if (seen.has(slug)) continue;
			seen.add(slug);
			lines.push(
				`.font-${slug}, .font-${slug} * { font-family: '${slug}'${
					this.settings.emoji_support ? `, ${EMOJI_FONTS}` : ""
				} !important; }`
			);
		}
		return lines.join("\n");
	}

	async load_plugin() {
		await this.loadSettings();
		try {
			// Reset both managed stylesheets, then rebuild them from scratch.
			applyCss("", "custom_font_base64");

			const fonts = this.loaded_fonts();
			for (const font_path of fonts) {
				await this.process_and_load_font(font_path);
			}

			this.apply_general_css();
			applyCss(this.utility_classes_css(fonts), "custom_font_classes");
		} catch (error) {
			console.error("Error loading fonts:", error);
			const message = error instanceof Error ? error.message : String(error);
			new Notice(`Error loading fonts: ${message}`);
		}
	}

	// Build the `:root, body { ... }` override block from the current per-role
	// selections. Shared by normal mode and by the custom-CSS template seed, so
	// enabling custom mode starts from the user's actual configuration.
	// `important` appends !important (used by force mode). Returns "" when no
	// role is set.
	//
	// Each role sets its `-override` variable (the modern hook) plus the legacy
	// variables older themes/Obsidian versions read, mapped to the matching role
	// so the three stay independent. `--font-default` is the global base
	// (interface); monospace has its own base so it is unaffected. `body` is
	// targeted alongside `:root` because Obsidian sets these variables on `body`,
	// and a value set directly on `body` beats one merely inherited from `:root`.
	role_override_css(important: boolean): string {
		const lines: string[] = [];
		const bang = important ? " !important" : "";
		const push_role = (paths: string[], vars: string[]) => {
			if (paths.length === 0) return;
			const stack = this.font_stack(paths);
			for (const name of vars) lines.push(`\t${name}: ${stack}${bang};`);
		};
		push_role(this.settings.interface_font, [
			"--font-interface-override",
			"--font-default",
			"--default-font",
		]);
		push_role(this.settings.text_font, [
			"--font-text-override",
			"--font-family-editor",
		]);
		push_role(this.settings.monospace_font, [
			"--font-monospace-override",
			"--font-monospace-default",
		]);
		if (lines.length === 0) return "";
		return `:root, body {\n${lines.join("\n")}\n}\n`;
	}

	// Emit the per-role font-family overrides into the general stylesheet.
	private apply_general_css() {
		applyCss(
			this.role_override_css(this.settings.force_mode),
			"custom_font_general"
		);
	}

	private async process_and_load_font(font_path: string) {
		try {
			// `_v2` busts caches written before @font-face gained weight/style
			// descriptors, so upgraded vaults regenerate them.
			const css_font_path = `${this.plugin_folder_path}/${basename(font_path)
				.toLowerCase()
				.replace(".", "_")}_v2.css`;

			if (!(await this.app.vault.adapter.exists(css_font_path))) {
				await this.convert_font_to_css(font_path, css_font_path);
			}
			await this.load_font(css_font_path);
		} catch (error) {
			console.error(`Error processing font ${font_path}:`, error);
			new Notice(`Failed to process font: ${basename(font_path)}`);
		}
	}

	private async load_font(css_font_path: string) {
		const content = await this.app.vault.adapter.read(css_font_path);
		applyCss(content, "custom_font_base64", true);
	}

	private async convert_font_to_css(font_path: string, css_font_path: string) {
		try {
			// Show notice only once to prevent spam
			if (!this.processingNoticeShown) {
				new Notice("Processing font files");
				this.processingNoticeShown = true;
				// Reset the flag after a delay to allow for future operations
				window.setTimeout(() => {
					this.processingNoticeShown = false;
				}, 5000);
			}

			const arrayBuffer = await this.app.vault.adapter.readBinary(font_path);

			const parsed = parse_font(font_path);
			const font_family_name = parsed.slug;
			const font_weight = String(parsed.weightNumber);
			const font_style = parsed.italic ? "italic" : "normal";
			const font_extension_name: string =
				basename(font_path).split(".").pop()?.toLowerCase() ?? "";

			// Use CSS Font Loading API for better performance
			const fontBlob = new Blob([arrayBuffer]);
			const fontUrl = URL.createObjectURL(fontBlob);

			// Register under the family slug with weight/style descriptors, so all
			// weights of a family share one font-family and resolve automatically.
			const fontFace = new FontFace(font_family_name, `url(${fontUrl})`, {
				display: "swap", // Better loading performance
				weight: font_weight,
				style: font_style,
			});

			try {
				await fontFace.load();
				// Check if the CSS Font Loading API is available (modern browsers).
				// `FontFaceSet.add` is not present in the bundled DOM typings, so
				// narrow to a minimal typed shape instead of casting to `any`.
				const fontFaceSet = document.fonts as unknown as {
					add?: (font: FontFace) => void;
				};
				if (typeof fontFaceSet.add === "function") {
					fontFaceSet.add(fontFace);
				} else {
					throw new Error("CSS Font Loading API not supported");
				}

				// Still create CSS file for backward compatibility
				const base64 = arrayBufferToBase64(arrayBuffer);
				const css_type = font_extension_name === "woff" ? "font/woff" :
								font_extension_name === "woff2" ? "font/woff2" :
								font_extension_name === "otf" ? "font/opentype" : "font/truetype";

				const base64_css = `@font-face{
	font-family: '${font_family_name}';
	font-weight: ${font_weight};
	font-style: ${font_style};
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
	font-weight: ${font_weight};
	font-style: ${font_style};
	src: url(data:${css_type};base64,${base64});
	font-display: swap;
}`;
				await this.app.vault.adapter.write(css_font_path, base64_css);
			}
		} catch (error) {
			console.error(`Error converting font ${font_path} to CSS:`, error);
			throw error; // Re-throw to be handled by caller
		}
	}

	async onload() {
		await this.load_plugin();
		// This adds a settings tab so the user can configure various aspects of the plugin

		this.addSettingTab(new FontSettingTab(this.app, this));
	}

	onunload() {
		removeCss("custom_font_base64");
		removeCss("custom_font_general");
		removeCss("custom_font_classes");
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<FontPluginSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		// Drop the now-removed custom-CSS settings if an old data file carried them.
		const stale = this.settings as unknown as Record<string, unknown>;
		delete stale.custom_css_mode;
		delete stale.custom_css;
		// Normalize roles to ordered path arrays (tolerating older string formats).
		this.settings.interface_font = to_path_array(this.settings.interface_font);
		this.settings.text_font = to_path_array(this.settings.text_font);
		this.settings.monospace_font = to_path_array(this.settings.monospace_font);
		this.settings.extra_fonts = to_path_array(this.settings.extra_fonts);
		// `font_folder` is an OPTIONAL extra folder; leave it empty when unset
		// (the vault-root and config-dir `fonts` folders are always scanned).
		this.settings.font_folder = this.settings.font_folder.trim();
		if (this.settings.font_folder !== "") {
			this.settings.font_folder = with_trailing_slash(this.settings.font_folder);
		}
		await this.migrate_legacy_settings();
	}

	// Migrate the old single `font` setting onto the new per-role settings so
	// existing users see no visible change after upgrading.
	private async migrate_legacy_settings() {
		const legacy = this.settings.font;
		if (legacy === undefined) return;

		const roles_untouched =
			this.settings.interface_font.length === 0 &&
			this.settings.text_font.length === 0 &&
			this.settings.monospace_font.length === 0;

		if (roles_untouched) {
			if (legacy.toLowerCase() === "all") {
				// The old "Multiple fonts" mode relied on custom CSS to reference
				// fonts. Every font is now loaded and exposed by name/class anyway,
				// so there is nothing to migrate.
			} else if (legacy && legacy.toLowerCase() !== "none") {
				// The old single font (a bare filename in font_folder) applied to
				// every role at once. Resolve it to a full path.
				const base = with_trailing_slash(
					this.settings.font_folder || `${this.config_dir}/fonts`
				);
				const path = base + legacy;
				this.settings.interface_font = [path];
				this.settings.text_font = [path];
				this.settings.monospace_font = [path];
			}
		}

		delete this.settings.font;
		await this.saveData(this.settings);
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

	display(): void {
		void this.renderSettings();
	}

	// One option per font found across all scanned folders. The stored value is
	// the font's full path; the label shows the parsed family + weight (with its
	// folder) so same-family fonts read as related and stay distinguishable.
	private async font_options(): Promise<{ key: string; label: string }[]> {
		const options: { key: string; label: string }[] = [];
		const files = await this.plugin.list_font_files();
		for (const file of files) {
			const dir = file.slice(0, file.length - basename(file).length);
			const label = dir ? `${font_label(file)}  (${dir})` : font_label(file);
			options.push({ key: file, label });
		}
		return options;
	}

	private async commit(roles: string[], set: (value: string[]) => void) {
		set(roles);
		await this.plugin.saveSettings();
		await this.plugin.load_plugin();
		this.display();
	}

	// Append a colored weight badge (Regular / Bold / …) to a setting's name, so
	// the weight is visible right where the font is selected.
	private appendWeightBadge(nameEl: HTMLElement, path: string) {
		const p = parse_font(path);
		const badge = nameEl.createSpan({
			cls: "custom-font-weight-badge",
			text: `${p.weight || "Regular"}${p.italic ? " Italic" : ""}`,
		});
		badge.setAttribute("data-weight", String(p.weightNumber));
	}

	// Ordered multi-select for one font role: the current fonts as a reorderable
	// list (move up / down / remove) plus an "Add font" dropdown that appends.
	private renderFontRole(
		containerEl: HTMLElement,
		name: string,
		desc: string,
		options: { key: string; label: string }[],
		get: () => string[],
		set: (value: string[]) => void
	) {
		const selected = get();

		new Setting(containerEl).setName(name).setDesc(desc).setHeading();

		if (selected.length === 0) {
			new Setting(containerEl)
				.setDesc("Default — not overridden.")
				.settingEl.addClass("custom-font-role-empty");
		}

		// Index of the row currently being dragged, shared across this role's rows.
		let drag_from: number | null = null;

		selected.forEach((path, index) => {
			const row = new Setting(containerEl)
				.setName(`${index + 1}. ${parse_font(path).family}`)
				.setDesc(index === 0 ? "Preferred" : "Fallback");
			this.appendWeightBadge(row.nameEl, path);
			const el = row.settingEl;
			el.addClass("custom-font-role-item");

			// Grip handle: dragging starts only from the handle, so the row's
			// buttons stay clickable.
			row.addExtraButton((b) => {
				b.setIcon("lucide-menu");
				b.extraSettingsEl.addClass("custom-font-drag-handle");
				b.extraSettingsEl.setAttribute("aria-label", "Drag to reorder");
				b.extraSettingsEl.addEventListener("mousedown", () => {
					el.draggable = true;
				});
			});
			row.addExtraButton((b) => {
				b.setIcon("x").onClick(async () => {
					await this.commit(
						selected.filter((_, i) => i !== index),
						set
					);
				});
				b.extraSettingsEl.setAttribute("aria-label", "Remove");
			});

			el.addEventListener("dragstart", (e) => {
				drag_from = index;
				el.addClass("custom-font-dragging");
				e.dataTransfer?.setData("text/plain", String(index));
			});
			el.addEventListener("dragend", () => {
				el.draggable = false;
				el.removeClass("custom-font-dragging");
			});
			el.addEventListener("dragover", (e) => {
				e.preventDefault();
				el.addClass("custom-font-dragover");
			});
			el.addEventListener("dragleave", () => {
				el.removeClass("custom-font-dragover");
			});
			el.addEventListener("drop", (e) => {
				e.preventDefault();
				el.removeClass("custom-font-dragover");
				if (drag_from === null || drag_from === index) return;
				const next = [...selected];
				const [moved] = next.splice(drag_from, 1);
				next.splice(index, 0, moved);
				drag_from = null;
				void this.commit(next, set);
			});
		});

		const available = options.filter((o) => !selected.includes(o.key));
		if (available.length > 0) {
			new Setting(containerEl)
				.setName("Add font")
				.setDesc("Fonts are tried in order; the first with a glyph wins.")
				.addDropdown((dropdown) => {
					dropdown.addOption("", "Choose a font…");
					for (const opt of available) {
						dropdown.addOption(opt.key, opt.label);
					}
					dropdown.setValue("").onChange(async (value) => {
						if (!value) return;
						await this.commit([...selected, value], set);
					});
				});
		}
	}

	private async renderSettings() {
		const { containerEl } = this;

		containerEl.empty();

		const infoCard = containerEl.createDiv({ cls: "custom-font-info" });
		infoCard.createDiv({
			cls: "custom-font-info-title",
			text: "Where to put your fonts",
		});
		infoCard.createDiv({
			text: "Drop your font files (.ttf, .otf, .woff, .woff2) into any of these folders — all are scanned automatically:",
		});
		const pathsList = infoCard.createEl("ul");
		pathsList.createEl("li", {
			text: "Vault root: a 'fonts' folder",
		});
		pathsList.createEl("li", {
			text: `Config dir: '${this.app.vault.configDir}/fonts'`,
		});
		pathsList.createEl("li", {
			text: "Custom: whatever folder you set below",
		});

		new Setting(containerEl)
			.setName("Fonts folder")
			.setDesc(
				"Optional custom folder to also scan for fonts (e.g. 'assets/fonts')."
			)
			.addText((text) => {
				text.setPlaceholder("Path to an extra fonts folder");
				text.setValue(this.plugin.settings.font_folder);
				text.onChange(async (value) => {
					const trimmed = value.trim();
					this.plugin.settings.font_folder =
						trimmed === "" ? "" : with_trailing_slash(trimmed);
					await this.plugin.saveSettings();
					await this.plugin.load_plugin();
				});
			});

		// Make sure the config-dir fonts folder exists so users always have a
		// guaranteed place to drop fonts, and the custom folder too when set.
		const ensure_folders = [`${this.app.vault.configDir}/fonts/`];
		if (this.plugin.settings.font_folder) {
			ensure_folders.push(this.plugin.settings.font_folder);
		}
		for (const folder of ensure_folders) {
			try {
				if (!(await this.app.vault.adapter.exists(folder))) {
					await this.app.vault.adapter.mkdir(folder);
				}
			} catch (error) {
				console.error(error);
			}
		}

		new Setting(containerEl)
			.setName("Reload fonts from folder")
			.setDesc(
				"This button reloades from the folders scanned (it also creates the folder for you)"
			)
			.addButton((button) => {
				button.setButtonText("Reload");
				button.onClick(async () => {
					await this.plugin.saveSettings();
					await this.plugin.load_plugin();
					this.display();
				});
			});

		const options = await this.font_options();

		if (options.length === 0) {
			const warn = containerEl.createDiv({ cls: "custom-font-warning" });
			warn.createDiv({
				cls: "custom-font-warning-title",
				text: "No fonts found",
			});
			warn.createDiv({
				text: "We scanned every folder above and found no font files. Add .ttf/.otf/.woff/.woff2 files to one of them, then hit Reload.",
			});
			return;
		}

		// ── Normal mode: the font pickers ──────────────────────────────
		new Setting(containerEl).setName("Normal mode").setHeading();

		this.renderFontRole(
			containerEl,
			"Interface font",
			"Set the base font for all of Obsidian.",
			options,
			() => this.plugin.settings.interface_font,
			(value) => (this.plugin.settings.interface_font = value)
		);

		this.renderFontRole(
			containerEl,
			"Text font",
			"Set the font for editing and reading views.",
			options,
			() => this.plugin.settings.text_font,
			(value) => (this.plugin.settings.text_font = value)
		);

		this.renderFontRole(
			containerEl,
			"Monospace font",
			"Set the font for places like code blocks and frontmatter.",
			options,
			() => this.plugin.settings.monospace_font,
			(value) => (this.plugin.settings.monospace_font = value)
		);

		// ── Force: override stubborn themes ────────────────────────────
		new Setting(containerEl).setName("Force").setHeading();

		new Setting(containerEl)
			.setName("Force style")
			.setDesc(
				"Adds !important to the fonts you applied so they override a theme (or Obsidian's own appearance settings) that sets fonts with higher priority."
			)
			.addToggle((toggle) => {
				toggle.setValue(this.plugin.settings.force_mode);
				toggle.onChange(async (value) => {
					this.plugin.settings.force_mode = value;
					await this.plugin.saveSettings();
					await this.plugin.load_plugin();
				});
			});

		// ── Additional features: reuse your fonts elsewhere ────────────
		new Setting(containerEl).setName("Additional features").setHeading();
		this.render_extra_fonts(containerEl, options);
		this.render_font_reference(containerEl);
	}

	// Collapsed-by-default section to load fonts that aren't applied to any role,
	// purely so they become usable via their utility class (cssclasses).
	private render_extra_fonts(
		containerEl: HTMLElement,
		options: { key: string; label: string }[]
	) {
		const extra = this.plugin.settings.extra_fonts;

		const details = containerEl.createEl("details", {
			cls: "custom-font-extra",
		});
		if (extra.length > 0) details.setAttribute("open", "");
		details.createEl("summary", { text: "Load extra fonts" });
		details.createDiv({
			cls: "custom-font-extra-desc",
			text: "Load fonts you don't want to apply globally — only to use via their cssclass on specific notes. They appear under 'Reuse your fonts' below.",
		});

		extra.forEach((path) => {
			const row = new Setting(details).setName(parse_font(path).family);
			this.appendWeightBadge(row.nameEl, path);
			row.addExtraButton((b) => {
				b.setIcon("x").onClick(async () => {
					await this.commit(
						extra.filter((p) => p !== path),
						(v) => (this.plugin.settings.extra_fonts = v)
					);
				});
				b.extraSettingsEl.setAttribute("aria-label", "Remove");
			});
		});

		// Offer fonts that aren't already loaded by a role or the extra list.
		const used = new Set<string>([
			...this.plugin.settings.interface_font,
			...this.plugin.settings.text_font,
			...this.plugin.settings.monospace_font,
			...extra,
		]);
		const available = options.filter((o) => !used.has(o.key));
		if (available.length > 0) {
			new Setting(details)
				.setName("Add font")
				.addDropdown((dropdown) => {
					dropdown.addOption("", "Choose a font…");
					for (const opt of available) dropdown.addOption(opt.key, opt.label);
					dropdown.setValue("").onChange(async (value) => {
						if (!value) return;
						await this.commit(
							[...extra, value],
							(v) => (this.plugin.settings.extra_fonts = v)
						);
					});
				});
		} else {
			details.createDiv({
				cls: "custom-font-extra-desc",
				text: "All fonts are already loaded.",
			});
		}
	}

	// For each loaded font (roles + extras) expose two copyable things: its
	// font-family name (for use in your own CSS or snippets) and its utility
	// class (apply per note via cssclasses, or wrap an element in a div).
	private render_font_reference(containerEl: HTMLElement) {
		const loaded = this.plugin.loaded_fonts();
		if (loaded.length === 0) return;

		const card = containerEl.createDiv({ cls: "custom-font-info" });
		card.createDiv({
			cls: "custom-font-info-title",
			text: "Reuse your fonts",
		});
		card.createDiv({
			text: "Each loaded font family gives you two things you can reuse anywhere. Weights of the same family are grouped under one name. Click a value to copy it.",
		});

		// One doc row per family: its font-family name and its utility class.
		const slugs = new Map<string, string>();
		for (const path of loaded) {
			const p = parse_font(path);
			if (!slugs.has(p.slug)) slugs.set(p.slug, p.family);
		}
		const list = card.createDiv({ cls: "custom-font-ref-list" });
		for (const [slug, family] of slugs) {
			const row = list.createDiv({ cls: "custom-font-ref-row" });
			row.createSpan({ cls: "custom-font-ref-name", text: family });
			this.copyable(row, "font-family", slug, slug);
			this.copyable(row, "class", `.font-${slug}`, `font-${slug}`);
		}

		// Docs: what each thing is and how to use it.
		const doc = card.createDiv({ cls: "custom-font-doc" });
		doc.createEl("p", {
			text: "Use the font-family name in your own CSS or snippets, e.g. font-family: 'name'.",
		});
		doc.createEl("p", {
			text: "Apply the class to a single note by adding its name (without the dot) to cssclasses in the note's frontmatter:",
		});
		const example = font_family_from_path(loaded[0]);
		doc.createEl("pre").createEl("code", {
			text: `---\ncssclasses:\n  - font-${example}\n---`,
		});
		doc.createEl("p", {
			text: "That note now uses the font. You can also wrap part of a note in a <div> with the class.",
		});
	}

	// A small "label value [copy]" chip that copies `copyText` on click.
	private copyable(
		parent: HTMLElement,
		label: string,
		display: string,
		copyText: string
	) {
		const chip = parent.createDiv({ cls: "custom-font-chip" });
		chip.createSpan({ cls: "custom-font-chip-label", text: label });
		chip.createEl("code", { text: display });
		const btn = chip.createEl("button", { cls: "custom-font-copy-btn" });
		setIcon(btn, "copy");
		btn.setAttribute("aria-label", `Copy '${copyText}'`);
		btn.addEventListener("click", () => {
			void navigator.clipboard.writeText(copyText);
			setIcon(btn, "check");
			new Notice(`Copied: ${copyText}`);
			window.setTimeout(() => setIcon(btn, "copy"), 1200);
		});
	}
}
