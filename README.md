# <picture><img src="icons/icon.svg" height="32px"></img></picture> PigQuery

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

## Demo video & screenshots

### Setup

1. Install Playwright:
   ```bash
   npm install
   npx playwright install ffmpeg
   ```

2. Set up a local Chrome profile:
   - Run the script once:
     ```bash
     node scripts/bot.js open
     ```
   - In the Chrome window that opens:
     - Log in to BigQuery
     - Go to chrome://extensions
     - Enable "Developer mode"
     - Click "Load unpacked" and select this project directory
   - Close Chrome

**Note:** The profile is saved locally in the `profile/` directory.

### Recording a demo video and taking screenshots

```bash
node scripts/bot.js record --lang en
node scripts/bot.js record --lang de
```
