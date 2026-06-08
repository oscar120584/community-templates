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
        state.templates.push({
          id: ++seq, fileName: f.name, content: f.content, parsed,
          category: "", author: "", overview: "",
          slug: ZT.slugify(parsed.name), slugTouched: false,
        });
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
        const readme = ZT.generateReadme(t.parsed, { author: t.author, overview: t.overview });
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
        oninput: (e) => { t.author = e.target.value; },
      });
      const overviewInput = el("textarea", {
        value: t.overview, placeholder: "What does it monitor? Requirements?",
        oninput: (e) => { t.overview = e.target.value; },
      });

      const grid = el("div", { className: "grid" }, [
        el("label", { textContent: "Category" }), catSel,
        el("label", { textContent: "Folder slug" }), slugInput,
        el("label", { textContent: "Author" }), authorInput,
        el("label", { textContent: "Overview" }), overviewInput,
      ]);

      const pathLine = el("div", { className: "path", id: "path-" + t.id });

      const readmeDetails = el("details", {}, [
        el("summary", { textContent: "Preview generated README" }),
        el("pre", { className: "preview", textContent: ZT.generateReadme(p, { author: t.author, overview: t.overview }) }),
      ]);
      readmeDetails.addEventListener("toggle", () => {
        if (readmeDetails.open)
          readmeDetails.querySelector(".preview").textContent =
            ZT.generateReadme(p, { author: t.author, overview: t.overview });
      });

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

  let cachedToken = null;

  async function submitAll(built) {
    const cfg = window.ZT_CONFIG || {};
    const btn = $("#submit"), note = $("#submit-note");
    if (!cfg.clientId) {
      note.textContent = "Not configured: set clientId in config.js (register a GitHub OAuth App with device flow).";
      return;
    }
    btn.disabled = true;
    try {
      if (!cachedToken) {
        setAuth("Requesting a device code…");
        cachedToken = await GH.deviceLogin({
          clientId: cfg.clientId, relayBase: cfg.relayBase, scope: cfg.scope || "public_repo",
          onCode: (c) => {
            setAuth("");
            const box = $("#auth");
            box.innerHTML = "";
            box.append(
              el("p", { textContent: "1. Open " }),
            );
            const a = el("a", { href: c.verification_uri, target: "_blank", textContent: c.verification_uri });
            box.firstChild.append(a, document.createTextNode(" and enter this code:"));
            box.append(el("div", { className: "usercode", textContent: c.user_code }));
            box.append(el("p", { className: "muted", textContent: "Waiting for you to authorize… this continues automatically." }));
            try { window.open(c.verification_uri, "_blank"); } catch (e) {}
          },
        });
      }
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
  if (typeof window !== "undefined") window.__APP__ = { onFiles, buildAll, submitAll, render, state };
})();
