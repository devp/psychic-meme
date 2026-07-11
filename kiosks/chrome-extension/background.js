importScripts("common.js", "blocklist.js");

chrome.runtime.onInstalled.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.webNavigation.onBeforeNavigate.addListener(async (details) => {
  // Only gate top-level frame navigations; leave sub-frames alone.
  if (details.frameId !== 0) return;

  let url;
  try {
    url = new URL(details.url);
  } catch {
    return;
  }

  // Only gate http(s) navigations — leave chrome://, extension pages, etc. alone.
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  if (hostnameIsBlocked(url.hostname, HARD_BLOCKLIST)) {
    redirectToBlocked(details.tabId, details.url);
    return;
  }

  const allowedDomains = await getAllowedDomains();
  if (hostnameIsAllowed(url.hostname, allowedDomains)) return;

  redirectToBlocked(details.tabId, details.url);
});

function redirectToBlocked(tabId, originalUrl) {
  const blockedUrl =
    chrome.runtime.getURL("blocked.html") + "?url=" + encodeURIComponent(originalUrl);
  chrome.tabs.update(tabId, { url: blockedUrl });
}
