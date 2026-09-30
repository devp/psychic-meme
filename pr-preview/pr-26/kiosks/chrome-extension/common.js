// Shared allow-list helpers used by background.js and options.js

const STORAGE_KEY = "allowedDomains";

async function getAllowedDomains() {
  const { [STORAGE_KEY]: domains } = await chrome.storage.sync.get(STORAGE_KEY);
  return Array.isArray(domains) ? domains : [];
}

async function setAllowedDomains(domains) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: domains });
}

// hostname matches if it equals an allow-listed domain, or is a subdomain of one
// (e.g. allow-listing "example.com" also allows "www.example.com").
function hostnameIsAllowed(hostname, allowedDomains) {
  return allowedDomains.some(
    (domain) => hostname === domain || hostname.endsWith("." + domain)
  );
}

// Same exact/subdomain matching, applied against the hard-coded blocklist.
function hostnameIsBlocked(hostname, blockedDomains) {
  return blockedDomains.some(
    (domain) => hostname === domain || hostname.endsWith("." + domain)
  );
}
