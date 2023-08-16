.PHONY: help
help:
	@egrep -h '\s##\s' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m  %-30s\033[0m %s\n", $$1, $$2}'

VERSION=1.0.2
download_files: ## download new releases
# developer commands to get new releases directly from github and install it in obsidian repo
	rm mainfest.json
	rm main.js
	wget https://github.com/pourmand1376/obsidian-custom-font/releases/download/$(VERSION)/main.js
	wget https://github.com/pourmand1376/obsidian-custom-font/releases/download/$(VERSION)/manifest.json

.PHONY: dev
dev: ## run dev
	npm run dev

.PHONY: build
build: ## run build
	npm run build