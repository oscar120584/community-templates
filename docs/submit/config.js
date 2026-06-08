/*
 * config.js — deployment settings for the submission form.
 * Fill in clientId after registering a GitHub OAuth App with device flow enabled.
 */
window.ZT_CONFIG = {
  // GitHub OAuth App client id (Settings → Developer settings → OAuth Apps,
  // "Enable Device Flow" checked). Public value — safe to ship.
  clientId: "",

  // CORS relay for the device-flow endpoints (no secret). Local dev default;
  // replace with your Cloudflare Worker URL in production.
  relayBase: "http://127.0.0.1:8788",

  // Where the PR is opened. For real contributions this is the contributor's
  // fork; for this experiment it targets the fork directly.
  owner: "oscar120584",
  repo: "community-templates",
  base: "main",

  scope: "public_repo",
};
