// Mock-fetch tests for github.js — verifies the REST call sequence and the
// device-flow polling, with no network and no real token.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const GH = require("./github.js");

let failed = 0;
const assert = (c, m) => { if (!c) { console.error("FAIL:", m); failed++; } else console.log("ok:", m); };

function res(ok, status, body) {
  return Promise.resolve({ ok, status, statusText: "", text: () => Promise.resolve(JSON.stringify(body)) });
}

// --- publish: user OWNS the upstream -> direct write, no fork ---
{
  const calls = [];
  const fakeFetch = (url, init) => {
    const method = init.method;
    const path = url.replace("https://api.github.com", "");
    calls.push(method + " " + path);
    const b = init.body ? JSON.parse(init.body) : null;
    if (method === "GET" && path === "/user") return res(true, 200, { login: "me" });
    if (method === "GET" && path.includes("/git/ref/heads/")) return res(true, 200, { object: { sha: "BASE" } });
    if (method === "GET" && path.includes("/git/commits/")) return res(true, 200, { tree: { sha: "BASETREE" } });
    if (method === "POST" && path.endsWith("/git/blobs")) return res(true, 201, { sha: "blob-" + b.encoding });
    if (method === "POST" && path.endsWith("/git/trees")) {
      assert(b.base_tree === "BASETREE" && b.tree.length === 2, "tree uses base_tree + both files");
      return res(true, 201, { sha: "NEWTREE" });
    }
    if (method === "POST" && path.endsWith("/git/commits")) {
      assert(b.tree === "NEWTREE" && b.parents[0] === "BASE", "commit links new tree + base parent");
      return res(true, 201, { sha: "COMMIT" });
    }
    if (method === "POST" && path.endsWith("/git/refs")) {
      assert(b.ref === "refs/heads/submit/x" && b.sha === "COMMIT", "ref created at commit");
      return res(true, 201, {});
    }
    if (method === "POST" && path.endsWith("/pulls")) {
      assert(b.head === "submit/x" && b.base === "main", "owner PR head is same-repo branch");
      return res(true, 201, { html_url: "https://gh/pr/9", number: 9 });
    }
    return res(false, 500, { message: "unexpected " + method + " " + path });
  };

  const out = await GH.publishSubmission({
    token: "T", upstreamOwner: "me", upstreamRepo: "community-templates", base: "main", branch: "submit/x",
    title: "Add x", body: "body",
    files: [
      { path: "Unsorted/template_x/7.0/template_x.yaml", content: "a: 1", encoding: "utf-8" },
      { path: "Unsorted/template_x/7.0/files/logo.png", content: "AAAA", encoding: "base64" },
    ],
    fetchImpl: fakeFetch,
  });

  assert(out.url === "https://gh/pr/9", "returns PR url");
  const expected = [
    "GET /user",
    "GET /repos/me/community-templates/git/ref/heads/main",
    "GET /repos/me/community-templates/git/commits/BASE",
    "POST /repos/me/community-templates/git/blobs",
    "POST /repos/me/community-templates/git/blobs",
    "POST /repos/me/community-templates/git/trees",
    "POST /repos/me/community-templates/git/commits",
    "POST /repos/me/community-templates/git/refs",
    "POST /repos/me/community-templates/pulls",
  ];
  assert(JSON.stringify(calls) === JSON.stringify(expected), "owner path: no fork, identify->commit->PR");
}

// shared mock for the fork paths; `repoLookup` decides what GET /repos/alice/.. returns
function forkFetch(repoLookup) {
  const calls = [];
  const fetchImpl = (url, init) => {
    const method = init.method, path = url.replace("https://api.github.com", "");
    calls.push(method + " " + path.split("?")[0]);
    const b = init.body ? JSON.parse(init.body) : null;
    if (method === "GET" && path === "/user") return res(true, 200, { login: "alice" });
    if (method === "GET" && path === "/repos/alice/community-templates") return repoLookup();
    if (method === "POST" && path.endsWith("/forks")) return res(true, 202, { full_name: "alice/community-templates" });
    if (method === "POST" && path.endsWith("/merge-upstream")) return res(true, 200, {});
    if (method === "GET" && path.includes("/git/ref/heads/")) return res(true, 200, { object: { sha: "BASE" } });
    if (method === "GET" && path.includes("/git/commits/")) return res(true, 200, { tree: { sha: "BASETREE" } });
    if (method === "POST" && path.endsWith("/git/blobs")) return res(true, 201, { sha: "blob" });
    if (method === "POST" && path.endsWith("/git/trees")) return res(true, 201, { sha: "NEWTREE" });
    if (method === "POST" && path.endsWith("/git/commits")) return res(true, 201, { sha: "COMMIT" });
    if (method === "POST" && path.endsWith("/git/refs")) return res(true, 201, {});
    if (method === "POST" && path.endsWith("/pulls")) {
      assert(b.head === "alice:submit/x" && b.base === "main", "cross-repo PR head is alice:branch");
      return res(true, 201, { html_url: "https://gh/pr/12", number: 12 });
    }
    return res(false, 500, { message: "unexpected " + method + " " + path });
  };
  return { calls, fetchImpl };
}

const publishOpts = (fetchImpl) => ({
  token: "T", upstreamOwner: "me", upstreamRepo: "community-templates", base: "main", branch: "submit/x",
  title: "Add x", body: "body",
  files: [{ path: "Unsorted/template_x/7.0/template_x.yaml", content: "a: 1", encoding: "utf-8" }],
  sleep: () => Promise.resolve(), fetchImpl,
});

// --- contributor has NO fork yet -> create it, then cross-repo PR ---
{
  const { calls, fetchImpl } = forkFetch(() => res(false, 404, { message: "Not Found" }));
  const out = await GH.publishSubmission(publishOpts(fetchImpl));
  assert(out.number === 12, "fork path returns the cross-repo PR");
  assert(calls.includes("POST /repos/me/community-templates/forks"), "creates the fork when none exists");
  assert(calls.includes("GET /repos/me/community-templates/git/ref/heads/main"), "reads the base from upstream, not the fork");
  assert(calls.includes("POST /repos/alice/community-templates/git/blobs"), "commits into the contributor's fork");
  assert(calls.includes("POST /repos/me/community-templates/pulls"), "opens the PR on the upstream");
  assert(!calls.some((c) => c.includes("merge-upstream")), "never syncs/touches the fork's base branch");
}

// --- contributor ALREADY has a fork -> reuse it, no POST /forks, no base touch ---
{
  const { calls, fetchImpl } = forkFetch(() => res(true, 200, { fork: true }));
  const out = await GH.publishSubmission(publishOpts(fetchImpl));
  assert(out.number === 12, "existing-fork path still returns the PR");
  assert(!calls.includes("POST /repos/me/community-templates/forks"), "does NOT re-create an existing fork");
  assert(!calls.some((c) => c.includes("merge-upstream")), "leaves the existing fork's branches untouched");
  assert(calls.includes("GET /repos/me/community-templates/git/ref/heads/main"), "bases the branch on upstream, regardless of fork state");
}

// --- name collision: a non-fork repo of the same name -> clear error ---
{
  const { fetchImpl } = forkFetch(() => res(true, 200, { fork: false }));
  let threw = null;
  try { await GH.publishSubmission(publishOpts(fetchImpl)); } catch (e) { threw = e; }
  assert(threw && /not a fork/.test(threw.message), "errors clearly when a same-named non-fork repo exists");
}

// --- publish: existing branch (ref 422 -> PATCH force) + existing PR reuse ---
{
  const calls = [];
  const fakeFetch = (url, init) => {
    const method = init.method, path = url.replace("https://api.github.com", "");
    calls.push(method + " " + path.split("?")[0]);
    if (method === "GET" && path === "/user") return res(true, 200, { login: "me" });
    if (method === "GET" && path.includes("/git/ref/heads/")) return res(true, 200, { object: { sha: "BASE" } });
    if (method === "GET" && path.includes("/git/commits/")) return res(true, 200, { tree: { sha: "BASETREE" } });
    if (method === "POST" && path.endsWith("/git/blobs")) return res(true, 201, { sha: "blob" });
    if (method === "POST" && path.endsWith("/git/trees")) return res(true, 201, { sha: "NEWTREE" });
    if (method === "POST" && path.endsWith("/git/commits")) return res(true, 201, { sha: "COMMIT" });
    if (method === "POST" && path.endsWith("/git/refs")) return res(false, 422, { message: "Reference already exists" });
    if (method === "PATCH" && path.includes("/git/refs/heads/")) return res(true, 200, {});
    if (method === "POST" && path.endsWith("/pulls")) return res(false, 422, { message: "A pull request already exists" });
    if (method === "GET" && path.includes("/pulls")) return res(true, 200, [{ html_url: "https://gh/pr/3", number: 3 }]);
    return res(false, 500, { message: "unexpected" });
  };
  const out = await GH.publishSubmission({
    token: "T", upstreamOwner: "me", upstreamRepo: "r", base: "main", branch: "submit/x", title: "t", body: "b",
    files: [{ path: "p", content: "c", encoding: "utf-8" }], fetchImpl: fakeFetch,
  });
  assert(calls.includes("PATCH /repos/me/r/git/refs/heads/submit/x"), "force-updates existing branch ref");
  assert(out.number === 3, "reuses existing open PR");
}

// --- device flow polling: pending -> slow_down -> token ---
{
  let n = 0;
  const fakeFetch = (url, init) => {
    if (url.endsWith("/device/code")) return res(true, 200, { device_code: "DC", user_code: "ABCD-1234", verification_uri: "https://github.com/login/device", interval: 1, expires_in: 60 });
    if (url.endsWith("/device/token")) {
      n++;
      if (n === 1) return res(true, 200, { error: "authorization_pending" });
      if (n === 2) return res(true, 200, { error: "slow_down" });
      return res(true, 200, { access_token: "gho_TEST" });
    }
    return res(false, 500, {});
  };
  let shown = null;
  const token = await GH.deviceLogin({
    clientId: "Iv1.xxx", relayBase: "http://relay", scope: "public_repo", fetchImpl: fakeFetch,
    onCode: (c) => { shown = c; }, sleep: () => Promise.resolve(), now: () => 0,
  });
  assert(shown && shown.user_code === "ABCD-1234", "onCode surfaced the user code");
  assert(token === "gho_TEST", "device flow yields the access token after pending/slow_down");
}

console.log(failed ? `\n${failed} FAILED` : "\nALL GITHUB TESTS PASSED");
process.exitCode = failed ? 1 : 0;
