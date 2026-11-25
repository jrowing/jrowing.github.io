// Live R in the browser for jrowing.com posts, powered by webR (https://docs.r-wasm.org/webr/).
// Every <pre class="r"> block in .post-content gets a Run button. The code is editable,
// all blocks on a page share one R session, and webR only downloads on the first Run.
// Add data-norun to a <pre class="r"> to leave it static.

const WEBR_URL = "https://webr.r-wasm.org/v0.6.1/webr.mjs";
const PLOTLY_URL = "https://cdn.jsdelivr.net/npm/plotly.js-dist-min@2.35.2/plotly.min.js";

const blocks = [...document.querySelectorAll(".post-content pre.r:not([data-norun])")];
if (blocks.length) init();

// R code run once, before any user code. It makes htmlwidgets and kable tables
// print as tagged text that the page can turn back into live output.
const PRELUDE = String.raw`
.webr_emit <- function(type, payload) cat("\n<<WEBR:", type, ">>", payload, "<<END>>\n", sep = "")
.webr_json_str <- function(x) paste0('"', gsub('"', '\\"', gsub("\\", "\\\\", x, fixed = TRUE), fixed = TRUE), '"')
setHook(packageEvent("plotly", "onLoad"), function(...) {
  fn <- function(x, ...) {
    b <- plotly::plotly_build(x)$x
    .webr_emit("plotly", plotly:::to_JSON(list(data = b$data, layout = b$layout)))
    invisible(x)
  }
  registerS3method("print", "plotly", fn, envir = asNamespace("plotly"))
})
setHook(packageEvent("knitr", "onLoad"), function(...) {
  registerS3method("print", "knitr_kable", function(x, ...) {
    if (identical(attr(x, "format"), "html")) .webr_emit("html", paste(x, collapse = "\n"))
    else cat(x, sep = "\n")
    invisible(x)
  }, envir = asNamespace("knitr"))
})
setHook(packageEvent("kableExtra", "onLoad"), function(...) {
  registerS3method("print", "kableExtra", function(x, ...) {
    .webr_emit("html", paste(x, collapse = "\n")); invisible(x)
  }, envir = asNamespace("kableExtra"))
})
`;

// Packages that are replaced by small stand-ins instead of being installed.
const SHIMS = {
  // networkD3 draws with D3 in the page; the stand-in hands its data to the page's own Sankey renderer.
  networkD3: String.raw`
sankeyNetwork <- function(Links, Nodes, Source, Target, Value, NodeID, ...) {
  l <- Links; n <- as.character(Nodes[[NodeID]])
  links <- paste0('{"source":', l[[Source]], ',"target":', l[[Target]], ',"value":', l[[Value]], '}', collapse = ",")
  nodes <- paste(vapply(n, .webr_json_str, ""), collapse = ",")
  .webr_emit("sankey", paste0('{"nodes":[', nodes, '],"links":[', links, ']}'))
  invisible(NULL)
}`,
};

let webRPromise = null;
const installed = new Set();

function init() {
  injectStyles();
  blocks.forEach((pre) => {
    const code = pre.querySelector("code") || pre;
    const original = code.textContent;
    code.setAttribute("contenteditable", "plaintext-only");
    if (code.contentEditable !== "plaintext-only") code.setAttribute("contenteditable", "true");
    code.setAttribute("spellcheck", "false");
    code.addEventListener("keydown", (e) => {
      if (e.key === "Tab") { e.preventDefault(); document.execCommand("insertText", false, "  "); }
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); run(); }
    });

    const bar = document.createElement("div");
    bar.className = "webr-bar";
    bar.innerHTML = `<button type="button" class="webr-run">▶ Run in browser</button>
      <button type="button" class="webr-reset" hidden>Reset code</button>
      <span class="webr-status"></span>`;
    const out = document.createElement("div");
    out.className = "webr-output";
    out.hidden = true;

    // For folded code, keep the button outside the <details> so it works while collapsed.
    const anchor = pre.closest("details") || pre;
    if (anchor !== pre) bar.classList.add("webr-bar--folded");
    anchor.after(bar, out);

    const runBtn = bar.querySelector(".webr-run");
    const resetBtn = bar.querySelector(".webr-reset");
    const status = bar.querySelector(".webr-status");
    code.addEventListener("input", () => { resetBtn.hidden = code.textContent === original; });
    resetBtn.addEventListener("click", () => { code.textContent = original; resetBtn.hidden = true; });

    async function run() {
      runBtn.disabled = true;
      out.hidden = false;
      out.replaceChildren();
      try {
        const webR = await getWebR(status);
        await installFor(webR, code.textContent, status);
        status.textContent = "Running…";
        await runCode(webR, code.textContent, out);
        status.textContent = "Done. Edit the code and run again (Ctrl/⌘ + Enter).";
      } catch (err) {
        appendText(out, String(err && err.message ? err.message : err), "webr-error");
        status.textContent = "Something went wrong.";
      } finally {
        runBtn.disabled = false;
        runBtn.textContent = "▶ Run again";
      }
    }
    runBtn.addEventListener("click", run);
  });
}

function getWebR(status) {
  if (!webRPromise) {
    status.textContent = "Starting R in your browser (first run downloads about 30 MB)…";
    webRPromise = (async () => {
      const { WebR } = await import(WEBR_URL);
      const webR = new WebR();
      await webR.init();
      await webR.evalRVoid(PRELUDE);
      return webR;
    })();
    webRPromise.catch(() => { webRPromise = null; });
  }
  return webRPromise;
}

async function installFor(webR, src, status) {
  const pkgs = [...src.matchAll(/(?:library|require)\(\s*["']?([A-Za-z][A-Za-z0-9.]*)["']?\s*\)/g)].map((m) => m[1]);
  for (const pkg of new Set(pkgs)) {
    if (installed.has(pkg)) continue;
    if (SHIMS[pkg]) {
      await webR.evalRVoid(SHIMS[pkg]);
    } else {
      const have = await webR.evalRBoolean(`requireNamespace("${pkg}", quietly = TRUE)`);
      if (!have) {
        status.textContent = `Installing ${pkg} (one-off, can take a while)…`;
        await webR.installPackages([pkg], { quiet: true });
        if (!(await webR.evalRBoolean(`requireNamespace("${pkg}", quietly = TRUE)`))) {
          throw new Error(`Couldn't install the R package "${pkg}" in the browser. It may not be available for webR, or the download failed; try again later.`);
        }
      }
    }
    installed.add(pkg);
  }
}

async function runCode(webR, src, out) {
  // library(networkD3) would fail as the package is shimmed rather than installed.
  const code = src.replace(/^\s*library\(\s*["']?networkD3["']?\s*\)\s*$/gm, "");
  const shelter = await new webR.Shelter();
  try {
    const width = Math.min(Math.max(out.clientWidth || 700, 400), 900);
    const res = await shelter.captureR(code, {
      withAutoprint: true,
      captureStreams: true,
      captureConditions: true,
      captureGraphics: { width, height: Math.round(width * 0.62) },
    });
    let text = [];
    const flush = () => { if (text.length) { appendText(out, text.join("\n")); text = []; } };
    for (const item of res.output) {
      if (item.type === "stdout") {
        for (const part of splitTagged(item.data)) {
          if (typeof part === "string") text.push(part);
          else { flush(); await renderWidget(out, part.type, part.payload); }
        }
      } else if (item.type === "stderr") {
        if (item.data) text.push(String(item.data).trimEnd());
      } else if (["message", "warning", "error"].includes(item.type)) {
        let msg = item.type;
        try { msg = String(await (await item.data.get("message")).toString()).trimEnd(); } catch (e) { /* keep default */ }
        if (item.type === "message") { text.push(msg); continue; }
        flush();
        appendText(out, `${item.type === "error" ? "Error" : "Warning"}: ${msg}`, item.type === "error" ? "webr-error" : "webr-warning");
      }
    }
    flush();
    for (const img of res.images) {
      const canvas = document.createElement("canvas");
      canvas.width = img.width; canvas.height = img.height;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.className = "webr-plot";
      out.appendChild(canvas);
    }
    if (!out.childElementCount) appendText(out, "(no output)", "webr-muted");
  } finally {
    shelter.purge();
  }
}

function splitTagged(s) {
  const parts = [];
  const re = /\n?<<WEBR:(\w+)>>([\s\S]*?)<<END>>\n?/g;
  let last = 0, m;
  while ((m = re.exec(s))) {
    if (m.index > last) parts.push(s.slice(last, m.index));
    parts.push({ type: m[1], payload: m[2] });
    last = re.lastIndex;
  }
  if (last < s.length) parts.push(s.slice(last));
  return parts.filter((p) => typeof p !== "string" || p.trim() !== "");
}

async function renderWidget(out, type, payload) {
  const el = document.createElement("div");
  el.className = `webr-widget webr-widget--${type}`;
  out.appendChild(el);
  if (type === "html") {
    el.innerHTML = payload;
  } else if (type === "plotly") {
    if (!window.Plotly) await loadScript(PLOTLY_URL);
    const fig = JSON.parse(payload);
    fig.layout.autosize = true; delete fig.layout.width; delete fig.layout.height;
    await window.Plotly.newPlot(el, fig.data, fig.layout, { responsive: true, displaylogo: false });
  } else if (window.webrRenderers && window.webrRenderers[type]) {
    await window.webrRenderers[type](el, JSON.parse(payload));
  } else {
    el.textContent = `[${type} output can't be shown here]`;
  }
}

function appendText(out, text, cls) {
  const pre = document.createElement("pre");
  pre.className = "webr-text" + (cls ? " " + cls : "");
  pre.textContent = text;
  out.appendChild(pre);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Could not load " + src));
    document.head.appendChild(s);
  });
}

function injectStyles() {
  const css = `
.post-content pre.r code[contenteditable]{outline:none;display:block;min-height:1em}
.post-content pre.r:focus-within{border-color:var(--accent,#c8813a)}
.webr-bar{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem;margin:-.75rem 0 1rem}
.webr-bar button{font:inherit;font-size:13px;padding:.35rem .8rem;border-radius:6px;cursor:pointer;
  border:0.5px solid var(--border,#ccc);background:var(--bg-card,#f6f6f6);color:var(--text-primary,#222)}
.webr-bar--folded{margin:.6rem 0 1rem}
.webr-bar .webr-run{border-color:var(--accent,#c8813a)}
.webr-bar button:disabled{opacity:.6;cursor:progress}
.webr-status{font-size:12px;color:var(--text-secondary,#666)}
.webr-output{margin:0 0 1.5rem;padding:1rem;border:0.5px dashed var(--border,#ccc);border-radius:var(--radius,8px);overflow-x:auto}
.webr-output::before{content:"Live output";display:block;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--text-secondary,#666);margin-bottom:.5rem}
.post-content .webr-output pre.webr-text{margin:.5rem 0;padding:.6rem .8rem;font-family:var(--font-mono,monospace);font-size:12.5px;white-space:pre-wrap}
.webr-output .webr-error{color:#c0392b}
.webr-output .webr-warning{color:#b9770e}
.webr-output .webr-muted{color:var(--text-secondary,#666)}
.webr-output canvas.webr-plot{display:block;max-width:100%;height:auto;margin:.5rem 0;background:#fff;border-radius:4px}
.webr-output .webr-widget{margin:.5rem 0;overflow-x:auto}
.webr-output .webr-widget--plotly{min-height:420px}
`;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}
