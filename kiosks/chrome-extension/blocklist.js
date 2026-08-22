// Hard-coded domains that can never be added to the allow list, regardless
// of what's in chrome.storage.sync. Edit this file (not the allow list) to
// change what's permanently blocked.

const HARD_BLOCKLIST = [
  "youtube.com",
  "facebook.com",
];

// Subdomains that override HARD_BLOCKLIST above — checked first, before the
// blocklist match. Still subject to the normal allow list (not auto-allowed).
const HARD_BLOCKLIST_EXCEPTIONS = [
  "music.youtube.com",
];
