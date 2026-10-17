// A remoteStorage client (https://remotestorage.io): just enough of the
// protocol to keep a few documents in someone's own storage. WebFinger finds
// the storage and its OAuth endpoint from a user address; an OAuth implicit
// grant hands back a bearer token in the URL fragment; documents are read with
// GET (the ETag is the version) and written with a conditional PUT.
//
// App-agnostic: no DOM beyond what's passed in, no app state, no storage. The
// caller keeps the connection (address, href, authURL, token) wherever it keeps
// things, and passes in `fetch` so tests can stub it.

/**
 * Where people can get storage. A user address without an @ is taken to be at
 * the first one; a picker would list these.
 * @typedef {{ name: string, domain: string, signup: string }} Provider
 * @type {Provider[]}
 */
export const PROVIDERS = [{ name: "5apps", domain: "5apps.com", signup: "https://5apps.com/storage" }];

/**
 * @typedef {Object} Connection
 * @property {string} address user@host
 * @property {string} href storage root, no trailing slash
 * @property {string} authURL OAuth authorization endpoint
 * @property {string} [token] bearer token, once authorized
 */

/** A failed request, or an answer the protocol doesn't allow. `status` 0 is no network. */
export class RemoteStorageError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * `you` -> `you@5apps.com`; a full address is left alone.
 * @param {string} input
 * @param {Provider} [provider]
 */
export function userAddress(input, provider = PROVIDERS[0]) {
  const s = input.trim().replace(/^acct:/, "");
  return s.includes("@") ? s : `${s}@${provider.domain}`;
}

// Link relations: the current draft's, then the older one some servers still use.
const RELS = ["http://tools.ietf.org/id/draft-dejong-remotestorage", "remotestorage"];
const AUTH_PROP = "http://tools.ietf.org/html/rfc6749#section-4.2";

/**
 * Look up the storage for a user address with WebFinger.
 * @param {string} address user@host
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<Connection>}
 */
export async function discover(address, fetchFn = fetch) {
  const host = address.split("@").pop();
  if (!host || !address.includes("@")) throw new RemoteStorageError(`Not a user address: ${address}`, 0);
  const url = `https://${host}/.well-known/webfinger?resource=${encodeURIComponent("acct:" + address)}`;
  const res = await send(fetchFn, url, {});
  if (!res.ok) throw new RemoteStorageError(`No storage found for ${address}`, res.status);
  /** @type {{ links?: { rel: string, href?: string, properties?: Record<string, string|null> }[] }} */
  const jrd = await res.json().catch(() => ({}));
  const link = jrd.links?.find((l) => RELS.includes(l.rel));
  const authURL = link?.properties?.[AUTH_PROP];
  if (!link?.href || !authURL) throw new RemoteStorageError(`No storage found for ${address}`, res.status);
  return { address, href: link.href.replace(/\/+$/, ""), authURL };
}

/**
 * Where to send the browser to ask for access. `scope` is `module:rw`, e.g.
 * `forgotodo:rw`; client_id is the app's origin, as the spec has it.
 * @param {{ authURL: string, scope: string, redirectUri: string }} opts
 */
export function authorizeURL({ authURL, scope, redirectUri }) {
  const url = new URL(authURL);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("client_id", new URL(redirectUri).origin);
  url.searchParams.set("scope", scope);
  url.searchParams.set("response_type", "token");
  return url.href;
}

/**
 * What the authorization server sent back in the fragment, if anything.
 * @param {string} hash location.hash
 * @returns {{ token: string } | { error: string } | null}
 */
export function fromRedirect(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const token = p.get("access_token");
  if (token) return { token };
  const error = p.get("error");
  return error ? { error } : null;
}

/**
 * Documents under one connection. Paths are relative to the storage root,
 * e.g. `forgotodo/list.json`.
 * @param {Connection} conn
 * @param {typeof fetch} [fetchFn]
 */
export function remoteStorage(conn, fetchFn = fetch) {
  /** @param {string} path */
  const urlOf = (path) => `${conn.href}/${path.split("/").map(encodeURIComponent).join("/")}`;
  /** @type {Record<string, string>} */
  const auth = conn.token ? { Authorization: `Bearer ${conn.token}` } : {};

  return {
    /**
     * @param {string} path
     * @returns {Promise<{ body: string, etag: string } | null>} null if there's no document
     */
    async get(path) {
      const res = await send(fetchFn, urlOf(path), { headers: auth, cache: "no-store" });
      if (res.status === 404) return null;
      if (!res.ok) throw new RemoteStorageError(`GET ${path}: ${res.status}`, res.status);
      const etag = res.headers.get("ETag");
      if (!etag) throw new RemoteStorageError(`GET ${path}: no ETag`, res.status);
      return { body: await res.text(), etag };
    },

    /**
     * Write only if the document is still at `ifMatch`, or, with `ifMatch`
     * null, only if there isn't one yet.
     * @param {string} path
     * @param {string} body
     * @param {{ ifMatch: string|null, contentType?: string }} opts
     * @returns {Promise<{ etag: string } | null>} null if someone else wrote first (412)
     */
    async put(path, body, { ifMatch, contentType = "application/json" }) {
      const headers = { ...auth, "Content-Type": contentType, ...(ifMatch ? { "If-Match": ifMatch } : { "If-None-Match": "*" }) };
      const res = await send(fetchFn, urlOf(path), { method: "PUT", headers, body });
      if (res.status === 412) return null;
      if (!res.ok) throw new RemoteStorageError(`PUT ${path}: ${res.status}`, res.status);
      const etag = res.headers.get("ETag");
      if (!etag) throw new RemoteStorageError(`PUT ${path}: no ETag`, res.status);
      return { etag };
    },
  };
}

/**
 * fetch, with a network failure as a RemoteStorageError (status 0).
 * @param {typeof fetch} fetchFn
 * @param {string} url
 * @param {RequestInit} init
 */
async function send(fetchFn, url, init) {
  try {
    return await fetchFn(url, init);
  } catch (err) {
    throw new RemoteStorageError(err instanceof Error ? err.message : String(err), 0);
  }
}
