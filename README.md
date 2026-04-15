# AnswerDock - Chrome Extension

Discover AnswerDock with instant answers with fast web search handoff, and citation helpers.

## What to expect

1. Default mode: query DuckDuckGo Instant Answer first
2. If an instant answer exists: show answer card, source link, copy actions, related topics
3. If no instant answer exists: show fallback engines

## Settings

- Always open search instead of instant answers
- Default search engine used for:
    - related content links
    - search citation links
    - auto-open target when Always open search is enabled

## Usage

| Action | How |
|--------|-----|
| Open sidebar | Click extension action or floating button on Google Docs |
| Keyboard shortcut | Cmd + Shift + E (Mac) Ctrl + Shift + E (Windows) |
| Search | Type in the sidebar search input |
| Copy answer | Use Copy, then paste in Docs |
| Copy citation | Use Copy citation, then paste in Docs |
| Quick capture from web | Right-click selection or link and choose Add to Google Docs (Explore), then paste using Cmd+V (mac) Ctrl+V (Windows) |

## Privacy summary

- Search terms are sent from the browser to api.duckduckgo.com for instant answers
- When users click external engine buttons or auto-open search, normal search URLs are opened in a new tab
- Context-menu capture reads selected text or links and sends them to the user's open Google Docs tab
- Preferences are stored locally in chrome.storage.local
- No custom backend, account system, or analytics service is used

See [PRIVACY.html](https://adelevett.github.io/answerdock/PRIVACY.html) for a full policy