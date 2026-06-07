# TabStash AI Acceptance Test Report

Generated: 2026-06-06T13:51:02.672Z

## Summary

- PASS - 20 test pages attempted
- PASS - Readability produced readable content for the required sample size
- PASS - AI JSON valid for every analyzable page
- PASS - IndexedDB restart restore count matches
- PASS - All Tabs batch saved 20 items
- PASS - All Tabs batch closed 20 tabs
- PASS - Notion success sync count matches done count
- PASS - Notion failure leaves analyzable items in inbox

## Readability Extraction

Detailed test page URLs have been redacted for repository safety.

- Test pages: 20
- Readable pages: 20
- Good quality extractions: 18
- Thin but valid extractions: 2
- Failed extractions: 0

## Pipeline Results

- Inbox items saved: 20
- Tabs closed after verified save: 20
- AI JSON valid: 20/20
- AI done items: 20
- Notion synced items: 20
- IndexedDB restored items after restart simulation: 20

## Notion Exception Scenario

- Failure cases retained in inbox: 3/3
- Sample error: Mock Notion database fields do not match the TabStash AI template.

## Notes

- This automated acceptance run used mock AI and mock Notion.
- Detailed test URLs are intentionally omitted from the repository report.
- The same code path is used by the extension; live credential validation remains available through Settings -> Notion SDK -> Test.
- Live Chrome extension tab closing requires manual browser execution after loading extension/dist.
