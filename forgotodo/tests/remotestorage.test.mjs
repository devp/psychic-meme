import { test } from "node:test";
import assert from "node:assert/strict";
import { RemoteStorageError, userAddress, discover, authorizeURL, fromRedirect, remoteStorage } from "../lib/remotestorage.js";

/**
 * A fetch that answers from `routes` ("METHOD url" -> Response) and records
 * what it was asked.
 * @param {Record<string, () => Response>} routes
 */
function stub(routes) {
  /** @type {{ method: string, url: string, headers: Record<string, string>, body?: any }[]} */
  const calls = [];
  /** @type {typeof fetch} */
  const fetchFn = async (input, init = {}) => {
    const method = init.method ?? "GET";
    const url = String(input);
    calls.push({ method, url, headers: /** @type {Record<string, string>} */ (init.headers ?? {}), body: init.body });
    const route = routes[`${method} ${url}`];
    if (!route) throw new TypeError("Failed to fetch");
    return route();
  };
  return { fetchFn, calls };
}

const json = (/** @type {unknown} */ v) => new Response(JSON.stringify(v), { headers: { "Content-Type": "application/jrd+json" } });

const WEBFINGER = "https://5apps.com/.well-known/webfinger?resource=acct%3Ame%405apps.com";
const conn = { address: "me@5apps.com", href: "https://storage.5apps.com/me", authURL: "https://5apps.com/rs/oauth/me", token: "tok" };
const DOC = "https://storage.5apps.com/me/forgotodo/list.json";

test("userAddress: a bare name is at the first provider", () => {
  assert.equal(userAddress(" me "), "me@5apps.com");
  assert.equal(userAddress("acct:me@example.org"), "me@example.org");
  assert.equal(userAddress("me", { name: "x", domain: "x.test", signup: "" }), "me@x.test");
});

test("discover: WebFinger gives the storage root and the OAuth endpoint", async () => {
  const { fetchFn } = stub({
    [`GET ${WEBFINGER}`]: () =>
      json({
        links: [
          { rel: "self", href: "nope" },
          {
            rel: "http://tools.ietf.org/id/draft-dejong-remotestorage",
            href: "https://storage.5apps.com/me/",
            properties: { "http://tools.ietf.org/html/rfc6749#section-4.2": "https://5apps.com/rs/oauth/me" },
          },
        ],
      }),
  });
  assert.deepEqual(await discover("me@5apps.com", fetchFn), {
    address: "me@5apps.com",
    href: "https://storage.5apps.com/me",
    authURL: "https://5apps.com/rs/oauth/me",
  });
});

test("discover: no remoteStorage link, or no network, is an error", async () => {
  const { fetchFn } = stub({ [`GET ${WEBFINGER}`]: () => json({ links: [] }) });
  await assert.rejects(discover("me@5apps.com", fetchFn), /No storage found/);
  await assert.rejects(discover("me@5apps.com", stub({}).fetchFn), (e) => e instanceof RemoteStorageError && e.status === 0);
  await assert.rejects(discover("me", fetchFn), /Not a user address/);
});

test("authorizeURL: implicit grant, client_id is the app's origin", () => {
  const url = new URL(authorizeURL({ authURL: conn.authURL, scope: "forgotodo:rw", redirectUri: "https://app.test/forgotodo/" }));
  assert.equal(url.origin + url.pathname, conn.authURL);
  assert.equal(url.searchParams.get("redirect_uri"), "https://app.test/forgotodo/");
  assert.equal(url.searchParams.get("client_id"), "https://app.test");
  assert.equal(url.searchParams.get("scope"), "forgotodo:rw");
  assert.equal(url.searchParams.get("response_type"), "token");
});

test("fromRedirect: token, error, or nothing", () => {
  assert.deepEqual(fromRedirect("#access_token=abc&token_type=bearer"), { token: "abc" });
  assert.deepEqual(fromRedirect("#error=access_denied"), { error: "access_denied" });
  assert.equal(fromRedirect(""), null);
});

test("get: body and ETag, with the bearer token; 404 is null", async () => {
  const { fetchFn, calls } = stub({ [`GET ${DOC}`]: () => new Response("{}", { headers: { ETag: '"v1"' } }) });
  assert.deepEqual(await remoteStorage(conn, fetchFn).get("forgotodo/list.json"), { body: "{}", etag: '"v1"' });
  assert.equal(calls[0].headers.Authorization, "Bearer tok");
  const missing = stub({ [`GET ${DOC}`]: () => new Response(null, { status: 404 }) });
  assert.equal(await remoteStorage(conn, missing.fetchFn).get("forgotodo/list.json"), null);
});

test("get: 401 throws with the status", async () => {
  const { fetchFn } = stub({ [`GET ${DOC}`]: () => new Response(null, { status: 401 }) });
  await assert.rejects(remoteStorage(conn, fetchFn).get("forgotodo/list.json"), (e) => e instanceof RemoteStorageError && e.status === 401);
});

test("put: If-Match a version, or If-None-Match * for a new document; 412 is null", async () => {
  const ok = stub({ [`PUT ${DOC}`]: () => new Response(null, { status: 200, headers: { ETag: '"v2"' } }) });
  const rs = remoteStorage(conn, ok.fetchFn);
  assert.deepEqual(await rs.put("forgotodo/list.json", "{}", { ifMatch: '"v1"' }), { etag: '"v2"' });
  assert.equal(ok.calls[0].headers["If-Match"], '"v1"');
  assert.equal(ok.calls[0].headers["Content-Type"], "application/json");
  assert.equal(ok.calls[0].body, "{}");
  await rs.put("forgotodo/list.json", "{}", { ifMatch: null });
  assert.equal(ok.calls[1].headers["If-None-Match"], "*");
  assert.equal(ok.calls[1].headers["If-Match"], undefined);

  const raced = stub({ [`PUT ${DOC}`]: () => new Response(null, { status: 412 }) });
  assert.equal(await remoteStorage(conn, raced.fetchFn).put("forgotodo/list.json", "{}", { ifMatch: '"v1"' }), null);
});
