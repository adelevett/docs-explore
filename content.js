/* content.js — injected into every docs.google.com/document/* page */

(function () {
  "use strict";

  /* ── constants ─────────────────────────────────────────────────── */
  /* keyboard shortcut is handled via chrome.commands in background.js */
  const SIDEBAR_ID      = "__docs_explore_sidebar__";
  const TOGGLE_ID       = "__docs_explore_toggle__";
  const EXTENSION_ORIGIN = new URL(chrome.runtime.getURL("/")).origin;

  /* ── state ──────────────────────────────────────────────────────── */
  let sidebarOpen = false;
  let iframe      = null;
  let toggleBtn   = null;

  /* ── build sidebar iframe ───────────────────────────────────────── */
  function createSidebar () {
    iframe = document.createElement("iframe");
    iframe.id  = SIDEBAR_ID;
    iframe.src = chrome.runtime.getURL("sidebar.html");
    iframe.setAttribute("allowtransparency", "true");
    iframe.setAttribute("frameborder", "0");
    document.body.appendChild(iframe);
  }

  /* ── build floating toggle button ──────────────────────────────── */
  function createToggle () {
    toggleBtn = document.createElement("button");
    toggleBtn.id          = TOGGLE_ID;
    const isMac = navigator.platform.includes("Mac") || navigator.userAgent.includes("Mac");
    toggleBtn.title       = `AnswerDock  (${isMac ? "Cmd" : "Ctrl"}+Shift+E)`;
    toggleBtn.innerHTML   = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="2" stroke-linecap="round"
           stroke-linejoin="round" width="18" height="18">
        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
      </svg>`;
    toggleBtn.addEventListener("click", toggleSidebar);
    document.body.appendChild(toggleBtn);
  }

  /* ── show / hide ────────────────────────────────────────────────── */
  function toggleSidebar () {
    sidebarOpen = !sidebarOpen;
    iframe.classList.toggle("__de_open__", sidebarOpen);
    toggleBtn.classList.toggle("__de_active__", sidebarOpen);
  }

  /* ── messages from sidebar ──────────────────────────────────────── */
  window.addEventListener("message", (e) => {
    if (!iframe || e.source !== iframe.contentWindow) return;
    if (e.origin !== EXTENSION_ORIGIN) return;

    if (e.data?.type === "DE_INSERT_CITATION") {
      insertCitation(e.data.text, Boolean(e.data.copied));
    }
    if (e.data?.type === "DE_OPEN_SEARCH_URL") {
      openSearchUrl(e.data.url);
    }
    if (e.data?.type === "DE_CLOSE") {
      if (sidebarOpen) toggleSidebar();
    }
  });

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "DE_PING") {
      sendResponse({ ready: true });
      return;
    }

    if (msg?.type === "DE_TOGGLE") {
      toggleSidebar();
      return;
    }
    if (msg?.type === "DE_INSERT_EXTERNAL_TEXT" && typeof msg.text === "string") {
      insertCitation(msg.text, false);
    }
  });

  /* ── insert citation into Docs ──────────────────────────────────── */
  async function insertCitation (text, alreadyCopied) {
    const pasteKey = navigator.platform.includes("Mac") ? "Cmd+V" : "Ctrl+V";
    const copied = alreadyCopied ? true : await copyTextToClipboard(text);

    focusDocsTypingSurface();

    iframe?.contentWindow?.postMessage(
      {
        type: "DE_CITE_DONE",
        copied,
        pasteKey
      },
      EXTENSION_ORIGIN
    );
  }

  async function copyTextToClipboard (text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      /* fall through to execCommand fallback */
    }

    try {
      const ta = document.createElement("textarea");
      ta.value = String(text || "");
      ta.setAttribute("readonly", "readonly");
      ta.style.position = "fixed";
      ta.style.top = "-10000px";
      ta.style.left = "-10000px";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return Boolean(ok);
    } catch {
      return false;
    }
  }

  function focusDocsTypingSurface () {
    const textEventFrame = document.querySelector(".docs-texteventtarget-iframe");
    if (!(textEventFrame instanceof HTMLIFrameElement)) return;

    try {
      textEventFrame.contentWindow?.focus();
      const frameDoc = textEventFrame.contentDocument;
      const target = frameDoc?.querySelector("textarea") || frameDoc?.body;
      if (target instanceof HTMLElement) {
        target.focus();
      }
    } catch {
      textEventFrame.focus();
    }
  }

  function openSearchUrl (url) {
    if (typeof url !== "string") return;
    const trimmed = url.trim();
    if (!/^https?:\/\//i.test(trimmed)) return;
    window.open(trimmed, "_blank", "noopener,noreferrer");
  }

  /* ── init ───────────────────────────────────────────────────────── */
  function init () {
    if (document.getElementById(SIDEBAR_ID)) return;
    createSidebar();
    createToggle();
  }

  /* Docs is a SPA — wait for the editor shell to exist */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
