# Integration Tests

Integration tests for PigQuery that run against a real Chrome instance with the extension installed.

## Prerequisites

1. **Chrome installed** at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` (macOS)
2. **Extension profile** - The tests use the Chrome profile at `profile/` directory in the project root
3. **BigQuery access** - You must be logged into BigQuery in the Chrome profile
4. **Extension installed** - The PigQuery extension must be installed

## Running Integration Tests

### Run all integration tests

```bash
npm run integration
```

### Run in CI mode (uses local BigQuery HTML fixture instead of real BigQuery)

```bash
npm run integration:ci
```

### Run a specific integration test file

```bash
npm run integration -- src/__tests__/integration/share-query.test.js
```
