/* background.js */
"use strict";

const MENU_SELECTION = "docs_explore_add_selection";
const MENU_LINK = "docs_explore_add_link";
const DOCS_CREATE_URL = "https://docs.google.com/document/u/0/create";
const DOCS_URL_PREFIX = "https://docs.google.com/document/";

chrome.action.onClicked.addListener(async (tab) => {
  const url = String(tab?.url || "");
  if (isDocsDocumentUrl(url)) {
    await toggleDocsSidebar(tab);
    return;
  }

  await chrome.tabs.create({ url: DOCS_CREATE_URL });
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "toggle-sidebar") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  if (isDocsDocumentUrl(String(tab.url || ""))) {
    await toggleDocsSidebar(tab);
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_SELECTION,
      title: "Add selection to Google Docs (Explore)",
      contexts: ["selection"]
    });

    chrome.contextMenus.create({
      id: MENU_LINK,
      title: "Add link to Google Docs (Explore)",
      contexts: ["link"]
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;

  let text = "";
  if (info.menuItemId === MENU_SELECTION) {
    text = buildSelectionPayload(info, tab);
  } else if (info.menuItemId === MENU_LINK) {
    text = buildLinkPayload(info, tab);
  }

  if (!text) return;

  const docsTab = await ensureDocsTab();
  if (!docsTab?.id) return;

  await chrome.tabs.update(docsTab.id, { active: true });
  await sendToDocsTab(docsTab.id, text);
});

function buildSelectionPayload (info, tab) {
  const selected = String(info.selectionText || "").trim();
  if (!selected) return "";

  const sourceTitle = tab.title || "Web page";
  const sourceUrl = tab.url || "";
  const retrieved = formatRetrievedDate(new Date());

  return [
    `\"${selected}\"`,
    `${sourceTitle}.`,
    sourceUrl,
    `Retrieved ${retrieved}.`,
    ""
  ].join("\n");
}

function buildLinkPayload (info, tab) {
  const linkUrl = String(info.linkUrl || "").trim();
  if (!linkUrl) return "";

  const sourceTitle = tab.title || "Web page";
  const retrieved = formatRetrievedDate(new Date());

  return [
    `${sourceTitle}.`,
    linkUrl,
    `Retrieved ${retrieved}.`,
    ""
  ].join("\n");
}

async function ensureDocsTab () {
  const docsTabs = await chrome.tabs.query({ url: "https://docs.google.com/document/*" });
  if (docsTabs.length > 0) return docsTabs[0];

  const created = await chrome.tabs.create({ url: DOCS_CREATE_URL });
  if (!created.id) return created;

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(created);
    }, 12000);

    function listener (tabId, changeInfo, updatedTab) {
      if (tabId !== created.id) return;
      if (changeInfo.status !== "complete") return;

      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(updatedTab);
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

function sendToDocsTab (tabId, text) {
  return ensureDocsExploreReady(tabId).then(() => chrome.tabs.sendMessage(tabId, {
    type: "DE_INSERT_EXTERNAL_TEXT",
    text
  })).catch(() => {});
}

function isDocsDocumentUrl (url) {
  return String(url || "").startsWith(DOCS_URL_PREFIX);
}

async function toggleDocsSidebar (tab) {
  if (!tab?.id) return;

  await ensureDocsExploreReady(tab.id);
  await chrome.tabs.sendMessage(tab.id, { type: "DE_TOGGLE" }).catch(() => {});
}

async function ensureDocsExploreReady (tabId) {
  const ready = await pingDocsExplore(tabId);
  if (ready) return;

  await chrome.scripting.insertCSS({
    target: { tabId },
    files: ["content.css"]
  }).catch(() => {});

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });

  const readyAfterInject = await pingDocsExplore(tabId);
  if (!readyAfterInject) {
    throw new Error("AnswerDock content script is unavailable");
  }
}

async function pingDocsExplore (tabId) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: "DE_PING" });
    return Boolean(response?.ready);
  } catch {
    return false;
  }
}

function formatRetrievedDate (d) {
  const year = d.getFullYear();
  const month = d.toLocaleString("en-US", { month: "long" });
  const day = d.getDate();
  return `${year}, ${month} ${day}`;
}
