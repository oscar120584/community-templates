/*
 * relay.mjs — local CORS relay for the GitHub device-flow endpoints.
 *
 * GitHub's github.com/login/* endpoints don't send CORS headers, so a browser
 * can't call them directly. This tiny relay forwards exactly two POSTs and adds
 * CORS. It holds NO secret (device flow doesn't need the client secret) — the
 * only thing flowing through is the client_id and the device/user codes.
 *
 * Run:  node relay.mjs            (listens on :8788)
 * The browser form points relayBase at http://127.0.0.1:8788
 *
 * The Cloudflare Worker version (worker.js) is the same logic for production.
 */
import http from "http";

const PORT = process.env.PORT || 8788;
const GH = "https://github.com/login";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function send(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json", ...CORS });
  res.end(JSON.stringify(obj));
}

async function forward(target, payload) {
  const r = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

const server = http.createServer((req, res) => {
  if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
  if (req.method !== "POST") { send(res, 405, { error: "method_not_allowed" }); return; }

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", async () => {
    let payload;
    try { payload = body ? JSON.parse(body) : {}; }
    catch { return send(res, 400, { error: "bad_json" }); }
    try {
      if (req.url.startsWith("/device/code")) {
        return send(res, 200, await forward(GH + "/device/code",
          { client_id: payload.client_id, scope: payload.scope || "public_repo" }));
      }
      if (req.url.startsWith("/device/token")) {
        return send(res, 200, await forward(GH + "/oauth/access_token",
          { client_id: payload.client_id, device_code: payload.device_code, grant_type: payload.grant_type }));
      }
      send(res, 404, { error: "not_found" });
    } catch (e) {
      send(res, 502, { error: "upstream", detail: String(e) });
    }
  });
});

server.listen(PORT, "127.0.0.1", () => console.log(`device-flow relay on http://127.0.0.1:${PORT}`));
