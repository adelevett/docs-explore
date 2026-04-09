/* sidebar.js — runs inside the sidebar iframe */
"use strict";

/* ── DOM refs ───────────────────────────────────────────────────── */
const searchInput = document.getElementById("searchInput");
const clearBtn = document.getElementById("clearBtn");
const closeBtn = document.getElementById("closeBtn");
const statusArea = document.getElementById("statusArea");
const emptyState = document.getElementById("emptyState");
const errorMsg = document.getElementById("errorMsg");
const resultsList = document.getElementById("resultsList");
const toast = document.getElementById("toast");
const settingsLink = document.getElementById("settingsLink");

/* ── config ─────────────────────────────────────────────────────── */
const DDG_ENDPOINT = "https://api.duckduckgo.com/";
const DEBOUNCE_MS = 300;
const KEY_PREFER_SEARCH = "preferSearch";
const KEY_DEFAULT_ENGINE = "defaultEngine";
const PARENT_ORIGIN = getParentOrigin();
const MIN_QUERY_LENGTH = 2;

const ENGINE_MAP = {
  ddg:    { name: "DuckDuckGo", url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}` },
  google: { name: "Google",     url: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}` },
  bing:   { name: "Bing",       url: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}` },
  yahoo:  { name: "Yahoo",      url: (q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}` },
  brave:  { name: "Brave",      url: (q) => `https://search.brave.com/search?q=${encodeURIComponent(q)}` },
};

let debounceTimer = null;
let lastQuery = "";
let preferSearch = false;
let defaultEngine = "ddg";
let activeSearchToken = 0;

function getParentOrigin () {
  const ancestor = location.ancestorOrigins && location.ancestorOrigins.length
    ? location.ancestorOrigins[0]
    : "";

  if (ancestor && /^https:\/\/docs\.google\.com$/i.test(ancestor)) {
    return ancestor;
  }

  if (document.referrer) {
    try {
      const refOrigin = new URL(document.referrer).origin;
      if (/^https:\/\/docs\.google\.com$/i.test(refOrigin)) {
        return refOrigin;
      }
    } catch {
      /* ignore parse failures */
    }
  }

  return "https://docs.google.com";
}

searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim();
  clearBtn.classList.toggle("visible", q.length > 0);

  clearTimeout(debounceTimer);
  if (q.length < MIN_QUERY_LENGTH) {
    activeSearchToken += 1;
    if (q.length === 0) showEmpty();
    return;
  }

  debounceTimer = setTimeout(() => doSearch(q), DEBOUNCE_MS);
});

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    clearTimeout(debounceTimer);
    const q = searchInput.value.trim();
    if (q.length >= MIN_QUERY_LENGTH) doSearch(q);
  }
  if (e.key === "Escape") {
    clearInput();
  }
});

clearBtn.addEventListener("click", clearInput);
closeBtn.addEventListener("click", () => {
  window.parent.postMessage({ type: "DE_CLOSE" }, PARENT_ORIGIN);
});

settingsLink.addEventListener("click", (e) => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;
  if (changes[KEY_PREFER_SEARCH]) {
    preferSearch = Boolean(changes[KEY_PREFER_SEARCH].newValue);
  }
  if (changes[KEY_DEFAULT_ENGINE]) {
    defaultEngine = changes[KEY_DEFAULT_ENGINE].newValue || "ddg";
  }
});

async function init () {
  searchInput.value = "";
  clearBtn.classList.remove("visible");
  lastQuery = "";
  showEmpty();
  [preferSearch, defaultEngine] = await Promise.all([getPreferSearch(), getDefaultEngine()]);
  searchInput.focus();
}

async function doSearch (query) {
  if (query.length < MIN_QUERY_LENGTH) return;
  if (query === lastQuery) return;

  const searchToken = ++activeSearchToken;
  lastQuery = query;

  if (preferSearch) {
    if (searchToken !== activeSearchToken) return;
    renderSearchFallback(query);
    return;
  }

  try {
    const data = await fetchDDG(query);
    if (searchToken !== activeSearchToken) return;

    if (hasInstantAnswer(data)) {
      renderInstantAnswer(data, query);
      return;
    }

    renderSearchFallback(query);
  } catch (err) {
    if (searchToken !== activeSearchToken) return;
    showError(`${escapeHtml(err.message || "Search failed")}. Try opening web search below.`);
    renderSearchFallback(query, true);
  }
}

async function fetchDDG (query) {
  const url = new URL(DDG_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("no_html", "1");
  url.searchParams.set("no_redirect", "1");
  url.searchParams.set("skip_disambig", "1");
  url.searchParams.set("t", "docs-explore");

  const res = await fetch(url.toString(), {
    headers: {
      "Accept": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`DDG error ${res.status}`);
  }

  return res.json();
}

function hasInstantAnswer (data) {
  return Boolean(data?.AbstractText?.length || data?.Answer?.length || data?.Definition?.length);
}

function renderInstantAnswer (data, query) {
  statusArea.hidden = true;
  emptyState.hidden = true;
  errorMsg.hidden = true;
  resultsList.hidden = false;
  resultsList.innerHTML = "";

  const main = document.createElement("li");
  main.className = "sb-card sb-answer";

  const heading = data.Heading || query;
  const abstract = data.AbstractText || data.Answer || data.Definition || "No summary available.";
  const source = data.AbstractSource || data.DefinitionSource || "DuckDuckGo";
  const sourceUrl = data.AbstractURL || data.DefinitionURL || extractFirstURL(data.Results) || "";
  const thumb = data.Image ? normalizeDDGImage(data.Image) : "";
  const apa = buildAPAFromDDG(data, query);
  const displayCopyText = `${buildDisplayedAnswerText(heading, abstract, source, sourceUrl)}\n`;
  const citationCopyText = `${apa}\n`;

  main.innerHTML = `
    <div class="sb-card-meta">
      <span class="sb-site-name">Instant answer</span>
      <span class="sb-date">${escapeHtml(source)}</span>
    </div>
    <div class="sb-card-title">${escapeHtml(heading)}</div>
    ${thumb ? `<img class="sb-thumb" src="${escapeHtml(thumb)}" alt="" loading="lazy" />` : ""}
    <p class="sb-card-snippet">${escapeHtml(abstract)}</p>
    <div class="sb-card-actions">
      ${sourceUrl ? `<a class="sb-btn-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener">Visit site</a>` : ""}
      <button class="sb-btn-copy">Copy</button>
      <button class="sb-btn-cite">Copy citation</button>
    </div>
  `;

  const copyBtn = main.querySelector(".sb-btn-copy");
  if (copyBtn) {
    copyBtn.addEventListener("click", () => {
      postInsert(displayCopyText, false);
    });
  }

  const citeBtn = main.querySelector(".sb-btn-cite");
  if (citeBtn) {
    citeBtn.addEventListener("click", () => {
      postInsert(citationCopyText, false);
    });
  }

  resultsList.appendChild(main);

  const related = flattenRelatedTopics(data.RelatedTopics || []).slice(0, 6);
  if (related.length > 0) {
    const badge = document.createElement("li");
    badge.className = "sb-count";
    badge.textContent = "Related topics";
    resultsList.appendChild(badge);

    related.forEach((topic) => {
      const item = document.createElement("li");
      item.className = "sb-card sb-related";
      const engine = ENGINE_MAP[defaultEngine] || ENGINE_MAP.ddg;
      item.innerHTML = `
        <div class="sb-card-title">
          <a href="${escapeHtml(engine.url(topic.text))}" target="_blank" rel="noopener">${escapeHtml(topic.text)}</a>
        </div>
      `;
      resultsList.appendChild(item);
    });
  }
}

function renderSearchFallback (query, keepErrorVisible) {
  if (!keepErrorVisible) {
    statusArea.hidden = false;
    errorMsg.hidden = true;
    emptyState.hidden = true;
  }
  resultsList.hidden = true;
  resultsList.innerHTML = "";

  const q = encodeURIComponent(query);
  const engines = [
    { name: "DuckDuckGo", url: `https://duckduckgo.com/?q=${q}` },
    { name: "Google", url: `https://google.com/search?q=${q}` },
    { name: "Bing", url: `https://bing.com/search?q=${q}` },
    { name: "Yahoo", url: `https://search.yahoo.com/search?p=${q}` },
    { name: "Brave", url: `https://search.brave.com/search?q=${q}` }
  ];

  const card = document.createElement("div");
  card.className = "sb-fallback";
  card.innerHTML = `
    <div class="sb-fallback-title">No instant answer for</div>
    <div class="sb-fallback-query">"${escapeHtml(query)}"</div>
    <div class="sb-fallback-subtitle">Continue searching in:</div>
    <div class="sb-engine-grid"></div>
    <label class="sb-fallback-toggle" for="alwaysSearchToggle">
      <input id="alwaysSearchToggle" type="checkbox" ${preferSearch ? "checked" : ""} />
      Always open search instead of DDG instant answer
    </label>
  `;

  const grid = card.querySelector(".sb-engine-grid");
  engines.forEach((engine) => {
    const btn = document.createElement("button");
    btn.className = "sb-engine-btn";
    btn.textContent = engine.name;
    btn.addEventListener("click", () => {
      window.parent.postMessage(
        {
          type: "DE_OPEN_SEARCH_URL",
          url: engine.url
        },
        PARENT_ORIGIN
      );
    });
    grid.appendChild(btn);
  });

  const alwaysToggle = card.querySelector("#alwaysSearchToggle");
  alwaysToggle.addEventListener("change", async (e) => {
    preferSearch = Boolean(e.currentTarget.checked);
    await setPreferSearch(preferSearch);
    showToast(preferSearch ? "Always-search enabled" : "Always-search disabled");
  });

  const citeBtn = document.createElement("button");
  citeBtn.className = "sb-btn-cite sb-fallback-cite";
  citeBtn.textContent = "Copy search citation";
  citeBtn.addEventListener("click", () => {
    const citation = buildSearchCitation(query);
    postInsert(`${citation}\n`, false);
  });

  card.appendChild(citeBtn);
  statusArea.appendChild(card);

  [...statusArea.querySelectorAll(".sb-fallback")].slice(0, -1).forEach((el) => el.remove());
}

function showEmpty () {
  statusArea.hidden = false;
  emptyState.hidden = false;
  errorMsg.hidden = true;
  resultsList.hidden = true;
  clearFallbackCards();
}

function showError (html) {
  statusArea.hidden = false;
  emptyState.hidden = true;
  resultsList.hidden = true;
  errorMsg.hidden = false;
  errorMsg.innerHTML = html;
  clearFallbackCards();
}

function clearInput () {
  activeSearchToken += 1;
  searchInput.value = "";
  clearBtn.classList.remove("visible");
  lastQuery = "";
  showEmpty();
  searchInput.focus();
}

function clearFallbackCards () {
  statusArea.querySelectorAll(".sb-fallback").forEach((el) => el.remove());
}

let toastTimer = null;
function showToast (msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2800);
}

window.addEventListener("message", (e) => {
  if (e.origin !== PARENT_ORIGIN) return;
  if (e.data?.type === "DE_CITE_DONE") {
    const pasteKey = e.data?.pasteKey || "Cmd/Ctrl+V";
    if (e.data?.copied) {
      showToast(`Copied. Paste with ${pasteKey}`);
    } else {
      showToast("Could not access clipboard. Doc focused.");
    }
  }
});

function postInsert (text, copied) {
  window.parent.postMessage(
    {
      type: "DE_INSERT_CITATION",
      text,
      copied
    },
    PARENT_ORIGIN
  );
}

function buildDisplayedAnswerText (heading, abstract, source, sourceUrl) {
  const parts = [heading, abstract, `Source: ${source}`];
  if (sourceUrl) {
    parts.push(sourceUrl);
  }
  return parts.join("\n\n");
}

function buildAPAFromDDG (data, query) {
  const heading = data.Heading || query;
  const publisher = data.AbstractSource || data.DefinitionSource || "DuckDuckGo";
  const url = data.AbstractURL || data.DefinitionURL || extractFirstURL(data.Results) || "";
  const author = guessAuthorFromHeading(heading);
  const retrieved = formatRetrievedDate(new Date());

  const parts = [];
  if (author) parts.push(`${author}.`);
  parts.push("(n.d.).");
  parts.push(`${heading}.`);
  parts.push(`${publisher}.`);
  if (url) parts.push(url);
  parts.push(`Retrieved ${retrieved}.`);

  return parts.join(" ");
}

function buildSearchCitation (query) {
  const engine = ENGINE_MAP[defaultEngine] || ENGINE_MAP.ddg;
  const url = engine.url(query);
  const retrieved = formatRetrievedDate(new Date());
  return `${engine.name}. (n.d.). Search results for "${query}". ${url} Retrieved ${retrieved}.`;
}

function formatRetrievedDate (d) {
  const year = d.getFullYear();
  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  return `${year}, ${month} ${day}`;
}

function guessAuthorFromHeading (heading) {
  const tokens = String(heading || "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 3) return "";
  if (!tokens.every((t) => /^[A-Z][a-zA-Z'-]+$/.test(t))) return "";

  const last = tokens[tokens.length - 1];
  const first = tokens[0];
  return `${last}, ${first.charAt(0).toUpperCase()}`;
}

function flattenRelatedTopics (topics) {
  const out = [];
  topics.forEach((entry) => {
    if (entry?.FirstURL && entry?.Text) {
      out.push({ url: entry.FirstURL, text: entry.Text });
      return;
    }
    if (Array.isArray(entry?.Topics)) {
      entry.Topics.forEach((nested) => {
        if (nested?.FirstURL && nested?.Text) {
          out.push({ url: nested.FirstURL, text: nested.Text });
        }
      });
    }
  });
  return out;
}

function normalizeDDGImage (imageUrl) {
  if (!imageUrl) return "";
  if (/^https?:\/\//i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith("/")) return `https://duckduckgo.com${imageUrl}`;
  return `https://duckduckgo.com/${imageUrl}`;
}

function extractFirstURL (results) {
  if (!Array.isArray(results) || results.length === 0) return "";
  return results[0]?.FirstURL || "";
}

function getPreferSearch () {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY_PREFER_SEARCH, (result) => {
      resolve(Boolean(result?.[KEY_PREFER_SEARCH]));
    });
  });
}

function setPreferSearch (value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [KEY_PREFER_SEARCH]: Boolean(value) }, resolve);
  });
}

function getDefaultEngine () {
  return new Promise((resolve) => {
    chrome.storage.local.get(KEY_DEFAULT_ENGINE, (result) => {
      resolve(result?.[KEY_DEFAULT_ENGINE] || "ddg");
    });
  });
}

function escapeHtml (str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;");
}

function escapeAttr (str) {
  return String(str ?? "")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

init();
