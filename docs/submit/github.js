/*
 * github.js — GitHub auth + publish, browser/node (UMD).
 *
 * Two pieces:
 *   deviceLogin()       — OAuth device flow via a CORS relay (no client secret).
 *   publishSubmission() — create branch + commit files + open PR via the REST
 *                         Git Data API (api.github.com is CORS-enabled, so this
 *                         runs straight from the browser with the user token).
 *
 * Every network call goes through an injectable `fetchImpl` so the whole module
 * is unit-testable under Node with a mocked fetch.
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.GH = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const API = "https://api.github.com";
  const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

  function defaultFetch() {
    if (typeof fetch !== "undefined") return fetch;
    throw new Error("no fetch available");
  }

  async function jsonOrThrow(res, ctx) {
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch (e) { /* leave null */ }
    if (!res.ok) {
      const msg = (body && (body.message || body.error_description)) || text || res.statusText;
      const err = new Error(ctx + ": " + msg);
      err.status = res.status; err.body = body;
      throw err;
    }
    return body;
  }

  // --- device flow ---------------------------------------------------------

  // relayBase forwards /device/code and /device/token to github.com with CORS.
  async function requestDeviceCode(opts) {
    const f = opts.fetchImpl || defaultFetch();
    const res = await f(opts.relayBase + "/device/code", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: opts.clientId, scope: opts.scope || "public_repo" }),
    });
    return jsonOrThrow(res, "device code request");
  }

  async function pollForToken(opts, device) {
    const f = opts.fetchImpl || defaultFetch();
    const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
    let interval = (device.interval || 5) * 1000;
    const deadline = (opts.now ? opts.now() : Date.now()) + (device.expires_in || 900) * 1000;

    while ((opts.now ? opts.now() : Date.now()) < deadline) {
      await sleep(interval);
      const res = await f(opts.relayBase + "/device/token", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ client_id: opts.clientId, device_code: device.device_code, grant_type: DEVICE_GRANT }),
      });
      const body = await jsonOrThrow(res, "device token poll");
      if (body.access_token) return body.access_token;
      if (body.error === "authorization_pending") continue;
      if (body.error === "slow_down") { interval += 5000; continue; }
      throw new Error("device flow: " + (body.error_description || body.error));
    }
    throw new Error("device flow: code expired before authorization");
  }

  // onCode({user_code, verification_uri}) is called so the UI can show the code.
  async function deviceLogin(opts) {
    const device = await requestDeviceCode(opts);
    if (opts.onCode) opts.onCode({
      user_code: device.user_code,
      verification_uri: device.verification_uri || "https://github.com/login/device",
      expires_in: device.expires_in,
    });
    return pollForToken(opts, device);
  }

  // --- publish -------------------------------------------------------------

  function api(token, fetchImpl) {
    const f = fetchImpl || defaultFetch();
    return async function (method, path, body) {
      const res = await f(API + path, {
        method,
        headers: {
          Authorization: "Bearer " + token,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return jsonOrThrow(res, method + " " + path);
    };
  }

  async function waitForRef(call, owner, repo, base, sleep) {
    for (let i = 0; i < 20; i++) {
      try {
        await call("GET", "/repos/" + owner + "/" + repo + "/git/ref/heads/" + encodeURIComponent(base));
        return;
      } catch (e) {
        await sleep(1500);
      }
    }
    throw new Error("your fork is still being created — try again in a moment");
  }

  // Publishes via the fork-and-PR model so ANY contributor works (not just
  // people with write access to the target repo):
  //   1. identify the user; 2. ensure a fork exists in their account;
  //   3. commit the files to a branch in THEIR fork;
  //   4. open a cross-repo PR from <user>:branch into <upstream>:base.
  // files: [{ path, content, encoding }]  encoding = 'utf-8' | 'base64'
  // Returns { url, number, branch }.
  async function publishSubmission(opts) {
    const { token, upstreamOwner, upstreamRepo, base, branch, files, title, body, fetchImpl } = opts;
    const call = api(token, fetchImpl);
    const sleep = opts.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

    // 1. who is authenticated
    const me = await call("GET", "/user");
    const login = me.login;

    // 2. head repo: write to the user's own fork unless they own the upstream
    let headOwner = upstreamOwner;
    if (login.toLowerCase() !== upstreamOwner.toLowerCase()) {
      headOwner = login;

      // reuse an existing fork instead of blindly POSTing /forks
      let forkExists = false;
      try {
        const existing = await call("GET", "/repos/" + login + "/" + upstreamRepo);
        if (!existing.fork) {
          throw new Error("you already have a repository named '" + upstreamRepo +
            "' that is not a fork — rename it and try again");
        }
        forkExists = true;
      } catch (e) {
        if (e.status !== 404) throw e; // 404 just means "no fork yet"
      }
      if (!forkExists) {
        await call("POST", "/repos/" + upstreamOwner + "/" + upstreamRepo + "/forks", {});
        await waitForRef(call, login, upstreamRepo, base, sleep);
      }
      // NOTE: we deliberately do NOT sync the fork's base branch. We never
      // touch any existing branch in the contributor's fork — the submission
      // branch is built straight from the upstream base commit below.
    }
    const U = "/repos/" + upstreamOwner + "/" + upstreamRepo;
    const R = "/repos/" + headOwner + "/" + upstreamRepo;

    // 3. base commit + its tree — ALWAYS read from upstream, never from the
    // fork. Forks share object storage with upstream (same repository network),
    // so the fork can reference the upstream base SHA when we create the commit.
    // This keeps the PR clean regardless of how stale or diverged the fork is,
    // and means we don't depend on (or modify) the fork's branches at all.
    const ref = await call("GET", U + "/git/ref/heads/" + encodeURIComponent(base));
    const baseSha = ref.object.sha;
    const baseCommit = await call("GET", U + "/git/commits/" + baseSha);
    const baseTree = baseCommit.tree.sha;

    // 4. blobs
    const treeItems = [];
    for (const file of files) {
      const blob = await call("POST", R + "/git/blobs", {
        content: file.content,
        encoding: file.encoding === "base64" ? "base64" : "utf-8",
      });
      treeItems.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }

    // 5. tree, 6. commit
    const tree = await call("POST", R + "/git/trees", { base_tree: baseTree, tree: treeItems });
    const commit = await call("POST", R + "/git/commits", {
      message: title, tree: tree.sha, parents: [baseSha],
    });

    // 7. create or fast-forward the branch ref in the head repo
    const refPath = "refs/heads/" + branch;
    try {
      await call("POST", R + "/git/refs", { ref: refPath, sha: commit.sha });
    } catch (e) {
      if (e.status === 422) await call("PATCH", R + "/git/" + refPath, { sha: commit.sha, force: true });
      else throw e;
    }

    // 8. open the cross-repo PR on the upstream (or reuse an existing one)
    const head = headOwner === upstreamOwner ? branch : headOwner + ":" + branch;
    try {
      const pr = await call("POST", U + "/pulls", { title, head, base, body });
      return { url: pr.html_url, number: pr.number, branch };
    } catch (e) {
      if (e.status === 422) {
        const existing = await call("GET", U + "/pulls?head=" + headOwner + ":" + branch + "&state=open");
        if (existing && existing[0]) return { url: existing[0].html_url, number: existing[0].number, branch };
      }
      throw e;
    }
  }

  return { deviceLogin, requestDeviceCode, pollForToken, publishSubmission };
});
