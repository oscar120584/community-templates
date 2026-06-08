/*
 * zt.js — browser/node port of the Python `ztcore` library.
 *
 * Same responsibilities as ztcore: parse a Zabbix export, run the cheap
 * (network-free) validation checks, derive the directory layout, and generate
 * a README. Kept deliberately close to the Python so the two don't drift; the
 * authoritative gate is still the CI (review_pr.yaml), this is instant L1 UX.
 *
 * UMD wrapper so the same file runs under Node (require) for parity tests and
 * in the browser (expects a global `jsyaml` from the js-yaml CDN script).
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("js-yaml"));
  } else {
    global.ZT = factory(global.jsyaml);
  }
})(typeof self !== "undefined" ? self : this, function (jsyaml) {
  "use strict";

  const CATEGORIES = [
    "Applications", "Cloud", "Databases", "Network_Appliances",
    "Network_Devices", "Operating_Systems", "Power_Inverter", "Power_(UPS)",
    "Printers", "SCADA_IoT_Energy_Home_Automation_Industrial_monitoring",
    "Server_Hardware", "Storage_Devices", "Telephony", "Unsorted",
    "Virtualization", "Weather_Measurements", "Web_scenarios",
  ];

  const SLUG_BODY = "[.a-zA-Z0-9()_-]+";
  const RE_TEMPLATE_FOLDER = new RegExp("^template_" + SLUG_BODY + "$");
  const RE_MEDIATYPE_FOLDER = new RegExp("^mediatype_" + SLUG_BODY + "$");
  const RE_TEMPLATE_FILE = RE_TEMPLATE_FOLDER;
  const RE_MEDIATYPE_FILE = RE_MEDIATYPE_FOLDER;
  const RE_README = new RegExp(
    "^(template|mediatype)_" + SLUG_BODY + "/\\d+\\.\\d+/(files/.*)?README\\.md$", "i");
  const RE_OTHER = new RegExp(
    "^(template|mediatype)_" + SLUG_BODY + "/\\d+\\.\\d+/files/.+");

  const FORBIDDEN = [".github/", ".git/", ".gitignore", "docs/", "LICENSE", ".venv/"];
  const EXPORT_SUFFIXES = [".yaml", ".yml", ".json", ".xml"];

  // --- parsing -------------------------------------------------------------

  function detectFormat(content, hint) {
    if (hint) {
      const h = hint.toLowerCase();
      if (h.endsWith(".yaml") || h.endsWith(".yml")) return "yaml";
      if (h.endsWith(".json")) return "json";
      if (h.endsWith(".xml")) return "xml";
    }
    const s = content.replace(/^\s+/, "");
    if (s.startsWith("<")) return "xml";
    if (s.startsWith("{")) return "json";
    return "yaml";
  }

  function parseExport(content, filenameHint) {
    const fmt = detectFormat(content, filenameHint);
    let data;
    if (fmt === "yaml") {
      try { data = jsyaml.load(content); }
      catch (e) { throw new ParseError("invalid YAML: " + e.message); }
      return fromObject(data, "yaml");
    }
    if (fmt === "json") {
      try { data = JSON.parse(content); }
      catch (e) { throw new ParseError("invalid JSON: " + e.message); }
      return fromObject(data, "json");
    }
    return fromXml(content);
  }

  function ParseError(message) { this.name = "ParseError"; this.message = message; }
  ParseError.prototype = Object.create(Error.prototype);

  function blank() {
    return {
      fmt: "", kind: "unknown", version: "", name: "", internalName: "",
      description: "", uuid: "", groups: [], linkedTemplates: [],
      macros: [], items: [], triggers: [], discoveryRules: [], raw: null,
    };
  }

  function fromObject(data, fmt) {
    const p = blank(); p.fmt = fmt; p.raw = data;
    if (!data || typeof data !== "object" || !("zabbix_export" in data)) return p;
    const ex = data.zabbix_export || {};
    p.version = ex.version != null ? String(ex.version) : "";
    if ("templates" in ex) return templateFromObject(ex, fmt, p);
    if ("media_types" in ex) {
      const mt = (ex.media_types || [{}])[0] || {};
      p.kind = "mediatype"; p.name = mt.name || ""; p.description = mt.description || "";
      return p;
    }
    return p;
  }

  function templateFromObject(ex, fmt, p) {
    const t = (ex.templates || [{}])[0] || {};
    p.kind = "template";
    p.name = t.name || t.template || "";
    p.internalName = t.template || "";
    p.description = t.description || "";
    p.uuid = t.uuid || "";
    p.groups = (t.groups || []).map((g) => g.name || "");
    p.linkedTemplates = (t.templates || []).map((x) => x.name || "");
    p.macros = (t.macros || []).map((m) => ({
      macro: m.macro || "", value: m.value != null ? String(m.value) : "",
      description: m.description || "", type: m.type || "TEXT",
    }));

    (t.items || []).forEach((it) => {
      p.items.push(itemFrom(it, false));
      (it.triggers || []).forEach((tr) => p.triggers.push(trigFrom(tr, false)));
    });
    (t.triggers || []).forEach((tr) => p.triggers.push(trigFrom(tr, false)));

    (t.discovery_rules || []).forEach((lld) => {
      p.discoveryRules.push(lld.name || "");
      (lld.item_prototypes || []).forEach((it) => {
        p.items.push(itemFrom(it, true));
        (it.trigger_prototypes || []).forEach((tr) => p.triggers.push(trigFrom(tr, true)));
      });
      (lld.trigger_prototypes || []).forEach((tr) => p.triggers.push(trigFrom(tr, true)));
    });
    return p;
  }

  function itemFrom(it, discovered) {
    return {
      name: it.name || "", key: it.key || "", type: it.type || "ZABBIX_PASSIVE",
      delay: it.delay != null ? String(it.delay) : "", description: it.description || "",
      discovered: discovered,
    };
  }
  function trigFrom(tr, prototype) {
    return {
      name: tr.name || "", expression: tr.expression || "",
      priority: tr.priority || "NOT_CLASSIFIED", description: tr.description || "",
      manualClose: String(tr.manual_close || "").toUpperCase() === "YES", prototype: prototype,
    };
  }

  function fromXml(content) {
    // Best-effort: the repo is YAML in practice. Pull kind/version/name via
    // light regex so uploads still classify, without a full XML parser.
    const p = blank(); p.fmt = "xml"; p.raw = content;
    const ver = content.match(/<version>\s*([^<]+?)\s*<\/version>/);
    if (ver) p.version = ver[1];
    if (/<templates>/.test(content)) {
      p.kind = "template";
      const n = content.match(/<template>\s*<\/template>/) ? null
        : content.match(/<name>\s*([^<]+?)\s*<\/name>/);
      if (n) p.name = n[1];
    } else if (/<media_types>/.test(content)) {
      p.kind = "mediatype";
    }
    return p;
  }

  // --- assembly ------------------------------------------------------------

  function slugify(name) {
    let s = (name || "").trim().toLowerCase();
    s = s.replace(/\s+/g, "_").replace(/[^.a-z0-9()_-]/g, "").replace(/_{2,}/g, "_");
    s = s.replace(/^_+|_+$/g, "");
    return s || "template";
  }

  function AssembleError(message) { this.name = "AssembleError"; this.message = message; }
  AssembleError.prototype = Object.create(Error.prototype);

  const SEG_RE = /^[.a-zA-Z0-9()_-]+$/;
  // control chars, zero-width / bidi marks, line/para separators, BOM
  const INVISIBLE_RE = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u2060\ufeff]/;

  // Optional intermediate path between the category and the template folder,
  // e.g. "Eaton/9PX". Returns { path, error }; path is "" when blank/invalid.
  function validateSubpath(raw) {
    if (raw == null) return { path: "", error: "" };
    const s = String(raw);
    if (INVISIBLE_RE.test(s)) return { path: "", error: "Path contains invisible or control characters." };
    if (s.trim() === "") return { path: "", error: "" };
    if (s !== s.trim()) return { path: "", error: "Remove the leading/trailing spaces." };
    if (s.indexOf("\\") !== -1) return { path: "", error: "Use forward slashes (/), not backslashes." };
    if (s.charAt(0) === "/" || s.charAt(s.length - 1) === "/") return { path: "", error: "No leading or trailing slash." };
    if (s.indexOf("//") !== -1) return { path: "", error: "Empty path segment (//)." };
    const segs = s.split("/");
    for (const seg of segs) {
      if (seg === "." || seg === "..") return { path: "", error: "Path traversal (. or ..) is not allowed." };
      if (seg.length > 64) return { path: "", error: 'Segment too long: "' + seg + '".' };
      if (!SEG_RE.test(seg))
        return { path: "", error: 'Invalid segment "' + seg + '": use letters, digits, . ( ) _ - and no spaces.' };
    }
    return { path: segs.join("/"), error: "" };
  }

  function buildLayout(parsed, category, exportContent, opts) {
    opts = opts || {};
    if (parsed.kind !== "template" && parsed.kind !== "mediatype")
      throw new AssembleError("Uploaded file is not a Zabbix template or media type export.");
    if (!parsed.version) throw new AssembleError("Export has no version field.");
    if (CATEGORIES.indexOf(category) === -1)
      throw new AssembleError("Unknown category '" + category + "'.");

    const prefix = parsed.kind === "template" ? "template" : "mediatype";
    const slug = slugify(opts.slug || parsed.name);
    const folder = prefix + "_" + slug;
    const pat = prefix === "template" ? RE_TEMPLATE_FOLDER : RE_MEDIATYPE_FOLDER;
    if (!pat.test(folder)) throw new AssembleError("Derived folder name '" + folder + "' is invalid.");

    const sub = validateSubpath(opts.subpath);
    if (sub.error) throw new AssembleError("Subpath: " + sub.error);

    const ext = { yaml: "yaml", json: "json", xml: "xml" }[parsed.fmt];
    const versionDir = category + (sub.path ? "/" + sub.path : "") + "/" + folder + "/" + parsed.version;
    const layout = {
      category, subpath: sub.path, slug, prefix, version: parsed.version, fmt: parsed.fmt,
      folderName: folder, versionDir,
      exportPath: versionDir + "/" + folder + "." + ext,
      readmePath: versionDir + "/README.md",
      files: {},
    };
    layout.files[layout.exportPath] = exportContent;
    if (opts.readme != null) layout.files[layout.readmePath] = opts.readme;
    (opts.extraFiles || []).forEach((f) => {
      const safe = String(f.name).replace(/^\/+/, "");
      layout.files[versionDir + "/files/" + safe] = f.content;
    });
    return layout;
  }

  // --- validation (L1) -----------------------------------------------------

  function norm(path) { return path.replace(/\\/g, "/").replace(/^\.?\/+/, ""); }
  function stem(path) {
    const base = norm(path).split("/").pop();
    const dot = base.lastIndexOf(".");
    return dot > 0 ? base.slice(0, dot) : base;
  }
  function tailAfterTemplate(path) {
    const parts = norm(path).split("/");
    for (let i = 0; i < parts.length; i++)
      if (parts[i].indexOf("template_") === 0 || parts[i].indexOf("mediatype_") === 0)
        return parts.slice(i).join("/");
    return null;
  }

  function classify(f) {
    const low = f.path.toLowerCase();
    if (EXPORT_SUFFIXES.some((s) => low.endsWith(s)) && f.content != null) {
      try {
        const k = parseExport(f.content, f.path).kind;
        return (k === "template" || k === "mediatype") ? k : "unknown";
      } catch (e) { return "invalid"; }
    }
    if (low.endsWith("/readme.md") || low === "readme.md") return "readme";
    return "other";
  }

  function result(step, status, message) { return { step, status, message: message || "" }; }

  function checkForbidden(files) {
    for (const f of files) {
      const p = norm(f.path);
      if (FORBIDDEN.some((x) => p.indexOf(x) === 0))
        return result("Check forbidden folders", "fail", 'Changing "' + p + '" is forbidden.');
    }
    return result("Check forbidden folders", "success");
  }

  function checkNames(files) {
    const step = "Check template file name";
    let hasTarget = false;
    for (const f of files) {
      const kind = classify(f);
      if (kind === "invalid") return result(step, "fail", 'File "' + f.path + '" is not valid.');
      if (kind === "template" || kind === "mediatype") {
        hasTarget = true;
        const rx = kind === "template" ? RE_TEMPLATE_FILE : RE_MEDIATYPE_FILE;
        if (!rx.test(stem(f.path)))
          return result(step, "fail", "File name \"" + stem(f.path) + "\" is invalid.");
      }
    }
    if (!hasTarget) return result(step, "fail", "Template or mediatype file is missing.");
    return result(step, "success");
  }

  function checkStructure(files) {
    const step = "Check directory structure";
    const perDir = {};
    const problems = [];
    for (const f of files) {
      const p = norm(f.path);
      const kind = classify(f);
      const parts = p.split("/");
      if (kind === "template" || kind === "mediatype") {
        if (parts.length < 3) { problems.push('"' + p + '" is not inside a <name>/<version>/ folder.'); continue; }
        const folderName = parts[parts.length - 3], folderVer = parts[parts.length - 2];
        const dir = parts.slice(0, -1).join("/");
        (perDir[dir] = perDir[dir] || []).push(p);
        const rx = kind === "template" ? RE_TEMPLATE_FOLDER : RE_MEDIATYPE_FOLDER;
        if (!rx.test(folderName)) problems.push('Folder name "' + folderName + '" is invalid. File: ' + p + ".");
        let version = "";
        try { version = parseExport(f.content, p).version; }
        catch (e) { problems.push('"' + p + '" is not a valid ' + kind + " export."); continue; }
        if (folderVer !== version)
          problems.push('Folder version "' + folderVer + '" does not match export version "' + version + '". File: ' + p + ".");
      } else if (kind === "readme") {
        const tail = tailAfterTemplate(p);
        if (!(tail && RE_README.test(tail)))
          problems.push('README.md is only allowed in "<name>/X.X/" (or its files/ subfolder). File: ' + p + ".");
      } else if (kind === "other") {
        const tail = tailAfterTemplate(p);
        if (!(tail && RE_OTHER.test(tail)))
          problems.push('Other files are only allowed in "<name>/X.X/files/". File: ' + p + ".");
      }
    }
    Object.keys(perDir).forEach((d) => {
      if (perDir[d].length > 1) problems.push("Multiple template/mediatype files in " + d + ": " + perDir[d].join(", ") + ".");
    });
    if (problems.length) return result(step, "fail", problems.join(" "));
    return result(step, "success");
  }

  function runCheapChecks(files) {
    return [checkForbidden, checkNames, checkStructure].map((c) => {
      try { return c(files); }
      catch (e) { return result(c.name, "error", e.message); }
    });
  }

  // --- README generation ---------------------------------------------------

  const STUB = "_TODO: replace this stub._";
  const ITEM_TYPE_LABEL = {
    ZABBIX_PASSIVE: "Zabbix agent", ZABBIX_ACTIVE: "Zabbix agent (active)",
    SNMP_AGENT: "SNMP agent", DEPENDENT: "Dependent item", HTTP_AGENT: "HTTP agent",
    CALCULATED: "Calculated", INTERNAL: "Zabbix internal", SIMPLE: "Simple check",
    TRAP: "Zabbix trapper", EXTERNAL: "External check", SCRIPT: "Script", JMX: "JMX agent",
    DB_MONITOR: "Database monitor", IPMI: "IPMI agent", SSH: "SSH agent",
    TELNET: "TELNET agent", SNMP_TRAP: "SNMP trap",
  };
  const SEVERITY_LABEL = {
    NOT_CLASSIFIED: "Not classified", INFO: "Info", WARNING: "Warning",
    AVERAGE: "Average", HIGH: "High", DISASTER: "Disaster",
  };
  const MACRO_TYPE_LABEL = { TEXT: "Text macro", SECRET_TEXT: "Secret macro", VAULT: "Vault macro" };

  function esc(t) { return (t || "").replace(/\n/g, " ").replace(/\|/g, "\\|").trim(); }

  function macrosTable(macros) {
    if (!macros.length) return "There are no user macros in this template.";
    const rows = ["|Name|Description|Default|Type|", "|----|-----------|-------|----|"];
    macros.forEach((m) => {
      const value = m.type === "SECRET_TEXT" ? "`****`" : esc(m.value);
      rows.push("|" + esc(m.macro) + "|" + esc(m.description) + "|" + value + "|" + (MACRO_TYPE_LABEL[m.type] || m.type) + "|");
    });
    return rows.join("\n");
  }
  function itemsTable(items) {
    const reg = items.filter((i) => !i.discovered);
    if (!reg.length) return "There are no statically defined items in this template.";
    const rows = ["|Name|Description|Type|Key and additional info|", "|----|-----------|----|-----------------------|"];
    reg.forEach((i) => {
      let extra = esc(i.key);
      if (i.delay) extra += "<p>Update: " + esc(i.delay) + "</p>";
      rows.push("|" + esc(i.name) + "|" + esc(i.description) + "|`" + (ITEM_TYPE_LABEL[i.type] || i.type) + "`|" + extra + "|");
    });
    return rows.join("\n");
  }
  function triggersTable(triggers) {
    const reg = triggers.filter((t) => !t.prototype);
    if (!reg.length) return "There are no triggers in this template.";
    const rows = ["|Name|Description|Expression|Severity|Additional info|", "|----|-----------|----------|--------|---------------|"];
    reg.forEach((t) => {
      const extra = t.manualClose ? "Manual close: YES" : "-";
      rows.push("|" + esc(t.name) + "|" + esc(t.description) + "|`" + esc(t.expression) + "`|" + (SEVERITY_LABEL[t.priority] || t.priority) + "|" + extra + "|");
    });
    return rows.join("\n");
  }
  function discoverySection(p) {
    if (!p.discoveryRules.length) return "There are no discovery rules in this template.";
    const pi = p.items.filter((i) => i.discovered).length;
    const pt = p.triggers.filter((t) => t.prototype).length;
    const rows = ["|Name|Item prototypes|Trigger prototypes|", "|----|---------------|------------------|"];
    p.discoveryRules.forEach((n) => rows.push("|" + esc(n) + "|" + pi + "|" + pt + "|"));
    return rows.join("\n");
  }
  function linksSection(p) {
    if (!p.linkedTemplates.length) return "There are no template links in this template.";
    return p.linkedTemplates.map((n) => "- " + esc(n)).join("\n");
  }

  function generateReadme(parsed, opts) {
    opts = opts || {};
    const title = parsed.name || parsed.internalName || "Template";
    const ver = parsed.version || "your Zabbix version";
    const overview = opts.overview || (parsed.description || "").trim() || STUB;
    const setup = opts.setup || (STUB + " Describe how to enable data collection on the target and how to link the template to a host.");
    return [
      "# " + title, "",
      "## Overview", "", overview, "",
      "## Author", "", opts.author || STUB, "",
      "## Zabbix version", "", "This template is compatible with Zabbix " + ver + " and later versions.", "",
      "## Setup", "", setup, "",
      "## Macros used", "", macrosTable(parsed.macros), "",
      "## Items collected", "", itemsTable(parsed.items), "",
      "## Triggers", "", triggersTable(parsed.triggers), "",
      "## Discovery rules", "", discoverySection(parsed), "",
      "## Template links", "", linksSection(parsed), "",
      "## Feedback", "",
      "Please report any issues with the template at the [Zabbix community templates repository](https://github.com/zabbix/community-templates/issues).", "",
    ].join("\n");
  }

  return {
    CATEGORIES, ParseError, AssembleError,
    parseExport, slugify, validateSubpath, buildLayout,
    runCheapChecks, checkForbidden, checkNames, checkStructure,
    generateReadme,
  };
});
