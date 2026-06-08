/* app.js — wiring for the submission form. Uses the global ZT (zt.js). */
(function () {
  "use strict";

  const TEXT_EXT = ["yaml", "yml", "json", "xml", "md", "txt", "sh", "bash",
    "js", "py", "pl", "conf", "cfg", "ini", "csv", "svg"];

  let seq = 0;
  const state = { templates: [], accessory: [] };

  const $ = (sel) => document.querySelector(sel);
  const el = (tag, props, children) => {
    const n = Object.assign(document.createElement(tag), props || {});
    (children || []).forEach((c) => n.append(c));
    return n;
  };

  // --- file intake ---------------------------------------------------------

  function ext(name) { return (name.split(".").pop() || "").toLowerCase(); }
  function isTextual(name) { return TEXT_EXT.indexOf(ext(name)) !== -1; }

  function readFile(file) {
    return new Promise((resolve) => {
      const r = new FileReader();
      if (isTextual(file.name)) {
        r.onload = () => resolve({ name: file.name, content: String(r.result), binary: false, encoding: "utf-8" });
        r.onerror = () => resolve({ name: file.name, content: "", binary: true, encoding: "base64" });
        r.readAsText(file);
      } else {
        // binary (images, archives): keep bytes as base64 so they can be committed
        r.onload = () => resolve({ name: file.name, content: String(r.result).split(",").pop(), binary: true, encoding: "base64" });
        r.onerror = () => resolve({ name: file.name, content: "", binary: true, encoding: "base64" });
        r.readAsDataURL(file);
      }
    });
  }

  async function onFiles(list) {
    for (const file of list) {
      const f = await readFile(file);
      let parsed = null, parseError = null, isExport = false;
      if (!f.binary && ["yaml", "yml", "json", "xml"].indexOf(ext(f.name)) !== -1) {
        try {
          const p = ZT.parseExport(f.content, f.name);
          if (p.kind === "template" || p.kind === "mediatype") { parsed = p; isExport = true; }
        } catch (e) { /* not an export; treat as accessory */ }
      }
      if (isExport) {
        const tpl = {
          id: ++seq, fileName: f.name, content: f.content, parsed,
          category: "", author: "", overview: "", setup: "",
          slug: ZT.slugify(parsed.name), slugTouched: false,
          readme: "", readmeEdited: false, readmeEditing: false,
        };
        tpl.readme = ZT.generateReadme(parsed, { author: "", overview: "", setup: "" });
        state.templates.push(tpl);
      } else {
        const tid = state.templates.length === 1 ? state.templates[0].id : null;
        state.accessory.push({ id: ++seq, fileName: f.name, content: f.content, binary: f.binary, encoding: f.encoding, templateId: tid });
      }
    }
    // auto-assign loose accessories if exactly one template now exists
    if (state.templates.length === 1) {
      state.accessory.forEach((a) => { if (a.templateId == null) a.templateId = state.templates[0].id; });
    }
    render();
  }

  // --- combined build + validation ----------------------------------------

  function accessoriesFor(tid) {
    return state.accessory.filter((a) => a.templateId === tid)
      .map((a) => ({ name: a.fileName, content: a.content, encoding: a.encoding || "utf-8" }));
  }

  function buildAll() {
    const out = { files: [], layouts: {}, perTemplate: {}, errors: [] };
    state.templates.forEach((t) => {
      if (!t.parsed) { out.perTemplate[t.id] = { error: "Not a valid export." }; return; }
      if (!t.category) { out.perTemplate[t.id] = { error: "Choose a category." }; return; }
      try {
        const readme = t.readme != null ? t.readme
          : ZT.generateReadme(t.parsed, { author: t.author, overview: t.overview });
        const layout = ZT.buildLayout(t.parsed, t.category, t.content, {
          readme, slug: t.slug, extraFiles: accessoriesFor(t.id),
        });
        out.layouts[t.id] = layout;
        out.perTemplate[t.id] = { layout };
        const accEnc = {};
        accessoriesFor(t.id).forEach((a) => {
          accEnc[layout.versionDir + "/files/" + String(a.name).replace(/^\/+/, "")] = a.encoding;
        });
        Object.keys(layout.files).forEach((p) =>
          out.files.push({ path: p, content: layout.files[p], encoding: accEnc[p] || "utf-8" }));
      } catch (e) {
        out.perTemplate[t.id] = { error: e.message };
        out.errors.push(e.message);
      }
    });
    out.checks = ZT.runCheapChecks(out.files);
    return out;
  }

  // --- rendering -----------------------------------------------------------

  function render() {
    renderTemplates();
    renderAccessories();
    renderSummary();
  }

  function chip(text) { return el("span", { className: "chip", textContent: text }); }

  function renderTemplates() {
    const root = $("#templates"); root.innerHTML = "";
    state.templates.forEach((t) => {
      const p = t.parsed;
      const head = el("div", { className: "card-head" }, [
        el("span", { className: "fname", textContent: t.fileName }),
        el("button", {
          className: "btn-small remove", textContent: "remove",
          onclick: () => { state.templates = state.templates.filter((x) => x !== t); render(); },
        }),
      ]);
      const chips = el("div", { className: "chips" }, [
        chip(p.kind), chip("Zabbix " + p.version),
        chip(p.items.length + " items"), chip(p.triggers.length + " triggers"),
        chip(p.macros.length + " macros"), chip(p.discoveryRules.length + " LLD"),
      ]);

      const catSel = el("select", {
        onchange: (e) => { t.category = e.target.value; render(); },
      });
      catSel.append(el("option", { value: "", textContent: "— choose —" }));
      ZT.CATEGORIES.forEach((c) => {
        const o = el("option", { value: c, textContent: c });
        if (c === t.category) o.selected = true;
        catSel.append(o);
      });

      const slugInput = el("input", {
        value: t.slug,
        oninput: (e) => { t.slug = e.target.value; t.slugTouched = true; renderSummary(); updatePath(t); },
      });
      const authorInput = el("input", {
        value: t.author, placeholder: "your name or handle",
        oninput: (e) => { t.author = e.target.value; onContentInput(t); },
        onchange: () => maybeRegenOnCommit(t),
      });
      const overviewInput = el("textarea", {
        value: t.overview, placeholder: "What does it monitor? Requirements?",
        oninput: (e) => { t.overview = e.target.value; onContentInput(t); },
        onchange: () => maybeRegenOnCommit(t),
      });
      const setupInput = el("textarea", {
        value: t.setup, placeholder: "How to enable data collection and link the template to a host.",
        oninput: (e) => { t.setup = e.target.value; onContentInput(t); },
        onchange: () => maybeRegenOnCommit(t),
      });

      const ghBtn = el("button", {
        className: "btn-small ghbtn", textContent: "Use GitHub account",
        title: "Fill from your GitHub profile (also signs you in, so no extra auth at submit)",
        onclick: () => useGithubAccount(t),
      });
      const authorCell = el("div", { className: "author-row" }, [authorInput, ghBtn]);

      const grid = el("div", { className: "grid" }, [
        el("label", { textContent: "Category" }), catSel,
        el("label", { textContent: "Folder slug" }), slugInput,
        el("label", { textContent: "Author" }), authorCell,
        el("label", { textContent: "Overview" }), overviewInput,
        el("label", { textContent: "Setup" }), setupInput,
      ]);

      const pathLine = el("div", { className: "path", id: "path-" + t.id });

      const readmeDetails = el("details", { open: t.readmeEditing }, [
        el("summary", { textContent: "Generated README (editable)" }),
      ]);
      const readmeWrap = el("div", { className: "readme", id: "readme-" + t.id });
      renderReadmeInto(readmeWrap, t);
      readmeDetails.append(readmeWrap);

      root.append(el("div", { className: "card" }, [head, chips, grid, pathLine, readmeDetails]));
      updatePath(t);
    });
  }

  function updatePath(t) {
    const line = document.getElementById("path-" + t.id);
    if (!line) return;
    if (!t.category) { line.textContent = "→ choose a category to see the target path"; return; }
    const prefix = t.parsed.kind === "template" ? "template" : "mediatype";
    const slug = ZT.slugify(t.slug || t.parsed.name);
    line.textContent = "→ " + t.category + "/" + prefix + "_" + slug + "/" + t.parsed.version + "/";
  }

  // README: auto-generated, with an Edit mode. Changing author/overview (or the
  // export) regenerates and OVERWRITES any manual edits, by design.
  function regenReadme(t) {
    t.readme = ZT.generateReadme(t.parsed, { author: t.author, overview: t.overview, setup: t.setup });
    t.readmeEdited = false;
  }

  function refreshReadme(t) {
    const wrap = document.getElementById("readme-" + t.id);
    if (wrap) renderReadmeInto(wrap, t);
  }

  // Live preview while the README is still auto-generated. Once the user has
  // edited it by hand we don't touch it on every keystroke — regeneration is
  // offered (with a confirm) when the field is committed (blur).
  function onContentInput(t) {
    if (!t.readmeEdited) { regenReadme(t); refreshReadme(t); }
    renderSummary();
  }

  function maybeRegenOnCommit(t) {
    if (!t.readmeEdited) return;
    const ask = (typeof window !== "undefined" && window.confirm)
      ? window.confirm
      : function () { return true; };
    if (ask("You edited the README by hand. Regenerate it from the template and your fields?\nThis will discard your manual edits.")) {
      regenReadme(t);
      refreshReadme(t);
      renderSummary();
    }
  }

  function renderReadmeInto(wrap, t) {
    wrap.innerHTML = "";
    const bar = el("div", { className: "readme-bar" });
    const toggle = el("button", {
      className: "btn-small", textContent: t.readmeEditing ? "Done" : "Edit",
      onclick: () => { t.readmeEditing = !t.readmeEditing; renderReadmeInto(wrap, t); },
    });
    bar.append(toggle);
    if (t.readmeEdited) {
      bar.append(el("span", { className: "muted", textContent: "custom" }));
      bar.append(el("button", {
        className: "btn-small", textContent: "Reset to generated",
        onclick: () => { regenReadme(t); renderReadmeInto(wrap, t); renderSummary(); },
      }));
    } else {
      bar.append(el("span", { className: "muted", textContent: "auto-generated" }));
    }
    wrap.append(bar);

    if (t.readmeEditing) {
      wrap.append(el("textarea", {
        className: "readme-edit", value: t.readme,
        oninput: (e) => { t.readme = e.target.value; t.readmeEdited = true; renderSummary(); },
      }));
    } else if (typeof window !== "undefined" && window.marked) {
      // Rendered, read-only view. Content is the user's own README shown back to
      // them locally; for a hosted deploy, sanitize (e.g. DOMPurify) before use.
      const view = el("div", { className: "markdown-body" });
      view.innerHTML = window.marked.parse(t.readme);
      wrap.append(view);
    } else {
      wrap.append(el("pre", { className: "preview", textContent: t.readme }));
    }
  }

  function renderAccessories() {
    const sec = $("#unassigned"), ul = $("#unassigned-list"); ul.innerHTML = "";
    if (!state.accessory.length) { sec.classList.add("hidden"); return; }
    sec.classList.remove("hidden");
    state.accessory.forEach((a) => {
      const sel = el("select", {
        onchange: (e) => { a.templateId = e.target.value ? Number(e.target.value) : null; render(); },
      });
      sel.append(el("option", { value: "", textContent: "— unassigned —" }));
      state.templates.forEach((t) => {
        const o = el("option", { value: String(t.id), textContent: t.fileName });
        if (t.id === a.templateId) o.selected = true;
        sel.append(o);
      });
      const rm = el("button", {
        className: "btn-small", textContent: "remove",
        onclick: () => { state.accessory = state.accessory.filter((x) => x !== a); render(); },
      });
      ul.append(el("li", { className: "assign" }, [
        el("span", { textContent: a.fileName + (a.binary ? " (binary)" : "") + "  " }), sel, el("span", { textContent: " " }), rm,
      ]));
    });
  }

  function renderSummary() {
    const sec = $("#summary");
    if (!state.templates.length) { sec.classList.add("hidden"); return; }
    sec.classList.remove("hidden");

    const built = buildAll();
    const vbox = $("#validation"); vbox.innerHTML = "";

    // per-template issues
    state.templates.forEach((t) => {
      const pt = built.perTemplate[t.id];
      if (pt && pt.error) vbox.append(statusLine("bad", t.fileName + ": " + pt.error));
    });

    // global cheap checks
    let allOk = state.templates.length > 0 && state.templates.every((t) => built.perTemplate[t.id] && built.perTemplate[t.id].layout);
    built.checks.forEach((c) => {
      if (c.status === "success") { vbox.append(statusLine("ok", c.step)); }
      else {
        allOk = false;
        const line = statusLine("bad", c.step);
        vbox.append(line);
        if (c.message) {
          const ul = el("ul", { className: "problems" });
          c.message.split(". ").filter(Boolean).forEach((m) => ul.append(el("li", { textContent: m.replace(/\.$/, "") })));
          vbox.append(ul);
        }
      }
    });

    // file tree
    const paths = built.files.map((f) => f.path).sort();
    $("#tree").textContent = paths.length ? renderTree(paths) : "(nothing yet)";

    // submit
    const btn = $("#submit"), note = $("#submit-note");
    btn.disabled = !allOk;
    if (allOk) {
      note.textContent = "Ready: " + paths.length + " files across " +
        Object.keys(built.layouts).length + " template(s).";
      btn.onclick = () => submitAll(built);
    } else {
      note.textContent = "Fix the items above to enable submission.";
      btn.onclick = null;
    }
  }

  // --- submit: device-flow login, then open the PR(s) ---------------------

  // One device-flow login per page; the token (and profile) are reused by both
  // the "Use GitHub account" button and the submit button.
  let cachedToken = null, cachedUser = null;

  function ensureAuthBox() {
    let box = document.getElementById("auth");
    if (!box) { box = el("div", { id: "auth" }); $("#summary").append(box); }
    return box;
  }

  function showDeviceCode(c) {
    const box = ensureAuthBox();
    box.innerHTML = "";
    const p = el("p", { textContent: "Open " });
    p.append(el("a", { href: c.verification_uri, target: "_blank", textContent: c.verification_uri }),
      document.createTextNode(" and enter this code:"));
    box.append(p, el("div", { className: "usercode", textContent: c.user_code }),
      el("p", { className: "muted", textContent: "Waiting for you to authorize… this continues automatically." }));
    try { window.open(c.verification_uri, "_blank"); } catch (e) {}
  }

  async function ensureLogin() {
    if (cachedToken) return cachedToken;
    const cfg = window.ZT_CONFIG || {};
    if (!cfg.clientId)
      throw new Error("Not configured: set clientId in config.js (register a GitHub OAuth App with device flow).");
    setAuth("Requesting a device code…");
    cachedToken = await GH.deviceLogin({
      clientId: cfg.clientId, relayBase: cfg.relayBase, scope: cfg.scope || "public_repo",
      onCode: showDeviceCode,
    });
    return cachedToken;
  }

  async function fetchUser() {
    if (cachedUser) return cachedUser;
    const token = await ensureLogin();
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error("could not read your GitHub profile");
    cachedUser = await res.json();
    return cachedUser;
  }

  // Fill the author from the GitHub profile (and sign in, so submit needs no
  // further auth). Regenerates the README if it is still auto-generated.
  async function useGithubAccount(t) {
    try {
      setAuth("Connecting to GitHub…");
      const u = await fetchUser();
      t.author = u.name || u.login;
      if (!t.readmeEdited) regenReadme(t);
      render();
      setAuth("✓ Signed in as @" + u.login + " — submit needs no further authorization.");
    } catch (e) {
      setAuth("Error: " + e.message);
    }
  }

  async function submitAll(built) {
    const cfg = window.ZT_CONFIG || {};
    const btn = $("#submit"), note = $("#submit-note");
    btn.disabled = true;
    try {
      await ensureLogin();
      setAuth("Authorized. Opening pull request" + (Object.keys(built.layouts).length > 1 ? "s" : "") + "…");

      const results = [];
      for (const id of Object.keys(built.layouts)) {
        const layout = built.layouts[id];
        const files = built.files.filter((f) => f.path.indexOf(layout.versionDir + "/") === 0);
        const t = state.templates.find((x) => String(x.id) === String(id));
        const r = await GH.publishSubmission({
          token: cachedToken, owner: cfg.owner, repo: cfg.repo, base: cfg.base,
          branch: "submit/" + layout.folderName + "-" + layout.version,
          title: "Add " + layout.folderName + " (" + layout.version + ")",
          body: "Submitted via the upload form" + (t && t.author ? " by " + t.author : "") +
                ".\n\nStructural checks passed client-side; the CI live-import gate runs on this PR.",
          files: files.map((f) => ({ path: f.path, content: f.content, encoding: f.encoding })),
        });
        results.push(r);
      }
      const box = $("#auth"); box.innerHTML = "";
      box.append(el("p", { className: "done", textContent: "✓ Pull request" + (results.length > 1 ? "s" : "") + " opened:" }));
      results.forEach((r) => box.append(el("div", {}, [el("a", { href: r.url, target: "_blank", textContent: r.url })])));
      note.textContent = "Done.";
    } catch (e) {
      setAuth("Error: " + e.message);
      btn.disabled = false;
    }
  }

  function setAuth(msg) {
    let box = document.getElementById("auth");
    if (!box) { box = el("div", { id: "auth" }); $("#summary").append(box); }
    if (msg !== undefined && typeof msg === "string") box.textContent = msg;
  }

  function statusLine(kind, text) {
    return el("div", { className: "status " + kind }, [
      el("span", { textContent: kind === "ok" ? "✓" : "✗" }),
      el("span", { textContent: text }),
    ]);
  }

  function renderTree(paths) {
    // simple indented tree from sorted paths
    const lines = [];
    let prev = [];
    paths.forEach((p) => {
      const parts = p.split("/");
      parts.forEach((seg, i) => {
        if (prev[i] !== parts.slice(0, i + 1).join("/")) {
          lines.push("  ".repeat(i) + (i === parts.length - 1 ? "" : "") + seg + (i < parts.length - 1 ? "/" : ""));
        }
      });
      prev = parts.map((_, i) => parts.slice(0, i + 1).join("/"));
    });
    return lines.join("\n");
  }

  // --- drag & drop ---------------------------------------------------------

  const drop = $("#drop"), input = $("#file-input");
  $("#pick").addEventListener("click", (e) => { e.stopPropagation(); input.click(); });
  drop.addEventListener("click", () => input.click());
  input.addEventListener("change", () => { onFiles(input.files); input.value = ""; });
  ["dragenter", "dragover"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", (e) => { if (e.dataTransfer && e.dataTransfer.files) onFiles(e.dataTransfer.files); });

  // Small seam for headless tests (no effect in normal use).
  if (typeof window !== "undefined") window.__APP__ = {
    onFiles, buildAll, submitAll, render, regenReadme, onContentInput,
    maybeRegenOnCommit, useGithubAccount, state,
    resetAuth: () => { cachedToken = null; cachedUser = null; },
  };
})();
