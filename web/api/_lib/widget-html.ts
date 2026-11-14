// MCP Apps view for show_calendar: one self-contained HTML document (inline CSS and JS, no external hosts,
// so the resource needs no _meta.ui.csp). It speaks the MCP Apps postMessage protocol by hand
// (ext-apps spec 2026-01-26: ui/initialize, ui/notifications/initialized, ui/notifications/tool-result,
// ui/notifications/host-context-changed, ui/notifications/size-changed, ui/open-link) instead of bundling
// @modelcontextprotocol/ext-apps (532 KB with deps).
// Colours follow web/src/charts/heatmap.ts: reversed inferno on a sqrt scale, anomaly outline #2a9df4,
// grey for missing values, a cross for known satellite outages (MODIS or VIIRS, whichever the value comes from). Back-cast months get a hatch.
// Keep this file free of backticks and dollar-brace pairs: it is one String.raw template.

export const CALENDAR_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Burning calendar</title>
<style>
:root {
  color-scheme: light dark;
  --bc-fg: var(--color-text-primary, light-dark(#1f1d1a, #ece9e4));
  --bc-muted: var(--color-text-secondary, light-dark(#5f5a53, #a8a29a));
  --bc-bg: var(--color-background-primary, transparent);
  --bc-line: var(--color-border-secondary, light-dark(#d9d5cf, #3d3a36));
  --bc-link: var(--color-text-info, light-dark(#1f6fb2, #6cb4f0));
  --bc-none: light-dark(#c9c6c1, #4a4743);
  --bc-font: var(--font-sans, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif);
}
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"] { color-scheme: dark; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { font: 13px/1.4 var(--bc-font); color: var(--bc-fg); background: var(--bc-bg); }
main { padding: 12px 14px 10px; max-width: 720px; }
h1 { font-size: 15px; font-weight: 600; margin: 0 0 2px; }
.sub { color: var(--bc-muted); margin: 0 0 8px; }
.sub b { color: var(--bc-fg); font-weight: 600; }
svg.cal { display: block; width: 100%; height: auto; }
svg text { fill: var(--bc-muted); font: 10px var(--bc-font); }
.legend { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 14px; margin: 8px 0 4px; color: var(--bc-muted); font-size: 11px; }
.legend span.item { display: inline-flex; align-items: center; gap: 5px; }
.legend svg { flex: none; }
.caveats { color: var(--bc-muted); font-size: 11px; margin: 6px 0 0; }
.caveats code { font-size: 10.5px; }
.foot { display: flex; justify-content: space-between; gap: 12px; margin-top: 6px; font-size: 12px; }
a { color: var(--bc-link); }
.status { color: var(--bc-muted); padding: 14px; }
</style>
</head>
<body>
<main id="app"><p class="status" id="status">Loading the burning calendar...</p></main>
<script>
(function () {
  "use strict";
  var PUBLIC = "https://burning-calendar.vercel.app/";
  var RAMP = ["#fcffa4", "#f6d746", "#fca50a", "#f37819", "#dd513a", "#bc3754", "#932667", "#6a176e", "#420a68", "#160b39", "#000004"];
  var ANOM = "#2a9df4";
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  var SVGNS = "http://www.w3.org/2000/svg";
  var nextId = 1;
  var pending = {};
  var hostCaps = {};
  var lastData = null;

  function post(msg) { window.parent.postMessage(msg, "*"); }
  function request(method, params) {
    var id = nextId++;
    post({ jsonrpc: "2.0", id: id, method: method, params: params || {} });
    return new Promise(function (resolve, reject) { pending[id] = { resolve: resolve, reject: reject }; });
  }
  function notify(method, params) { post({ jsonrpc: "2.0", method: method, params: params || {} }); }

  window.addEventListener("message", function (ev) {
    if (ev.source !== window.parent) return;
    var m = ev.data;
    if (!m || m.jsonrpc !== "2.0") return;
    if (m.id != null && !m.method) {
      var p = pending[m.id];
      if (p) { delete pending[m.id]; if (m.error) p.reject(m.error); else p.resolve(m.result); }
      return;
    }
    switch (m.method) {
      case "ui/notifications/tool-result": onResult(m.params || {}); break;
      case "ui/notifications/host-context-changed": applyContext(m.params || {}); break;
      case "ui/notifications/tool-cancelled": status("The tool call was cancelled."); break;
      case "ui/notifications/tool-input": case "ui/notifications/tool-input-partial": break;
      default:
        if (m.id != null) {
          if (m.method === "ui/resource-teardown" || m.method === "ping") post({ jsonrpc: "2.0", id: m.id, result: {} });
          else post({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "Method not found" } });
        }
    }
  });

  function applyContext(ctx) {
    var root = document.documentElement;
    if (ctx.theme === "light" || ctx.theme === "dark") root.setAttribute("data-theme", ctx.theme);
    var vars = ctx.styles && ctx.styles.variables;
    if (vars) for (var k in vars) if (vars[k] && k.indexOf("--") === 0) root.style.setProperty(k, String(vars[k]));
  }

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    for (var k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function sv(tag, attrs, text) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs || {}) e.setAttribute(k, String(attrs[k]));
    if (text != null) e.textContent = text;
    return e;
  }
  function status(text) {
    var app = document.getElementById("app");
    app.textContent = "";
    app.appendChild(el("p", { "class": "status" }, text));
    sendSize();
  }

  function hex(c) { return [1, 3, 5].map(function (i) { return parseInt(c.slice(i, i + 2), 16); }); }
  var RGB = RAMP.map(hex);
  function ramp(t) {
    t = Math.max(0, Math.min(1, t));
    var x = t * (RGB.length - 1), i = Math.min(RGB.length - 2, Math.floor(x)), f = x - i;
    var a = RGB[i], b = RGB[i + 1];
    return "rgb(" + [0, 1, 2].map(function (j) { return Math.round(a[j] + (b[j] - a[j]) * f); }).join(",") + ")";
  }
  function fmt(n) {
    if (n == null) return "n/a";
    return n >= 100 ? Math.round(n).toLocaleString("en") : (Math.round(n * 10) / 10).toString();
  }
  function tick(n) {
    if (n >= 1000) return (Math.round(n / 100) / 10) + "k";
    return String(Math.round(n));
  }
  function swatch(inner) {
    var s = sv("svg", { width: 14, height: 14, viewBox: "0 0 14 14", "aria-hidden": "true" });
    inner.forEach(function (c) { s.appendChild(c); });
    return s;
  }
  function hatchDef(id) {
    // Cell colours do not change with the theme, so the hatch does not either.
    var p = sv("pattern", { id: id, width: 5, height: 5, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
    p.appendChild(sv("line", { x1: 0, y1: 0, x2: 0, y2: 5, style: "stroke:rgba(30,25,20,0.32);stroke-width:1px" }));
    return p;
  }

  function onResult(res) {
    var d = res.structuredContent;
    if (res.isError || !d || !Array.isArray(d.months)) {
      var t = res.content && res.content[0] && res.content[0].text;
      status(t ? String(t).slice(0, 400) : "No calendar data in the tool result.");
      return;
    }
    lastData = d;
    render(d);
  }

  function render(d) {
    var app = document.getElementById("app");
    app.textContent = "";
    var harm = d.series === "harm";
    var relative = d.mode === "relative";
    app.appendChild(el("h1", null, String(d.name || d.region_id) + " (" + String(d.region_id) + ")"));
    var sub = el("p", { "class": "sub" });
    sub.appendChild(el("b", null, relative ? "Relative mode" : "Harmonized mode"));
    sub.appendChild(document.createTextNode(" · " + String(d.series_label || d.series) + ", detections per month" +
      (d.returned ? " · " + d.returned.from + " to " + d.returned.to : "") +
      (relative ? " · raw MODIS counts, not comparable with harmonized regions" : "")));
    app.appendChild(sub);

    var cells = d.months;
    if (!cells.length) { app.appendChild(el("p", { "class": "status" }, "No months in the requested range.")); sendSize(); return; }
    var y0 = +cells[0].ym.slice(0, 4), y1 = +cells[cells.length - 1].ym.slice(0, 4), n = y1 - y0 + 1;
    var W = 600, L = 40, T = 16, cw = (W - L - 4) / 12;
    var rh = n <= 6 ? 22 : n <= 12 ? 16 : 12;
    var H = T + n * rh + 2;
    var max = 0;
    cells.forEach(function (c) { if (c.v != null && c.v > max) max = c.v; });
    var smax = Math.sqrt(max || 1);
    var svg = sv("svg", { "class": "cal", viewBox: "0 0 " + W + " " + H, role: "img",
      "aria-label": "Calendar of monthly fire detections, " + d.region_id + ", " + y0 + " to " + y1 });
    var defs = sv("defs");
    defs.appendChild(hatchDef("bc-hatch"));
    svg.appendChild(defs);
    MONTHS.forEach(function (m, i) { svg.appendChild(sv("text", { x: L + i * cw + cw / 2, y: 11, "text-anchor": "middle" }, m)); });
    for (var y = y0; y <= y1; y++) {
      if (n <= 12 || y % 5 === 0 || y === y0) {
        svg.appendChild(sv("text", { x: L - 6, y: T + (y - y0) * rh + rh / 2 + 3.5, "text-anchor": "end" }, String(y)));
      }
    }
    var showAnom = d.series === d.anomaly_series;
    var pad = 0.8;
    cells.forEach(function (c) {
      var yr = +c.ym.slice(0, 4), mo = +c.ym.slice(5, 7) - 1;
      var x = L + mo * cw + pad, yy = T + (yr - y0) * rh + pad, w = cw - 2 * pad, h = rh - 2 * pad;
      var g = sv("g");
      var fill = c.v == null ? "var(--bc-none)" : ramp(Math.sqrt(c.v) / smax);
      g.appendChild(sv("rect", { x: x, y: yy, width: w, height: h, style: "fill:" + fill }));
      var back = harm && c.src && c.src !== "observed";
      if (back) g.appendChild(sv("rect", { x: x, y: yy, width: w, height: h, fill: "url(#bc-hatch)" }));
      if (showAnom && c.anom) g.appendChild(sv("rect", { x: x + 1.5, y: yy + 1.5, width: w - 3, height: h - 3, fill: "none", stroke: ANOM, "stroke-width": 1.5 }));
      if (c.outage) g.appendChild(sv("text", { x: x + w / 2, y: yy + h / 2 + 3.5, "text-anchor": "middle", style: "fill:#1d1b19;stroke:#fff;stroke-width:2.5px;paint-order:stroke;font-weight:600;font-size:" + Math.min(12, rh) + "px" }, "×"));
      var lines = [c.ym + "  " + String(d.series_label || d.series) + ": " + fmt(c.v)];
      if (back) lines.push("back-cast from MODIS (" + c.src + "), range " + fmt(c.lo) + " to " + fmt(c.hi));
      if (showAnom && c.anom) lines.push("ANOMALY: above the 90th percentile of the preceding 10 years");
      if (c.outage) lines.push("known " + (c.outage === "viirs" ? "VIIRS S-NPP" : "MODIS") + " data gap of 3 or more days");
      g.appendChild(sv("title", null, lines.join("\n")));
      svg.appendChild(g);
    });
    app.appendChild(svg);

    var lg = el("div", { "class": "legend" });
    var gw = 120;
    var grad = sv("svg", { width: gw + 50, height: 24, viewBox: "0 0 " + (gw + 50) + " 24", "aria-hidden": "true" });
    var lgDefs = sv("defs");
    var lin = sv("linearGradient", { id: "bc-grad", x1: 0, x2: 1, y1: 0, y2: 0 });
    for (var i = 0; i <= 10; i++) lin.appendChild(sv("stop", { offset: (i * 10) + "%", "stop-color": ramp(i / 10) }));
    lgDefs.appendChild(lin);
    grad.appendChild(lgDefs);
    grad.appendChild(sv("rect", { x: 4, y: 2, width: gw, height: 9, fill: "url(#bc-grad)" }));
    [0, 0.25, 1].forEach(function (f) {
      var v = f * max, px = 4 + Math.sqrt(f) * gw;
      grad.appendChild(sv("text", { x: px, y: 22, "text-anchor": f === 0 ? "start" : f === 1 ? "end" : "middle" }, tick(v)));
    });
    lg.appendChild(grad);
    function item(sw, text) { var s = el("span", { "class": "item" }); s.appendChild(sw); s.appendChild(el("span", null, text)); lg.appendChild(s); }
    if (showAnom) item(swatch([sv("rect", { x: 1, y: 1, width: 12, height: 12, fill: "#c33b4c" }), sv("rect", { x: 2.5, y: 2.5, width: 9, height: 9, fill: "none", stroke: ANOM, "stroke-width": 1.5 })]), "Anomaly (> p90 of preceding 10 years)");
    else item(swatch([]), "Anomaly outlines refer to the " + d.anomaly_series + " series; not shown");
    if (harm && cells.some(function (c) { return c.src && c.src !== "observed"; })) {
      var hs = swatch([]);
      var hd = sv("defs"); hd.appendChild(hatchDef("bc-hatch-key")); hs.appendChild(hd);
      hs.appendChild(sv("rect", { x: 1, y: 1, width: 12, height: 12, fill: "#f6d746" }));
      hs.appendChild(sv("rect", { x: 1, y: 1, width: 12, height: 12, fill: "url(#bc-hatch-key)" }));
      item(hs, "Back-cast from MODIS (before Feb 2012), modelled");
    }
    if (cells.some(function (c) { return c.outage; })) item(swatch([sv("rect", { x: 1, y: 1, width: 12, height: 12, fill: "#fbe7a6" }), sv("text", { x: 7, y: 11, "text-anchor": "middle", style: "fill:#1d1b19;font-size:12px;font-weight:600" }, "×")]), "Known satellite outage");
    if (cells.some(function (c) { return c.v == null; })) item(swatch([sv("rect", { x: 1, y: 1, width: 12, height: 12, style: "fill:var(--bc-none)" })]), "No value");
    app.appendChild(lg);

    var codes = Array.isArray(d.caveat_codes) ? d.caveat_codes : (d.caveats || []).map(function (c) { return c.code; });
    if (codes.length) {
      var cv = el("p", { "class": "caveats" });
      cv.appendChild(document.createTextNode("Caveats: "));
      codes.forEach(function (code, i) {
        var full = (d.caveats || []).filter(function (c) { return c.code === code; })[0];
        var c = el("code", full ? { title: String(full.message) } : null, String(code));
        if (i) cv.appendChild(document.createTextNode(", "));
        cv.appendChild(c);
      });
      cv.appendChild(document.createTextNode(". Counts are satellite detections, not fires."));
      app.appendChild(cv);
    }

    var foot = el("div", { "class": "foot" });
    var src = el("span", { "class": "caveats" }, "NASA FIRMS MODIS C6.1 + VIIRS S-NPP" + (d.source && d.source.method_version ? ", method " + d.source.method_version : ""));
    foot.appendChild(src);
    var url = typeof d.view_url === "string" && d.view_url.indexOf(PUBLIC) === 0 ? d.view_url : PUBLIC;
    var a = el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, "Open in Burning Calendar ↗");
    a.addEventListener("click", function (ev) {
      if (!hostCaps.openLinks) return;
      ev.preventDefault();
      request("ui/open-link", { url: url }).catch(function () { window.open(url, "_blank", "noopener"); });
    });
    foot.appendChild(a);
    app.appendChild(foot);
    sendSize();
  }

  var lastH = 0;
  function sendSize() {
    var h = Math.ceil(document.documentElement.getBoundingClientRect().height);
    if (h && h !== lastH) { lastH = h; notify("ui/notifications/size-changed", { height: h }); }
  }
  if (window.ResizeObserver) new ResizeObserver(sendSize).observe(document.documentElement);

  request("ui/initialize", {
    appInfo: { name: "burning-calendar-widget", version: "1.0.0" },
    appCapabilities: { availableDisplayModes: ["inline"] },
    protocolVersion: "2026-01-26"
  }).then(function (r) {
    r = r || {};
    hostCaps = r.hostCapabilities || {};
    applyContext(r.hostContext || {});
    notify("ui/notifications/initialized", {});
    if (lastData) render(lastData);
  }).catch(function () { status("This host did not initialize the widget. The tool's text result has the data."); });
})();
</script>
</body>
</html>
`;
