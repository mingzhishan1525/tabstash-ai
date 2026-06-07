# TabStash AI

Close tabs without losing ideas. Save now. Organize later.

## Current Status

Beta / Feature Freeze

## Current Beta Scope

- Chrome MV3 Side Panel
- Stash Tab
- All Tabs
- Readability extraction
- AI summary with DeepSeek via backend
- Local IndexedDB Inbox
- Notion sync
- Beta analytics
- No data loss validation

## Not included in current Beta

- Payment
- OAuth
- Obsidian integration
- Team features
- Mobile app
- AI search

## Privacy Policy

Production URL required before Chrome Web Store submission.

Example:

```text
https://yourdomain.com/privacy.html
```

This MVP contains:

- `extension/`: Manifest V3 Chrome Extension with Side Panel, React, TypeScript, Tailwind CSS, IndexedDB, Readability extraction, free/pro gates.
- `server/`: Fastify TypeScript API with OpenAI-compatible AI analysis, Zod validation, and Notion page creation.

## Planned / Not included in current Beta

Obsidian support is planned for a future version. The current Beta focuses on:

- Tab stashing
- AI summaries
- Local Inbox
- Notion sync
- No-data-loss workflow

Do not claim Obsidian, Markdown export, OAuth, payment, or advanced AI search support unless the feature is actually implemented and verified.

Stashing now persists each item to IndexedDB and verifies it can be read back before closing the original tab. Restoring an item opens the original URL and removes that item from the inbox.
Each inbox card shows AI Summary, AI Tags, and a Status Flow timeline that records pending, processing, done, and failed transitions.

## Run locally

```bash
npm install
cp server/.env.example server/.env
npm run dev:server
npm run build --workspace extension
```

Load `extension/dist` in Chrome:

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Load unpacked
4. Select `extension/dist`

The development extension expects the API at `http://localhost:8787` by default. You can change it in the Side Panel settings.

Chrome Store production builds must use an HTTPS `API_BASE_URL`.

Production extension builds must not contain `localhost`. The release script checks for `localhost`, `sk-`, `secret_`, and `ntn_` in `extension/dist` and fails the build if any are found.

## Backend env

The current Beta uses DeepSeek through the backend. Configure these values in `server/.env` using `server/.env.example` as the template:

- `AI_PROVIDER`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`

Notion credentials are entered inside the extension settings and sent only when creating a page.
After credentials are configured, the Side Panel shows a Notion Sync card with synced/ready counts and a one-click sync for all analyzed unsynced items.
The Settings panel includes a Notion SDK connection test that calls `/api/notion/validate`, retrieves the database, and checks the required TabStash AI fields before pages are created. Items can be sent to Notion after AI analysis reaches `done`.

## Beta analytics

Analytics uses the existing Node API plus PostgreSQL. No third-party analytics platform is used.

```bash
DATABASE_URL=postgres://user:password@localhost:5432/tabstash_ai
# PGSSL=true # only when your hosted Postgres requires SSL
```

The server creates `analytics_events` automatically on the first analytics request:

- `id`: bigserial primary key
- `user_id`: UUID
- `event_name`: text
- `metadata`: JSONB
- `created_at`: timestamptz

`GET /api/analytics/summary` returns installs, first-stash users, Notion-connected users, total stashed tabs, All Tabs actions, Notion syncs, DAU, and WAU.

## Notion database fields

Create or duplicate a database with these properties:

- `Name`: Title
- `URL`: URL
- `Brief`: Rich Text
- `Tags`: Multi-select
- `Source`: Select
- `Created`: Date

The page body is created with `AI Summary`, `Key Points`, and `Original URL` blocks.

## Chrome Store launch checklist

- Confirm extension build is fresh and passes production leak checks: `npm run build --workspace extension`.
- Create release ZIP: `npm run release:chrome`.
- Confirm backend build is fresh: `npm run build --workspace server`.
- Verify real workflow: stash selected page, AI analysis completes, Notion sync succeeds, reopen works.
- Verify All Tabs saves selected window tabs without data loss.
- Confirm `privacy.html` is hosted and linked in the Chrome Store listing.
- Use Chrome Store listing copy from `outputs/chrome-store-launch-assets.md`.
- Use reviewer test instructions from `outputs/chrome-store-test-instructions.md`.
- Prepare 5 Chrome Store screenshots using the screenshot scripts.
- Prepare 30-second demo video using the video script.
- Confirm `tabstash-ai-chrome.zip` was created from `extension/dist`.
- Confirm listing does not claim automatic browser history reading or processing unselected pages.
- Confirm no service API keys are present in the extension frontend or committed files.
- Confirm Notion token and database ID are only entered by the user and used for Notion sync.
- Confirm Beta analytics disclosure matches the privacy policy.
