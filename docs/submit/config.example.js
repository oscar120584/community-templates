/*
 * config.example.js — template for deployment settings.
 *
 * Copy to config.js and fill in the values. None of these are secrets:
 *   - clientId is the PUBLIC OAuth App client id (no client_secret is used);
 *   - relayBase is the public URL of your CORS relay (Cloudflare Worker / nginx).
 */
window.ZT_CONFIG = {
  // GitHub OAuth App client id (Settings → Developer settings → OAuth Apps,
  // "Enable Device Flow" checked). Public value.
  clientId: "",

  // Public URL of the device-flow CORS relay. For local dev this is the Node
  // relay (http://127.0.0.1:8788); for a hosted form it MUST be an https URL
  // (deploy worker.js to Cloudflare and paste its URL here, no trailing slash).
  relayBase: "https://YOUR-WORKER.your-subdomain.workers.dev",

  // Where the pull request is opened (the target repository).
  owner: "oscar120584",
  repo: "community-templates",
  base: "main",

  scope: "public_repo",
};
