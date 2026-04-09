# Docs Explore - Chrome Extension

Bring back the old Google Docs Explore workflow with instant answers, fast web search handoff, and citation helpers.

## Installation

1. Open Chrome and go to chrome://extensions/
2. Enable Developer mode
3. Click Load unpacked
4. Select this folder

## Current behavior

1. Default mode: query DuckDuckGo Instant Answer first
2. If an instant answer exists: show answer card, source link, copy actions, related topics
3. If no instant answer exists: show fallback engines
4. Optional mode in Settings: Always open search
5. In Always open search mode:
     - typing shows a ready state
     - pressing Enter (or clicking Search) opens the selected engine in a new tab
     - sidebar confirms what opened and lets users quickly re-enable instant answers

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
| Keyboard shortcut | Ctrl + Shift + E |
| Search | Type in the sidebar search input |
| Copy answer | Use Copy, then paste in Docs |
| Copy citation | Use Copy citation, then paste in Docs |
| Quick capture from web | Right-click selection or link and choose Add to Google Docs (Explore) |

## Privacy summary

- Search terms are sent from the browser to api.duckduckgo.com for instant answers
- When users click external engine buttons or auto-open search, normal search URLs are opened in a new tab
- Context-menu capture reads selected text or links and sends them to the user's open Google Docs tab
- Preferences are stored locally in chrome.storage.local
- No custom backend, account system, or analytics service is used

See [PRIVACY.html](PRIVACY.html) for a full policy page suitable for Chrome Web Store submission.

## Chrome Web Store readiness checklist

Done:
- Manifest V3
- PNG icons (16, 48, 128)
- Action icon configured
- Options page
- Privacy policy page in repository

Still needed before publish:
- 1 to 5 store screenshots (recommended: instant answer, always-search ready state, settings page)
- Store description text in Chrome Web Store dashboard
- Category, language, and support contact fields in dashboard

Current screenshots in this repo:
- store-assets/instant_answer.png
- store-assets/search_in_new_tab.png
- store-assets/launch_from_icon.png

Note: Chrome Web Store screenshots must match accepted dimensions. The current captures are 682x683 and should be re-captured or resized to an accepted size such as 1280x800 or 640x400.

## Share feedback with Google Docs

The most effective path is direct in-product feedback from Google Docs.

1. Open any Google Doc
2. Click Help in the top menu
3. Click Help Docs improve
4. Submit your message

Suggested message:

The Explore feature was extremely useful for research and citations. Current alternatives do not replace its workflow. Please consider bringing it back.

## File structure

docs-explore/
- manifest.json
- background.js
- content.js
- content.css
- sidebar.html
- sidebar.js
- sidebar.css
- options.html
- options.js
- PRIVACY.html
- store-assets/
- icons/
    - icon16.png
    - icon48.png
    - icon128.png
