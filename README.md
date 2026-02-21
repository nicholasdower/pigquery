# <picture><img src="icons-prod/icon.svg" height="32px"></img></picture> PigQuery

## Intro

A Chrome Extension offering some BigQuery enhancements.

[<img src="embed.jpg" width="800"/>](https://www.youtube.com/watch?v=0iEPxfJW-x0)

## Features

- Insert saved queries and query snippets.
- Share queries via URL without saving.
- Open external sites related to table cell data.
- Copy table cell content to clipboard.
- Parse/format table cell content.

## Screenshots

<img src="store/en/pigquery-1.jpg" width="300"> <img src="store/en/pigquery-2.jpg" width="300"> <img src="store/en/pigquery-3.jpg" width="300">

## Development

### Setup for development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the extension:

   ```bash
   npm run build
   ```

   This bundles all source files and dependencies into the `dist/` directory using esbuild.

3. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked"
   - Select the project root directory (contains `manifest.json`)

4. Development workflow:
   - After making changes to source files, run `npm run build` to rebuild
   - Click the extension icon to open the popup, which includes a "Reload Extension" button in the Developer section
   - Use this button to quickly reload the extension without visiting `chrome://extensions`

### Build commands

```bash
# Development build (with sourcemaps)
npm run build

# Production build (minified, no sourcemaps)
npm run build:prod

# Watch mode (auto-rebuild on file changes)
npm run watch
```

### Code quality

```bash
# Check for linting issues
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Check code formatting
npm run format:check

# Auto-format code
npm run format
```

### Testing

```bash
# Run unit tests
npm test

# Run tests in watch mode (auto-rerun on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run integration tests
npm run integration

# Run integration tests in CI mode
npm run integration:ci
```

### Build for distribution

To create a production build and pack the extension:

```bash
npm run pack
```

**Requirements:**

- The `privatekey` file must exist in the project root (used to sign the `.crx`)
- Chrome must be installed at `/Applications/Google Chrome.app/` (macOS)

**What it does:**

1. Runs `npm run build:prod` to create minified bundles in `dist/`
2. Creates a `build/dev/` directory with:
   - Bundled files from `dist/`
   - Manifest, icons, locales, and license files
3. Uses Chrome to create a signed `.crx` file: `pigquery-{version}.crx`

**Testing the production build:**
You can test the production build by loading the `build/prod/` directory unpacked in Chrome.

## Demo video & screenshots

### Setup

1. Install Playwright:

   ```bash
   npm install
   npx playwright install ffmpeg
   ```

2. Set up a local Chrome profile:
   - Build the extension first:
     ```bash
     npm run build
     ```
   - Run the script once:
     ```bash
     npm run browser
     ```
   - In the Chrome window that opens:
     - Log in to BigQuery
     - Go to chrome://extensions
     - Enable "Developer mode"
     - Click "Load unpacked" and select the project root directory
   - Close Chrome

**Note:** The profile is saved locally in the `profile/` directory.

### Recording a demo video and taking screenshots

```bash
npm run record -- --lang en
npm run record -- --lang de
```
