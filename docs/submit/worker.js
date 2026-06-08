/*
 * worker.js — Cloudflare Worker version of the device-flow CORS relay.
 *
 * Deploy this once (free tier) and point the form's relayBase at its URL.
 * Holds NO secret: device flow needs only the public client_id. Identical
 * behaviour to relay.mjs.
 *
 *   wrangler deploy worker.js   (or paste into the Cloudflare dashboard)
 */
const GH = "https://github.com/login";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

async function forward(target, payload) {
  const r = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json", ...CORS },
  });
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method !== "POST") return json(405, { error: "method_not_allowed" });

    const url = new URL(request.url);
    let payload;
    try { payload = await request.json(); } catch { return json(400, { error: "bad_json" }); }

    try {
      if (url.pathname.endsWith("/device/code")) {
        return json(200, await forward(GH + "/device/code",
          { client_id: payload.client_id, scope: payload.scope || "public_repo" }));
      }
      if (url.pathname.endsWith("/device/token")) {
        return json(200, await forward(GH + "/oauth/access_token",
          { client_id: payload.client_id, device_code: payload.device_code, grant_type: payload.grant_type }));
      }
      return json(404, { error: "not_found" });
    } catch (e) {
      return json(502, { error: "upstream", detail: String(e) });
    }
  },
};
