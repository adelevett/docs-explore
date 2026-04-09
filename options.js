/* options.js */
"use strict";

const preferSearchToggle = document.getElementById("preferSearchToggle");
const defaultEngineSelect = document.getElementById("defaultEngineSelect");
const saveBtn = document.getElementById("saveBtn");
const statusMsg = document.getElementById("statusMsg");

const KEY_PREFER_SEARCH = "preferSearch";
const KEY_DEFAULT_ENGINE = "defaultEngine";

chrome.storage.local.get([KEY_PREFER_SEARCH, KEY_DEFAULT_ENGINE], (result) => {
  preferSearchToggle.checked = Boolean(result?.[KEY_PREFER_SEARCH]);
  defaultEngineSelect.value = result?.[KEY_DEFAULT_ENGINE] || "ddg";
});

saveBtn.addEventListener("click", () => {
  const value = Boolean(preferSearchToggle.checked);
  const engine = defaultEngineSelect.value || "ddg";
  chrome.storage.local.set({ [KEY_PREFER_SEARCH]: value, [KEY_DEFAULT_ENGINE]: engine }, () => {
    showStatus("Saved", "ok");
  });
});

function showStatus (msg, type) {
  statusMsg.textContent = msg;
  statusMsg.className = `status-msg ${type} show`;
  setTimeout(() => statusMsg.classList.remove("show"), 2200);
}
