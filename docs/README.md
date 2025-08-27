# Font to Base64 CSS Converter

A web-based tool that converts font files (.woff, .ttf, .woff2, .otf) to base64-encoded CSS for use with Obsidian. This tool extracts the core font conversion functionality from the [Obsidian Custom Font Plugin](https://github.com/pourmand1376/obsidian-custom-font) and makes it available as a standalone web application.

## Live Demo

🌐 **[Use the converter here](https://pourmand1376.github.io/obsidian-custom-font/)**

## Features

- **Multiple font format support**: .woff, .ttf, .woff2, and .otf files
- **Drag & drop interface**: Easy file upload with visual feedback
- **Multiple CSS output options**:
  - Default CSS (Obsidian CSS variables)
  - Custom CSS class
  - Force style (applies to all elements)
- **Batch processing**: Convert multiple fonts at once
- **Copy to clipboard**: One-click copying of generated CSS
- **Download option**: Save CSS as a file for later use
- **Mobile friendly**: Responsive design that works on all devices

## How to Use

1. **Upload fonts**: Select or drag and drop your font files
2. **Choose output format**: Select how you want the CSS structured
3. **Convert**: Click the "Convert to CSS" button
4. **Copy or download**: Get your base64-encoded CSS ready for use

## For Obsidian Users

1. Copy the generated CSS
2. Save it as a `.css` file in your vault's `.obsidian/snippets/` folder
3. Enable the CSS snippet in Obsidian's Appearance settings

## Why Use This Tool?

This web-based converter is perfect for:
- Users who only need font conversion without the full plugin
- Those experiencing performance issues with the complete plugin
- Quick one-time font conversions
- Users who prefer lightweight solutions

## Technical Details

The converter uses the same core logic as the Obsidian Custom Font Plugin:
- Reads font files as ArrayBuffer
- Converts to base64 encoding
- Generates proper CSS @font-face declarations
- Provides appropriate MIME types for each font format

## Privacy

All processing happens locally in your browser. Font files are never uploaded to any server, ensuring your fonts remain private and secure.

## Related

- [Obsidian Custom Font Plugin](https://github.com/pourmand1376/obsidian-custom-font) - The full plugin this tool is based on
- [GitHub Issue #23](https://github.com/pourmand1376/obsidian-custom-font/issues/23) - The request that inspired this tool