# Template upload form (variant B)

A self-contained static page that lets a contributor publish a template by
**dragging in files** — no fork, no pull request, no copy-paste. The directory
and README are assembled and validated in the browser; the form then opens the
pull request via the GitHub API using the contributor's own token.

> Concept/experiment. Hosted from `docs/` (the GitHub Pages root for
> share.zabbix.com). The CI `review_pr.yaml` remains the authoritative gate.

## Files

| File | Role |
|------|------|
| `index.html` / `style.css` / `app.js` | the form UI and wiring |
| `zt.js` | browser port of the Python `ztcore` (parse / validate / assemble / README). Parity-tested |
| `vendor/js-yaml.min.js` | vendored YAML parser (no external CDN) |
| `github.js` | device-flow login + publish (blobs → tree → commit → ref → PR) |
| `relay.mjs` / `worker.js` | tiny CORS relay for the device-flow endpoints (no secret) |
| `config.js` | deployment settings (client id, relay URL, target repo) |
| `test_*.mjs` | headless tests (Node + jsdom) |

## Why a relay?

GitHub's `github.com/login/*` device-flow endpoints don't send CORS headers, so
the browser can't call them directly. The relay forwards exactly two POSTs and
adds CORS. It holds **no secret** (device flow only needs the public client id).
`api.github.com` *is* CORS-enabled, so the actual PR creation runs straight from
the browser.

## One-time setup for a real run

1. **Register a GitHub OAuth App** — Settings → Developer settings → OAuth Apps
   → New. Any homepage/callback URL. Open it and tick **Enable Device Flow**.
   Copy the **Client ID**.
2. **Set `config.js`** — put the Client ID in `clientId`; set `owner`/`repo` to
   the target fork (defaults already point at this fork).
3. **Start the relay** (local dev): `node relay.mjs` → listens on `:8788`.
   For production deploy `worker.js` to Cloudflare and set `relayBase` to its URL.
4. **Serve the form**: `python3 -m http.server 8099` here, open
   `http://127.0.0.1:8099/`.

## Using it

Drag in your exported `template_*.yaml` (and any scripts/images). Pick a
category, fill author/overview. When the checks are green, click **Open pull
request**, enter the shown code at `github.com/login/device`, authorize — the PR
link appears.

## Tests

```bash
npm install            # js-yaml (runtime), then for tests:
npm install --no-save jsdom
node test_github.mjs   # publish sequence + device polling (mock fetch)
node test_form.mjs     # form rendering + submit wiring (jsdom)
```

## Not included (by design)

- **L2 live-import** before submit — skipped; the CI live-import (L3) covers it.
- Keeping `zt.js` and the Python `ztcore` in sync is currently manual; a CI
  parity check is the natural follow-up.
