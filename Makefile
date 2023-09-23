#!/bin/bash

.PHONY: help
help:
	@egrep -h '\s##\s' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m  %-30s\033[0m %s\n", $$1, $$2}'

download_files: ## download new releases
# developer commands to get new releases directly from github and install it in obsidian repo
	wget https://github.com/pourmand1376/obsidian-custom-font/releases/download/$(VERSION)/main.js -O main.js
	wget https://github.com/pourmand1376/obsidian-custom-font/releases/download/$(VERSION)/manifest.json -O manifest.json

.PHONY: dev
dev: ## run dev
	npm run dev

.PHONY: build
build: ## run build
	npm run build

install_es_lint: ## install linter
	npm install -g eslint

lint: ## lint main.ts file
	eslint main.ts

alpha_version: ## create an alpha version
	npm version prerelease --preid=alpha
	git add .
	git commit --amend --no-edit
	git push
	make prerelease

ALPHA_VERSION=$(shell jq -r '.version' manifest-beta.json)
prerelease: ## make a prerelease
	echo "Version is $(ALPHA_VERSION)"
	git tag $(ALPHA_VERSION) --force
	git push origin $(ALPHA_VERSION) --force


patch_version: ## create a new patch version
	npm version patch
	git push
	make release

minor_version: ## create a new minor version
	npm version minor
	git push
	make release

major_version: ## create a new major version
	npm version major
	git push
	make release

VERSION=$(shell jq -r '.version' manifest.json)
release: ## create and push tags (release)
	echo "Version is $(VERSION)"
	git tag $(VERSION) --force
	git push origin $(VERSION) --force