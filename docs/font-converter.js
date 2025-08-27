// Font to Base64 CSS Converter
// Extracted from Obsidian Custom Font Plugin

class FontConverter {
    constructor() {
        this.selectedFiles = [];
        this.initializeEventListeners();
    }

    initializeEventListeners() {
        const fileInput = document.getElementById('fontFile');
        const convertBtn = document.getElementById('convertBtn');
        const copyBtn = document.getElementById('copyBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const cssTypeRadios = document.querySelectorAll('input[name="cssType"]');
        const customClassInput = document.getElementById('customClassInput');

        // File input change
        fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        
        // Drag and drop
        const dropZone = document.querySelector('.file-input-label');
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '#e7f3ff';
        });
        
        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '#f8f9fa';
        });
        
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.style.backgroundColor = '#f8f9fa';
            const files = Array.from(e.dataTransfer.files);
            this.processFiles(files);
        });

        // Convert button
        convertBtn.addEventListener('click', () => this.convertFonts());

        // Copy button
        copyBtn.addEventListener('click', () => this.copyToClipboard());

        // Download button
        downloadBtn.addEventListener('click', () => this.downloadCSS());

        // CSS type radio buttons
        cssTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customClassInput.style.display = 'block';
                } else {
                    customClassInput.style.display = 'none';
                }
            });
        });
    }

    handleFileSelection(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    processFiles(files) {
        // Filter for valid font files
        const validExtensions = ['.woff', '.ttf', '.woff2', '.otf'];
        const validFiles = files.filter(file => {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            return validExtensions.includes(extension);
        });

        if (validFiles.length === 0) {
            this.showMessage('Please select valid font files (.woff, .ttf, .woff2, .otf)', 'error');
            return;
        }

        this.selectedFiles = validFiles;
        this.displayFileInfo();
        document.getElementById('convertBtn').disabled = false;
    }

    displayFileInfo() {
        const fileInfo = document.getElementById('fileInfo');
        const fileList = this.selectedFiles.map(file => {
            const size = (file.size / 1024).toFixed(1);
            return `<li><strong>${file.name}</strong> (${size} KB)</li>`;
        }).join('');

        fileInfo.innerHTML = `
            <h4>Selected Files:</h4>
            <ul class="file-list">${fileList}</ul>
        `;
        fileInfo.classList.add('show');
    }

    async convertFonts() {
        const convertBtn = document.getElementById('convertBtn');
        const outputSection = document.getElementById('outputSection');
        const cssOutput = document.getElementById('cssOutput');

        // Show loading state
        convertBtn.innerHTML = '<span class="spinner"></span>Converting...';
        convertBtn.disabled = true;

        try {
            let combinedCSS = '';
            
            for (const file of this.selectedFiles) {
                const base64CSS = await this.convertSingleFont(file);
                combinedCSS += base64CSS + '\n\n';
            }

            // Add styling CSS based on selected option
            const cssType = document.querySelector('input[name="cssType"]:checked').value;
            const stylingCSS = this.generateStylingCSS(cssType);
            
            if (stylingCSS) {
                combinedCSS += stylingCSS;
            }

            cssOutput.value = combinedCSS.trim();
            outputSection.style.display = 'block';
            outputSection.scrollIntoView({ behavior: 'smooth' });
            
            this.showMessage('Fonts converted successfully!', 'success');

        } catch (error) {
            console.error('Conversion error:', error);
            this.showMessage('Error converting fonts: ' + error.message, 'error');
        } finally {
            convertBtn.innerHTML = 'Convert to CSS';
            convertBtn.disabled = false;
        }
    }

    async convertSingleFont(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const base64 = this.arrayBufferToBase64(arrayBuffer);
                    
                    const fontFamilyName = file.name.split('.')[0].toLowerCase();
                    const fontExtension = file.name.split('.').pop().toLowerCase();
                    
                    const cssType = this.getFontMimeType(fontExtension);
                    
                    const base64CSS = `@font-face {
    font-family: '${fontFamilyName}';
    src: url(data:${cssType};base64,${base64});
}`;
                    
                    resolve(base64CSS);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsArrayBuffer(file);
        });
    }

    arrayBufferToBase64(buffer) {
        let binary = '';
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    getFontMimeType(extension) {
        const mimeTypes = {
            'woff': 'font/woff',
            'ttf': 'font/truetype',
            'woff2': 'font/woff2',
            'otf': 'font/opentype'
        };
        return mimeTypes[extension] || 'font';
    }

    generateStylingCSS(cssType) {
        if (cssType === 'default') {
            // Generate default CSS for all fonts
            const fontFamilies = this.selectedFiles.map(file => 
                file.name.split('.')[0].toLowerCase()
            );
            
            if (fontFamilies.length === 1) {
                return this.getDefaultCSS(fontFamilies[0]);
            } else {
                // For multiple fonts, provide a template
                return `/* Default Obsidian CSS Variables */
/* Replace 'your-font-name' with one of: ${fontFamilies.join(', ')} */
:root {
    --font-default: 'your-font-name';
    --default-font: 'your-font-name';
    --font-family-editor: 'your-font-name';
    --font-monospace-default: 'your-font-name';
    --font-interface-override: 'your-font-name';
    --font-text-override: 'your-font-name';
    --font-monospace-override: 'your-font-name';
}`;
            }
        } else if (cssType === 'custom') {
            const customClassName = document.getElementById('customClassName').value.trim();
            if (!customClassName) {
                this.showMessage('Please enter a custom CSS class name', 'error');
                return '';
            }
            
            const fontFamilies = this.selectedFiles.map(file => 
                file.name.split('.')[0].toLowerCase()
            );
            
            if (fontFamilies.length === 1) {
                return this.getCustomCSS(fontFamilies[0], customClassName);
            } else {
                return `/* Custom CSS Class */
/* Replace 'your-font-name' with one of: ${fontFamilies.join(', ')} */
${customClassName} {
    font-family: 'your-font-name' !important;
}`;
            }
        } else if (cssType === 'force') {
            const fontFamilies = this.selectedFiles.map(file => 
                file.name.split('.')[0].toLowerCase()
            );
            
            if (fontFamilies.length === 1) {
                return `/* Force style for all elements */
* {
    font-family: '${fontFamilies[0]}' !important;
}`;
            } else {
                return `/* Force style for all elements */
/* Replace 'your-font-name' with one of: ${fontFamilies.join(', ')} */
* {
    font-family: 'your-font-name' !important;
}`;
            }
        }
        
        return '';
    }

    getDefaultCSS(fontFamilyName) {
        return `:root {
    --font-default: '${fontFamilyName}';
    --default-font: '${fontFamilyName}';
    --font-family-editor: '${fontFamilyName}';
    --font-monospace-default: '${fontFamilyName}';
    --font-interface-override: '${fontFamilyName}';
    --font-text-override: '${fontFamilyName}';
    --font-monospace-override: '${fontFamilyName}';
}`;
    }

    getCustomCSS(fontFamilyName, cssClass) {
        return `${cssClass} {
    font-family: '${fontFamilyName}' !important;
}`;
    }

    async copyToClipboard() {
        const cssOutput = document.getElementById('cssOutput');
        try {
            await navigator.clipboard.writeText(cssOutput.value);
            this.showMessage('CSS copied to clipboard!', 'success');
        } catch (error) {
            // Fallback for older browsers
            cssOutput.select();
            document.execCommand('copy');
            this.showMessage('CSS copied to clipboard!', 'success');
        }
    }

    downloadCSS() {
        const cssOutput = document.getElementById('cssOutput');
        const fileName = this.selectedFiles.length === 1 
            ? `${this.selectedFiles[0].name.split('.')[0]}-font.css`
            : 'custom-fonts.css';
        
        const blob = new Blob([cssOutput.value], { type: 'text/css' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showMessage(`CSS file downloaded as ${fileName}`, 'success');
    }

    showMessage(message, type) {
        // Remove any existing messages
        const existingMessages = document.querySelectorAll('.message');
        existingMessages.forEach(msg => msg.remove());

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;

        const uploadSection = document.querySelector('.upload-section');
        uploadSection.insertBefore(messageDiv, uploadSection.firstChild);

        // Auto-remove message after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
}

// Initialize the converter when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new FontConverter();
});