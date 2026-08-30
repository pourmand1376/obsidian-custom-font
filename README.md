![Obsidian Downloads](https://img.shields.io/badge/dynamic/json?label=downloads&query=%24%5B%22custom-font-loader%22%5D.downloads&url=https%3A%2F%2Fraw.githubusercontent.com%2Fobsidianmd%2Fobsidian-releases%2Fmaster%2Fcommunity-plugin-stats.json)

# Custom Font Loader

Spice up your Obsidian notes with custom fonts! Obsidian doesn't make it easy to set custom fonts — especially on Android and iOS. With this plugin you set your fonts up **once** and they work everywhere: Windows, macOS, Linux, Android, and iPhone. No need to install the font on your operating system.

## To get started

1. Put your font files (`.ttf`, `.otf`, `.woff`, `.woff2`) into a `fonts` folder at your vault root, or into `.obsidian/fonts`. Both are scanned automatically (you can also point the plugin at a custom folder).
2. Open the plugin settings and pick a font for each role you want to change.
3. Your fonts are applied instantly, across every platform.

## Key Features

### Three independent font roles

Set a different font for each part of Obsidian — or leave any of them on **Default** to keep Obsidian's own font:

- **Interface** — the base font for all of Obsidian (menus, sidebars, ribbons, settings).
- **Text** — note content in editing and reading views.
- **Monospace** — code blocks, inline code, and frontmatter.

### Font fallback chains (great for mixed scripts)

Each role is an **ordered list**, not a single font. Add several fonts and drag them to reorder — the browser uses the first font that has a glyph for each character. Perfect for pairing, say, a Latin display font with a Persian/Arabic font so both render correctly in the same line.

### Automatic multi-weight families

Drop in the individual weight files of a family (`Roboto-Regular.ttf`, `Roboto-Bold.ttf`, `Roboto-BoldItalic.ttf`, …) and the plugin **groups them into one family automatically** by reading the weight/style from each filename. Set the family once and **bold** text uses the Bold file, *italic* uses the Italic file — the browser resolves the right weight per character. Each file's weight is shown as a colored label right where you select it.

### Emoji support

When you override a font, Obsidian normally drops its emoji fallback — so this plugin re-appends cross-platform emoji fonts (Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji) to every font stack. Emojis keep rendering, always.

### Per-note fonts via CSS classes

Every loaded font also gets a utility class, `.font-<name>`. Apply a font to a **single note** by adding the class name to `cssclasses` in the note's frontmatter:

```yaml
---
cssclasses:
  - font-roboto
---
```

You can also wrap part of a note in a `<div class="font-roboto">`. The settings page lists every font's copyable **font-family name** (for your own CSS/snippets) and **class**.

### Load extra fonts

Only the fonts you actually use are loaded, keeping startup light. A collapsed **Load extra fonts** section lets you load additional fonts *just* to use via their CSS class, without applying them to any role.

### Force style

For community themes that hard-code fonts and ignore the standard variables, the **Force style** toggle adds `!important` to the fonts you applied so they win.

## Compatibility

This plugin leverages base64 encoding to ensure maximum compatibility across platforms. The chosen font works on all operating systems (Windows, macOS, Linux, Android, and iOS) without installing it on the device.

> Note: dynamic CSS is injected via constructable stylesheets (`adoptedStyleSheets`), which requires iOS/Safari 16.4+ on mobile.

## Web-based Font Converter

**[🌐 Font to Base64 CSS Converter](https://pourmand1376.github.io/obsidian-custom-font/)**

Convert font files to base64-encoded CSS without installing the plugin — perfect if you only want the conversion, or experience performance issues with the full plugin.

Features:
- Convert `.woff`, `.ttf`, `.woff2`, and `.otf` font files
- Multiple CSS output options (Obsidian variables, custom classes, force styles)
- Copy to clipboard or download CSS files
- No installation required — works in any modern browser

## Issues and Pull-Requests

Issues and pull requests are highly appreciated — I'd love to hear which features are useful to you.

# References

- [Embed fonts and images in your theme - Developer Documentation](https://docs.obsidian.md/Themes/App+themes/Embed+fonts+and+images+in+your+theme)
