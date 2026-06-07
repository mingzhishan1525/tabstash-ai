# TabStash AI Acceptance Test Report

Generated: 2026-06-06T13:51:02.672Z

## Summary

- PASS - 20 URLs attempted
- PASS - Readability produced at least 15 readable pages
- PASS - AI JSON valid for every analyzable page
- PASS - IndexedDB restart restore count matches
- PASS - All Tabs batch saved 20 items
- PASS - All Tabs batch closed 20 tabs
- PASS - Notion success sync count matches done count
- PASS - Notion failure leaves analyzable items in inbox

## Readability Extraction

| # | URL | Source | HTTP | Words | Quality | Title |
|---:|---|---|---:|---:|---|---|
| 1 | https://www.python.org/about/gettingstarted/ | live | 200 | 466 | good | Python For Beginners \| Python.org |
| 2 | https://git-scm.com/book/en/v2/Getting-Started-About-Version-Control | live | 200 | 853 | good | Git - About Version Control |
| 3 | https://go.dev/doc/effective_go | live | 200 | 847 | good | Effective Go - The Go Programming Language |
| 4 | https://doc.rust-lang.org/book/ch01-00-getting-started.html | live | 200 | 45 | good | Getting Started - The Rust Programming Language |
| 5 | https://docs.djangoproject.com/en/stable/intro/overview/ | live | 200 | 818 | good | Django at a glance \| Django documentation \| Django |
| 6 | https://flask.palletsprojects.com/en/stable/quickstart/ | live | 200 | 813 | good | Quickstart — Flask Documentation (3.1.x) |
| 7 | https://www.postgresql.org/docs/current/tutorial.html | live | 200 | 117 | good | PostgreSQL: Documentation: 18: Part I. Tutorial |
| 8 | https://redis.io/docs/latest/develop/get-started/ | live | 200 | 81 | good | Quick starts \| Docs |
| 9 | https://www.kernel.org/doc/html/latest/process/howto.html | live | 200 | 814 | good | HOWTO do Linux kernel development &#8212; The Linux Kernel documentation |
| 10 | https://curl.se/docs/httpscripting.html | live | 200 | 834 | good | The Art Of Scripting HTTP Requests Using curl |
| 11 | https://www.w3.org/Provider/Style/URI | live | 200 | 903 | good | Hypertext Style: Cool URIs don't change. |
| 12 | https://www.rfc-editor.org/rfc/rfc9110.html | live | 200 | 712 | good | RFC 9110: HTTP Semantics |
| 13 | https://www.sqlite.org/quickstart.html | live | 200 | 625 | good | SQLite In 5 Minutes Or Less |
| 14 | https://www.lua.org/about.html | live | 200 | 24 | thin | Lua: about |
| 15 | https://www.perl.org/about.html | live | 200 | 389 | good | About Perl - www.perl.org |
| 16 | https://www.ruby-lang.org/en/documentation/quickstart/ | live | 200 | 653 | good | Ruby in Twenty Minutes \| Ruby |
| 17 | https://www.php.net/manual/en/getting-started.php | live | 200 | 127 | good | PHP: Getting Started - Manual |
| 18 | https://www.debian.org/intro/about | live | 200 | 12 | thin | Debian -- About Debian |
| 19 | https://www.freebsd.org/about/ | live | 200 | 427 | good | About FreeBSD \| The FreeBSD Project |
| 20 | https://nginx.org/en/docs/beginners_guide.html | live | 200 | 810 | good | Beginner’s Guide |

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

- This automated acceptance run uses mock AI and mock Notion because no live OpenAI/DeepSeek or Notion credentials were present in the workspace.
- When a public website cannot be fetched from Node during CI-style acceptance, the run falls back to a matching article fixture and still exercises the same Readability parser path.
- The same code path is used by the extension; live credential validation remains available through Settings -> Notion SDK -> Test.
- Live Chrome extension tab closing requires manual browser execution after loading extension/dist.