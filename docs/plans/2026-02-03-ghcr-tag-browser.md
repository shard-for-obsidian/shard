# GHCR Tag Browser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an Obsidian plugin that allows users to browse available tags for GHCR repositories through a command palette command and view tag metadata.

**Architecture:** Plugin registers a command that opens a modal with two-pane layout. Left pane shows tag list fetched via existing `GHCRClient`. Right pane shows selected tag metadata (digest, size). Settings allow optional GitHub token configuration. GHCR wrapper normalizes URLs and handles client instantiation.

**Tech Stack:** TypeScript, Obsidian API, existing GHCRClient from `lib/client/`

---

## Task 1: Project Setup and Type Definitions

**Files:**
- Create: `src/types.ts`
- Create: `src/settings.ts`

**Step 1: Create type definitions**

Create `src/types.ts`:

```typescript
export interface GHCRPluginSettings {
	githubToken: string;
}

export const DEFAULT_SETTINGS: GHCRPluginSettings = {
	githubToken: ''
};

export interface TagMetadata {
	tag: string;
	digest: string;
	size: number;
}

export interface ParsedRepo {
	fullUrl: string;
	owner: string;
	repo: string;
}
```

**Step 2: Create settings class**

Create `src/settings.ts`:

```typescript
import { App, PluginSettingTab, Setting } from 'obsidian';
import type GHCRTagBrowserPlugin from './main';

export class GHCRSettingTab extends PluginSettingTab {
	plugin: GHCRTagBrowserPlugin;

	constructor(app: App, plugin: GHCRTagBrowserPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: 'GHCR Tag Browser Settings' });

		new Setting(containerEl)
			.setName('GitHub Token')
			.setDesc('Optional personal access token for private repositories')
			.addText(text => text
				.setPlaceholder('ghp_...')
				.setValue(this.plugin.settings.githubToken)
				.onChange(async (value) => {
					this.plugin.settings.githubToken = value;
					await this.plugin.saveSettings();
				}));

		// Make the input a password field
		const tokenInput = containerEl.querySelector('input[type="text"]');
		if (tokenInput) {
			tokenInput.setAttribute('type', 'password');
		}
	}
}
```

**Step 3: Commit initial types and settings**

```bash
git add src/types.ts src/settings.ts
git commit -m "feat: add type definitions and settings tab"
```

---

## Task 2: GHCR Wrapper - URL Normalization

**Files:**
- Create: `src/ghcr-wrapper.ts`
- Modify: `lib/client/common.mts` (read only, to understand parseRepoAndRef)

**Step 1: Read existing parseRepoAndRef function**

Read `lib/client/common.mts` to understand how `parseRepoAndRef` works.

**Step 2: Create GHCR wrapper with URL normalization**

Create `src/ghcr-wrapper.ts`:

```typescript
import { parseRepoAndRef } from '../lib/client/common.mjs';
import { GHCRClient } from '../lib/client/registry-client.mjs';
import type { RequestUrlParam, RequestUrlResponse, RegistryRepo } from '../lib/client/types.mjs';
import type { TagMetadata } from './types';
import { requestUrl } from 'obsidian';

export class GHCRWrapper {
	/**
	 * Normalize repository URL to full ghcr.io format
	 * Examples:
	 * - "owner/repo" -> "ghcr.io/owner/repo"
	 * - "ghcr.io/owner/repo" -> "ghcr.io/owner/repo"
	 * - "https://ghcr.io/owner/repo" -> "ghcr.io/owner/repo"
	 * - "ghcr.io/owner/repo:tag" -> "ghcr.io/owner/repo:latest"
	 */
	static normalizeRepoUrl(input: string): string {
		// Remove protocol if present
		let normalized = input.replace(/^https?:\/\//, '');

		// Add ghcr.io prefix if not present
		if (!normalized.startsWith('ghcr.io/')) {
			normalized = `ghcr.io/${normalized}`;
		}

		// Add :latest if no tag/digest specified
		if (!normalized.includes(':') && !normalized.includes('@')) {
			normalized = `${normalized}:latest`;
		}

		return normalized;
	}

	/**
	 * Adapt Obsidian's requestUrl to the format expected by GHCRClient
	 */
	static async obsidianRequestUrl(
		request: RequestUrlParam | string
	): Promise<RequestUrlResponse> {
		const req = typeof request === 'string' ? { url: request } : request;

		const response = await requestUrl({
			url: req.url,
			method: req.method || 'GET',
			headers: req.headers,
			body: req.body instanceof ArrayBuffer ? req.body : undefined,
		});

		return {
			status: response.status,
			headers: response.headers,
			arrayBuffer: response.arrayBuffer,
			json: response.json,
			text: response.text,
		};
	}

	/**
	 * Create a GHCRClient instance for the given repository
	 */
	static createClient(repoUrl: string, token?: string): GHCRClient {
		const normalized = this.normalizeRepoUrl(repoUrl);
		const repo = parseRepoAndRef(normalized);

		return new GHCRClient({
			repo: repo,
			insecure: false,
			username: token ? 'github' : undefined,
			password: token || undefined,
			acceptOCIManifests: true,
			requestUrl: this.obsidianRequestUrl,
		});
	}

	/**
	 * Fetch all tags for a repository
	 */
	static async getTags(repoUrl: string, token?: string): Promise<string[]> {
		const client = this.createClient(repoUrl, token);
		const tagList = await client.listAllTags();
		return tagList.tags.sort();
	}

	/**
	 * Fetch metadata for a specific tag
	 */
	static async getTagMetadata(
		repoUrl: string,
		tag: string,
		token?: string
	): Promise<TagMetadata> {
		const client = this.createClient(repoUrl, token);
		const { resp, manifest } = await client.getManifest({ ref: tag });

		// Calculate total size from layers
		const size = manifest.layers?.reduce((sum, layer) => sum + (layer.size || 0), 0) || 0;

		// Get digest from header or calculate it
		const digest = resp.headers['docker-content-digest'] || 'unknown';

		return {
			tag,
			digest,
			size,
		};
	}
}
```

**Step 3: Commit GHCR wrapper**

```bash
git add src/ghcr-wrapper.ts
git commit -m "feat: add GHCR wrapper with URL normalization"
```

---

## Task 3: Tag Browser Modal - Basic Structure

**Files:**
- Create: `src/tag-browser-modal.ts`

**Step 1: Create modal skeleton with two-pane layout**

Create `src/tag-browser-modal.ts`:

```typescript
import { App, Modal } from 'obsidian';
import type { GHCRPluginSettings, TagMetadata } from './types';
import { GHCRWrapper } from './ghcr-wrapper';

export class TagBrowserModal extends Modal {
	settings: GHCRPluginSettings;

	private repoInput: HTMLInputElement;
	private tokenInput: HTMLInputElement;
	private fetchButton: HTMLButtonElement;
	private leftPane: HTMLDivElement;
	private rightPane: HTMLDivElement;
	private errorContainer: HTMLDivElement;

	private currentRepo: string = '';
	private selectedTag: string | null = null;

	constructor(app: App, settings: GHCRPluginSettings) {
		super(app);
		this.settings = settings;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('ghcr-tag-browser-modal');

		// Header section
		const header = contentEl.createDiv('ghcr-header');

		this.repoInput = header.createEl('input', {
			type: 'text',
			placeholder: 'Enter repository (e.g., owner/repo or ghcr.io/owner/repo)',
			cls: 'ghcr-repo-input'
		});

		this.fetchButton = header.createEl('button', {
			text: 'Fetch Tags',
			cls: 'ghcr-fetch-button'
		});

		// Optional token override
		const tokenToggle = header.createDiv('ghcr-token-toggle');
		const toggleButton = tokenToggle.createEl('button', {
			text: 'Use different token',
			cls: 'ghcr-toggle-token-button'
		});

		const tokenContainer = header.createDiv('ghcr-token-container');
		tokenContainer.style.display = 'none';

		this.tokenInput = tokenContainer.createEl('input', {
			type: 'password',
			placeholder: 'GitHub token (optional)',
			cls: 'ghcr-token-input'
		});

		toggleButton.addEventListener('click', () => {
			const isHidden = tokenContainer.style.display === 'none';
			tokenContainer.style.display = isHidden ? 'block' : 'none';
		});

		// Error container
		this.errorContainer = contentEl.createDiv('ghcr-error-container');
		this.errorContainer.style.display = 'none';

		// Two-pane layout
		const panesContainer = contentEl.createDiv('ghcr-panes-container');

		this.leftPane = panesContainer.createDiv('ghcr-left-pane');
		this.leftPane.createEl('p', { text: 'Enter a repository to browse tags', cls: 'ghcr-empty-state' });

		this.rightPane = panesContainer.createDiv('ghcr-right-pane');
		this.rightPane.createEl('p', { text: 'Select a tag to view details', cls: 'ghcr-empty-state' });

		// Event listeners
		this.fetchButton.addEventListener('click', () => this.fetchTags());
		this.repoInput.addEventListener('keypress', (e) => {
			if (e.key === 'Enter') this.fetchTags();
		});
	}

	private async fetchTags() {
		const repo = this.repoInput.value.trim();
		if (!repo) {
			this.showError('Please enter a repository URL');
			return;
		}

		this.currentRepo = repo;
		this.selectedTag = null;
		this.hideError();
		this.showLoading(this.leftPane, 'Fetching tags...');
		this.clearPane(this.rightPane);
		this.rightPane.createEl('p', { text: 'Select a tag to view details', cls: 'ghcr-empty-state' });

		try {
			const token = this.tokenInput.value.trim() || this.settings.githubToken;
			const tags = await GHCRWrapper.getTags(repo, token);

			if (tags.length === 0) {
				this.showEmptyTags();
			} else {
				this.renderTagList(tags);
			}
		} catch (error) {
			this.showError(this.formatError(error));
		}
	}

	private async selectTag(tag: string) {
		this.selectedTag = tag;
		this.showLoading(this.rightPane, 'Loading tag details...');

		try {
			const token = this.tokenInput.value.trim() || this.settings.githubToken;
			const metadata = await GHCRWrapper.getTagMetadata(this.currentRepo, tag, token);
			this.renderTagDetails(metadata);
		} catch (error) {
			this.showErrorInPane(this.rightPane, this.formatError(error));
		}
	}

	private renderTagList(tags: string[]) {
		this.clearPane(this.leftPane);

		const list = this.leftPane.createDiv('ghcr-tag-list');

		tags.forEach(tag => {
			const item = list.createDiv('ghcr-tag-item');
			item.textContent = tag;
			item.addEventListener('click', () => {
				// Remove previous selection
				list.querySelectorAll('.ghcr-tag-item-selected').forEach(el => {
					el.removeClass('ghcr-tag-item-selected');
				});
				// Add selection to clicked item
				item.addClass('ghcr-tag-item-selected');
				this.selectTag(tag);
			});
		});
	}

	private renderTagDetails(metadata: TagMetadata) {
		this.clearPane(this.rightPane);

		this.rightPane.createEl('h3', { text: `Tag: ${metadata.tag}` });

		const details = this.rightPane.createDiv('ghcr-tag-details');

		// Digest
		const digestRow = details.createDiv('ghcr-detail-row');
		digestRow.createEl('strong', { text: 'Digest: ' });
		const digestValue = digestRow.createEl('code', { text: metadata.digest });
		digestValue.title = metadata.digest; // Tooltip with full digest

		// Size
		const sizeRow = details.createDiv('ghcr-detail-row');
		sizeRow.createEl('strong', { text: 'Size: ' });
		sizeRow.createEl('span', { text: this.formatSize(metadata.size) });
	}

	private showLoading(pane: HTMLElement, message: string) {
		this.clearPane(pane);
		const loading = pane.createDiv('ghcr-loading');
		loading.createEl('div', { cls: 'ghcr-spinner' });
		loading.createEl('p', { text: message });
	}

	private showEmptyTags() {
		this.clearPane(this.leftPane);
		this.leftPane.createEl('p', { text: 'No tags found for this repository', cls: 'ghcr-empty-state' });
	}

	private showError(message: string) {
		this.errorContainer.style.display = 'block';
		this.errorContainer.textContent = message;
		this.errorContainer.addClass('ghcr-error');
	}

	private hideError() {
		this.errorContainer.style.display = 'none';
		this.errorContainer.textContent = '';
	}

	private showErrorInPane(pane: HTMLElement, message: string) {
		this.clearPane(pane);
		pane.createEl('p', { text: message, cls: 'ghcr-error' });
	}

	private clearPane(pane: HTMLElement) {
		pane.empty();
	}

	private formatSize(bytes: number): string {
		if (bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	private formatError(error: unknown): string {
		if (error instanceof Error) {
			const message = error.message.toLowerCase();

			// Check for specific error types
			if (message.includes('401') || message.includes('unauthorized')) {
				return 'Authentication failed. Check your GitHub token in settings.';
			}
			if (message.includes('404') || message.includes('not found')) {
				return `Repository not found: ${this.currentRepo}`;
			}
			if (message.includes('network') || message.includes('fetch')) {
				return 'Failed to connect to ghcr.io. Check your connection.';
			}
			if (message.includes('rate limit')) {
				return 'Rate limited by registry. Try again later.';
			}

			return `Error: ${error.message}`;
		}
		return 'An unknown error occurred';
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
```

**Step 2: Commit modal implementation**

```bash
git add src/tag-browser-modal.ts
git commit -m "feat: add tag browser modal with two-pane layout"
```

---

## Task 4: Main Plugin Class

**Files:**
- Create: `src/main.ts`
- Modify: `package.json` (add main field)

**Step 1: Create main plugin class**

Create `src/main.ts`:

```typescript
import { Plugin } from 'obsidian';
import { GHCRSettingTab } from './settings';
import { TagBrowserModal } from './tag-browser-modal';
import { DEFAULT_SETTINGS, type GHCRPluginSettings } from './types';

export default class GHCRTagBrowserPlugin extends Plugin {
	settings: GHCRPluginSettings;

	async onload() {
		await this.loadSettings();

		// Register command
		this.addCommand({
			id: 'browse-ghcr-tags',
			name: 'Browse GHCR Tags',
			callback: () => {
				new TagBrowserModal(this.app, this.settings).open();
			}
		});

		// Add settings tab
		this.addSettingTab(new GHCRSettingTab(this.app, this));
	}

	onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
```

**Step 2: Update package.json**

Modify `package.json` to add main field and scripts:

```json
{
  "name": "obsidian-ghcr-tag-browser",
  "version": "0.1.0",
  "description": "Browse GHCR repository tags in Obsidian",
  "main": "src/main.ts",
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@cloudydeno/docker-registry-client": "npm:@jsr/cloudydeno__docker-registry-client@^0.7.0",
    "@deno/shim-deno": "^0.19.2",
    "obsidian": "^1.11.4",
    "tslib": "^2.8.1"
  },
  "devDependencies": {
    "@types/node": "^25.2.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 3: Commit main plugin class**

```bash
git add src/main.ts package.json
git commit -m "feat: add main plugin class and command registration"
```

---

## Task 5: Add Basic Styles

**Files:**
- Create: `styles.css`

**Step 1: Create styles for modal**

Create `styles.css`:

```css
/* Modal container */
.ghcr-tag-browser-modal .modal-content {
	padding: 20px;
	min-height: 500px;
}

/* Header */
.ghcr-header {
	margin-bottom: 15px;
}

.ghcr-repo-input {
	width: 60%;
	padding: 8px;
	margin-right: 10px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 4px;
}

.ghcr-fetch-button {
	padding: 8px 16px;
	cursor: pointer;
}

.ghcr-token-toggle {
	margin-top: 10px;
}

.ghcr-toggle-token-button {
	font-size: 0.9em;
	padding: 4px 8px;
	cursor: pointer;
}

.ghcr-token-container {
	margin-top: 8px;
}

.ghcr-token-input {
	width: 60%;
	padding: 8px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 4px;
}

/* Error container */
.ghcr-error-container {
	padding: 10px;
	margin-bottom: 10px;
	border-radius: 4px;
	background-color: var(--background-modifier-error);
	color: var(--text-error);
}

.ghcr-error {
	color: var(--text-error);
}

/* Panes container */
.ghcr-panes-container {
	display: flex;
	gap: 20px;
	height: 400px;
}

.ghcr-left-pane {
	width: 40%;
	border: 1px solid var(--background-modifier-border);
	border-radius: 4px;
	padding: 10px;
	overflow-y: auto;
}

.ghcr-right-pane {
	width: 60%;
	border: 1px solid var(--background-modifier-border);
	border-radius: 4px;
	padding: 10px;
	overflow-y: auto;
}

/* Tag list */
.ghcr-tag-list {
	display: flex;
	flex-direction: column;
	gap: 5px;
}

.ghcr-tag-item {
	padding: 8px;
	cursor: pointer;
	border-radius: 4px;
	transition: background-color 0.2s;
}

.ghcr-tag-item:hover {
	background-color: var(--background-modifier-hover);
}

.ghcr-tag-item-selected {
	background-color: var(--background-modifier-active-hover);
	font-weight: bold;
}

/* Tag details */
.ghcr-tag-details {
	margin-top: 15px;
}

.ghcr-detail-row {
	margin-bottom: 10px;
	word-break: break-all;
}

.ghcr-detail-row code {
	font-family: var(--font-monospace);
	background-color: var(--code-background);
	padding: 2px 4px;
	border-radius: 3px;
	font-size: 0.9em;
}

/* Loading */
.ghcr-loading {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
}

.ghcr-spinner {
	border: 4px solid var(--background-modifier-border);
	border-top: 4px solid var(--interactive-accent);
	border-radius: 50%;
	width: 40px;
	height: 40px;
	animation: spin 1s linear infinite;
	margin-bottom: 10px;
}

@keyframes spin {
	0% { transform: rotate(0deg); }
	100% { transform: rotate(360deg); }
}

/* Empty state */
.ghcr-empty-state {
	text-align: center;
	color: var(--text-muted);
	padding: 20px;
}
```

**Step 2: Commit styles**

```bash
git add styles.css
git commit -m "feat: add modal styles"
```

---

## Task 6: Create Plugin Manifest

**Files:**
- Create: `manifest.json`

**Step 1: Create manifest file**

Create `manifest.json`:

```json
{
	"id": "ghcr-tag-browser",
	"name": "GHCR Tag Browser",
	"version": "0.1.0",
	"minAppVersion": "1.0.0",
	"description": "Browse available tags for GitHub Container Registry repositories",
	"author": "Your Name",
	"authorUrl": "https://github.com/yourusername",
	"isDesktopOnly": false
}
```

**Step 2: Commit manifest**

```bash
git add manifest.json
git commit -m "feat: add plugin manifest"
```

---

## Task 7: Update TypeScript Configuration

**Files:**
- Modify: `tsconfig.json`

**Step 1: Update tsconfig for plugin compilation**

Modify `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "baseUrl": ".",
    "paths": {
      "obsidian": ["node_modules/obsidian/obsidian.d.ts"]
    }
  },
  "include": ["src/**/*.ts", "lib/**/*.mts"],
  "exclude": ["node_modules"]
}
```

**Step 2: Commit tsconfig update**

```bash
git add tsconfig.json
git commit -m "chore: update tsconfig for plugin compilation"
```

---

## Task 8: Add Build Configuration

**Files:**
- Create: `esbuild.config.mjs`
- Modify: `package.json` (update scripts)

**Step 1: Create esbuild configuration**

Create `esbuild.config.mjs`:

```javascript
import esbuild from 'esbuild';
import process from 'process';

const prod = process.argv[2] === 'production';

esbuild.build({
	entryPoints: ['src/main.ts'],
	bundle: true,
	external: ['obsidian'],
	format: 'cjs',
	target: 'es2020',
	outfile: 'main.js',
	sourcemap: prod ? false : 'inline',
	minify: prod,
	logLevel: 'info',
}).catch(() => process.exit(1));
```

**Step 2: Update package.json scripts**

Modify `package.json`:

```json
{
  "name": "obsidian-ghcr-tag-browser",
  "version": "0.1.0",
  "description": "Browse GHCR repository tags in Obsidian",
  "main": "main.js",
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "node esbuild.config.mjs production"
  },
  "dependencies": {
    "@cloudydeno/docker-registry-client": "npm:@jsr/cloudydeno__docker-registry-client@^0.7.0",
    "@deno/shim-deno": "^0.19.2",
    "obsidian": "^1.11.4",
    "tslib": "^2.8.1"
  },
  "devDependencies": {
    "@types/node": "^25.2.0",
    "esbuild": "^0.24.0",
    "typescript": "^5.0.0"
  }
}
```

**Step 3: Install esbuild**

```bash
npm install --save-dev esbuild
```

**Step 4: Commit build configuration**

```bash
git add esbuild.config.mjs package.json package-lock.json
git commit -m "chore: add esbuild configuration"
```

---

## Task 9: Test Build and Integration

**Files:**
- Build output: `main.js`
- Test: All components together

**Step 1: Run build**

```bash
npm run build
```

Expected: `main.js` created successfully with no errors

**Step 2: Verify build output**

```bash
ls -lh main.js
```

Expected: `main.js` exists and has reasonable size (should be > 100KB due to bundled dependencies)

**Step 3: Create README for testing instructions**

Create `README.md`:

```markdown
# GHCR Tag Browser Plugin

Browse available tags for GitHub Container Registry repositories directly in Obsidian.

## Installation

1. Copy `main.js`, `manifest.json`, and `styles.css` to your vault's plugins folder: `<vault>/.obsidian/plugins/ghcr-tag-browser/`
2. Reload Obsidian
3. Enable the plugin in Settings → Community Plugins

## Usage

1. Open command palette (Ctrl/Cmd + P)
2. Run "Browse GHCR Tags"
3. Enter a repository URL (e.g., `gillisandrew/dragonglass-poc` or `ghcr.io/owner/repo`)
4. Click "Fetch Tags" or press Enter
5. Click on a tag to view its metadata

## Settings

Configure an optional GitHub personal access token in Settings → GHCR Tag Browser for accessing private repositories.

## Development

```bash
# Install dependencies
npm install

# Build plugin
npm run build

# Development build with sourcemaps
npm run dev
```

## Features

- Browse tags for any GHCR repository
- View tag metadata (digest, size)
- Support for private repositories via GitHub token
- Flexible URL input (with or without ghcr.io prefix)
```

**Step 4: Commit README**

```bash
git add README.md main.js
git commit -m "docs: add README and initial build output"
```

---

## Task 10: Final Testing and Verification

**Files:**
- Verify: All components work together

**Step 1: Manual testing checklist**

To test this plugin in Obsidian:

1. Copy built files to test vault:
   ```bash
   # Create plugin directory in a test vault
   mkdir -p /path/to/test-vault/.obsidian/plugins/ghcr-tag-browser
   cp main.js manifest.json styles.css /path/to/test-vault/.obsidian/plugins/ghcr-tag-browser/
   ```

2. Test cases to verify:
   - [ ] Plugin loads without errors
   - [ ] Command appears in command palette
   - [ ] Modal opens correctly
   - [ ] Can fetch tags for public repository (e.g., `gillisandrew/dragonglass-poc`)
   - [ ] Tag list displays correctly
   - [ ] Can select a tag and view details
   - [ ] Error handling works for invalid repository
   - [ ] Settings tab appears and saves token
   - [ ] Token override field toggles correctly

**Step 2: Document any issues found**

Create `TESTING.md` to track testing results:

```markdown
# Testing Results

## Test Environment
- Obsidian Version: [version]
- Plugin Version: 0.1.0
- Date: [date]

## Test Cases

### Basic Functionality
- [ ] Plugin loads
- [ ] Command registered
- [ ] Modal opens

### Tag Fetching
- [ ] Public repo tags load
- [ ] Private repo with token
- [ ] Error handling for invalid repo

### UI/UX
- [ ] Tag selection highlights
- [ ] Details display correctly
- [ ] Loading states show
- [ ] Error messages clear

## Known Issues
[List any issues found]

## Next Steps
[List improvements or fixes needed]
```

**Step 3: Final commit**

```bash
git add TESTING.md
git commit -m "test: add testing documentation and verification"
```

**Step 4: Tag release**

```bash
git tag v0.1.0
```

---

## Summary

The implementation plan covers:

1. ✅ Type definitions and settings infrastructure
2. ✅ GHCR wrapper with URL normalization and client management
3. ✅ Two-pane modal UI with tag browsing and details
4. ✅ Main plugin class with command registration
5. ✅ Styling for professional appearance
6. ✅ Build configuration with esbuild
7. ✅ Documentation and testing instructions

The plugin follows YAGNI principles - no unnecessary features like tag caching, comparison views, or multiple registry support. It focuses solely on browsing GHCR tags and viewing basic metadata.

Each task is broken into small commits following conventional commit format. The implementation uses TDD principles where applicable, though Obsidian plugin testing requires manual verification due to the plugin API dependencies.
