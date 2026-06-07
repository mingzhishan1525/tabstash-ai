# Chrome Store Test Instructions - TabStash AI

## Test Setup

1. Install the submitted Chrome extension package.
2. Make sure the TabStash AI backend API is reachable from the review machine.
3. Prepare a Notion test database with these properties:
   - `Name` or another title property: Title
   - `URL`: URL
   - `Brief`: Rich Text
   - `Tags`: Multi-select
   - `Source`: Select
   - `Created`: Date
4. Share the Notion database with the Notion internal integration used for testing.

## Open The Side Panel

1. Open any normal HTTPS webpage.
2. Click the TabStash AI extension icon in the Chrome toolbar.
3. Confirm the Chrome side panel opens and shows the TabStash AI Inbox.

## Test Stash Tab

1. Open a readable article or documentation page.
2. Click `Stash Tab` in the TabStash AI side panel.
3. Confirm the selected page is saved to the Inbox.
4. Confirm the original tab closes only after the item is saved.
5. Confirm the saved item includes title and source URL.

## Test All Tabs

1. Open several normal HTTPS webpages in the same Chrome window.
2. Click `All Tabs` in the TabStash AI side panel.
3. Confirm each selected tab is saved into the Inbox.
4. Confirm the original tabs close after saving.
5. Confirm saved items remain visible after reopening the side panel.

## Configure Notion Test Database

1. Open TabStash AI Settings.
2. Enter the Notion internal integration token.
3. Enter the Notion database ID for the test database.
4. Click the Notion connection test.
5. Confirm the connection succeeds before testing Notion sync.

## Verify AI Summary

1. Stash a readable article page.
2. Wait for the card status to change from `processing` to `done`.
3. Confirm the card shows:
   - Brief summary
   - Tags
   - Key points
4. Confirm errors, if any, are shown in the card instead of freezing the extension.

## Verify Notion Sync

1. Use a card with status `done`.
2. Click `Send to Notion`.
3. Open the configured Notion test database.
4. Confirm a new Notion page was created with:
   - Title
   - Original URL
   - Brief
   - Tags
   - Source set to `TabStash AI`
   - Created date
   - Page body sections for AI Summary, Key Points, and Original URL

## Notes For Review

- TabStash AI processes only pages the reviewer actively chooses to stash.
- TabStash AI does not automatically read full browser history.
- Notion credentials are used only to write selected content to the configured Notion database.
